import { ModuleThread, Pool, spawn } from "threads";
import { QueuedTask } from "threads/dist/master/pool";
import { WorkerDescriptor } from "threads/dist/master/pool-types";
import { ObservablePromise } from "threads/dist/observable-promise";

import { isSafari } from "../../common/utils/DeviceUtil";
import { LoadedCache } from "../Caches";
import { NpcGeometryData } from "../../render/loader/NpcGeometryData";
import type { NpcInstance } from "../../render/npc/NpcRenderTemplate";
import { RenderDataLoader } from "./RenderDataLoader";
import type { RenderDataWorker } from "./RenderDataWorker";

type RenderDataWorkerThread = ModuleThread<RenderDataWorker>;

/**
 * Safari under COEP can refuse Worker(scriptUrl) even for same-origin scripts
 * (especially when a service worker has mediated prior loads). Fetching the
 * script and starting it from a blob URL avoids that Worker() path.
 *
 * Webpack sets `i.p="/"` inside the worker; rewrite it to an absolute origin
 * so subsequent importScripts("/static/js/...") keep working from blob:.
 */
async function createSafariCoepSafeWorker(scriptUrl: URL): Promise<Worker> {
    const absoluteUrl = new URL(scriptUrl.href, globalThis.location.href).href;
    const response = await fetch(absoluteUrl, { credentials: "same-origin" });
    if (!response.ok) {
        throw new Error(`Failed to fetch worker script (${response.status}): ${absoluteUrl}`);
    }
    const source = await response.text();
    const publicPath = `${globalThis.location.origin}/`;
    const patched = source.replace(/i\.p\s*=\s*"\/"/, `i.p=${JSON.stringify(publicPath)}`);
    const blobUrl = URL.createObjectURL(
        new Blob([patched], { type: "application/javascript" }),
    );
    try {
        return new Worker(blobUrl);
    } catch (error) {
        URL.revokeObjectURL(blobUrl);
        throw error;
    }
}

async function spawnWorker(): Promise<RenderDataWorkerThread> {
    const scriptUrl = new URL("./RenderDataWorker.ts", import.meta.url);
    const worker = isSafari
        ? await createSafariCoepSafeWorker(scriptUrl)
        : new Worker(scriptUrl);
    return spawn<RenderDataWorker>(worker);
}

export class RenderDataWorkerPool {
    static create(size: number): RenderDataWorkerPool {
        const pool = Pool(() => spawnWorker(), size);
        const workers = pool["workers"] as WorkerDescriptor<RenderDataWorkerThread>[];
        return new RenderDataWorkerPool(pool, workers, size);
    }

    constructor(
        readonly pool: Pool<RenderDataWorkerThread>,
        readonly workers: WorkerDescriptor<RenderDataWorkerThread>[],
        readonly size: number,
    ) {}

    initCache(cache: LoadedCache, npcInstances: NpcInstance[]): void {
        for (const worker of this.workers) {
            worker.init.then((w) => w.initCache(cache, npcInstances));
        }
    }

    setNpcInstances(instances: NpcInstance[]): Promise<void> {
        const copy = Array.isArray(instances) ? instances.slice() : [];
        return this.runAll((w) => w.setNpcInstances(copy));
    }

    async runAll(task: (w: RenderDataWorkerThread) => any): Promise<void> {
        await Promise.all(this.workers.map((desc) => desc.init.then(task)));
    }

    initLoader(loader: RenderDataLoader<any, any>): Promise<void> {
        return this.runAll((w) => w.initDataLoader(loader));
    }

    resetLoader(loader: RenderDataLoader<any, any>): Promise<void> {
        return this.runAll((w) => w.resetDataLoader(loader));
    }

    queueLoad<I, D, Loader extends RenderDataLoader<I, D>>(
        loader: Loader,
        input: I,
    ): QueuedTask<RenderDataWorkerThread, D> {
        return this.pool.queue((w) => w.load(loader, input) as ObservablePromise<D>);
    }

    queueNpcGeometry(
        mapX: number,
        mapY: number,
        maxLevel: number,
        loadedTextureIds: number[],
    ): QueuedTask<RenderDataWorkerThread, NpcGeometryData> {
        return this.pool.queue(
            (w) =>
                w.loadNpcGeometry(
                    mapX,
                    mapY,
                    maxLevel,
                    loadedTextureIds,
                ) as ObservablePromise<NpcGeometryData>,
        );
    }

    queueLoadTexture(
        id: number,
        size: number,
        flipH: boolean,
        brightness: number,
    ): QueuedTask<RenderDataWorkerThread, Int32Array> {
        return this.pool.queue(
            (w) => w.loadTexture(id, size, flipH, brightness) as ObservablePromise<Int32Array>,
        );
    }

    setVars(vars: Int32Array): Promise<void> {
        return this.runAll((w) => w.setVars(vars));
    }

    exportSprites(): QueuedTask<RenderDataWorkerThread, Blob> {
        return this.pool.queue((w) => w.exportSpritesToZip());
    }

    exportTextures(): QueuedTask<RenderDataWorkerThread, Blob> {
        return this.pool.queue((w) => w.exportTexturesToZip());
    }

    terminate(): Promise<void> {
        return this.pool.terminate();
    }
}
