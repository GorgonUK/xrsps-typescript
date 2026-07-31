import type { BasTypeLoader } from "../../rs/config/bastype/BasTypeLoader";
import type { NpcTypeLoader } from "../../rs/config/npctype/NpcTypeLoader";
import type { SeqTypeLoader } from "../../rs/config/seqtype/SeqTypeLoader";
import type { SeqFrameLoader } from "../../rs/model/seq/SeqFrameLoader";
import type { MapManager } from "../MapManager";
import type { RenderDataWorkerPool } from "../worker/RenderDataWorkerPool";
import type { NpcInstance } from "../../render/npc/NpcRenderTemplate";

export type NpcInstanceFlushControllerDeps = {
    getRenderer: () => any;
    workerPool: RenderDataWorkerPool;
    getSeqTypeLoader: () => SeqTypeLoader;
    getSeqFrameLoader: () => SeqFrameLoader;
    getNpcTypeLoader: () => NpcTypeLoader;
    getBasTypeLoader: () => BasTypeLoader;
};

/**
 * Server-driven NPC instance map sync and deferred map geometry refresh.
 */
export class NpcInstanceFlushController {
    readonly instanceMap: Map<string, NpcInstance> = new Map();
    readonly mapsPendingReload: Set<number> = new Set();

    private flushScheduled = false;
    private flushFallbackTimer?: ReturnType<typeof setTimeout>;
    private flushFallbackAttempt = 0;

    constructor(private readonly deps: NpcInstanceFlushControllerDeps) {}

    markMapPendingReload(mapId: number): void {
        this.mapsPendingReload.add(mapId | 0);
    }

    notifyRendererReady(): void {
        if (this.mapsPendingReload.size > 0) {
            this.scheduleFlush();
        }
    }

    scheduleFlush(): void {
        if (this.flushScheduled) return;
        this.flushScheduled = true;
        Promise.resolve().then(() => {
            this.flushScheduled = false;
            this.flushInstances().catch((err) => {
                console.warn("[OsrsClient] failed to flush NPC instances", err);
            });
        });
    }

    clearLocal(): void {
        this.instanceMap.clear();
        this.mapsPendingReload.clear();
        this.flushScheduled = false;
        this.resetFlushFallback();
    }

    applyNameOverrides(): void {
        const npcTypeLoader = this.deps.getNpcTypeLoader();
        if (!npcTypeLoader) return;
        try {
            for (const instance of this.instanceMap.values()) {
                if (!instance.name) continue;
                try {
                    const npcType = npcTypeLoader.load(instance.typeId);
                    npcType.name = instance.name;
                } catch (err) {
                    console.warn("Failed to apply NPC name override", instance.typeId, err);
                }
            }
        } catch (err) {
            console.warn("Failed to apply NPC instance name overrides", err);
        }
    }

    private scheduleFlushFallback(): void {
        if (this.flushFallbackTimer) return;
        if (this.mapsPendingReload.size === 0) {
            this.flushFallbackAttempt = 0;
            return;
        }
        const attempt = this.flushFallbackAttempt | 0;
        if (attempt >= 8) return;
        const delayMs = Math.min(2000, 50 * (1 << attempt));
        this.flushFallbackAttempt = (attempt + 1) | 0;
        this.flushFallbackTimer = setTimeout(() => {
            this.flushFallbackTimer = undefined;
            this.scheduleFlush();
        }, delayMs);
    }

    private resetFlushFallback(): void {
        this.flushFallbackAttempt = 0;
        if (!this.flushFallbackTimer) return;
        try {
            clearTimeout(this.flushFallbackTimer);
        } catch {}
        this.flushFallbackTimer = undefined;
    }

    private async flushInstances(): Promise<void> {
        const instances = Array.from(this.instanceMap.values());
        await this.deps.workerPool.setNpcInstances(instances);

        this.applyNameOverrides();

        if (this.mapsPendingReload.size === 0) {
            this.resetFlushFallback();
            return;
        }

        const renderer: any = this.deps.getRenderer();
        const rendererReady =
            !!renderer &&
            !!renderer.app &&
            !!renderer.npcProgram &&
            !!renderer.textureArray &&
            !!renderer.textureMaterials &&
            !!renderer.waterTextures &&
            !!renderer.sceneUniformBuffer;
        const mapManager = renderer?.mapManager as MapManager<any> | undefined;
        const mapManagerReady =
            !!mapManager && (mapManager.currentMapX | 0) >= 0 && (mapManager.currentMapY | 0) >= 0;

        if (!rendererReady || !mapManagerReady) {
            this.scheduleFlushFallback();
            return;
        }

        this.resetFlushFallback();

        const pending = Array.from(this.mapsPendingReload);
        const remaining = new Set<number>();
        const geometryPromises: Array<Promise<{ mapId: number; ok: boolean }>> = [];
        const seqTypeLoader = this.deps.getSeqTypeLoader();
        const seqFrameLoader = this.deps.getSeqFrameLoader();
        const npcTypeLoader = this.deps.getNpcTypeLoader();
        const basTypeLoader = this.deps.getBasTypeLoader();

        for (const mapId of pending) {
            const mapX = (mapId >> 8) & 0xff;
            const mapY = mapId & 0xff;

            const isWorldEntityOverlay = mapManager.worldEntityMapIds.has(mapId);
            if (!isWorldEntityOverlay && !mapManager.isMapInCurrentGrid(mapX, mapY)) {
                remaining.add(mapId);
                continue;
            }

            const map = mapManager.getMap(mapX, mapY);
            if (!map) {
                mapManager.loadMap(mapX, mapY);
                remaining.add(mapId);
                continue;
            }

            geometryPromises.push(
                (async () => {
                    try {
                        const npcGeometry = await this.deps.workerPool.queueNpcGeometry(
                            mapX,
                            mapY,
                            renderer.maxLevel ?? 3,
                            Array.from(renderer.loadedTextureIds ?? []),
                        );
                        if (!npcGeometry) return { mapId, ok: false };
                        renderer.updateTextureArray?.(npcGeometry.loadedTextures);
                        (map as any).refreshNpcGeometry?.(
                            renderer.app,
                            renderer.npcProgram,
                            renderer.textureArray,
                            renderer.textureMaterials,
                            renderer.waterTextures,
                            renderer.sceneUniformBuffer,
                            seqTypeLoader,
                            seqFrameLoader,
                            npcTypeLoader,
                            basTypeLoader,
                            npcGeometry,
                        );
                        return { mapId, ok: true };
                    } catch (err) {
                        console.warn(
                            "[OsrsClient] failed to refresh NPC geometry",
                            mapX,
                            mapY,
                            err,
                        );
                        return { mapId, ok: false };
                    }
                })(),
            );
        }

        const results = await Promise.all(geometryPromises);
        for (const res of results) {
            if (!res.ok) remaining.add(res.mapId | 0);
        }

        this.mapsPendingReload.clear();
        for (const mapId of remaining) {
            this.mapsPendingReload.add(mapId);
        }
    }
}
