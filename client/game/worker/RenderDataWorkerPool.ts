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
 * Create the render-data worker.
 *
 * Webpack only emits a real worker chunk when it sees the literal
 * `new Worker(new URL("./RenderDataWorker.ts", import.meta.url))` pattern.
 *
 * Safari under COEP still refuses that Worker(scriptURL) fetch even with CORP
 * and a non-intercepting service worker (WebKit). Work around by briefly
 * patching Worker so the same expression runs, but the constructor loads the
 * script via importScripts() from a blob URL instead.
 */
function createRenderDataWorker(): Worker {
    const createDirectWorker = () =>
        new Worker(new URL("./RenderDataWorker.ts", import.meta.url));

    if (!isSafari) {
        return createDirectWorker();
    }

    const OriginalWorker = globalThis.Worker;

    class SafariCoepWorker extends OriginalWorker {
        constructor(scriptURL: string | URL, options?: WorkerOptions) {
            const absolute = new URL(
                typeof scriptURL === "string" ? scriptURL : scriptURL.href,
                globalThis.location.href,
            ).href;
            // Classic importScripts is allowed under COEP on Safari where
            // Worker(scriptURL) is not. Keep the worker classic (not module).
            const blobUrl = URL.createObjectURL(
                new Blob(
                    [`importScripts(${JSON.stringify(absolute)});`],
                    { type: "application/javascript" },
                ),
            );
            super(blobUrl, options);
        }
    }

    globalThis.Worker = SafariCoepWorker as typeof Worker;
    try {
        return createDirectWorker();
    } finally {
        globalThis.Worker = OriginalWorker;
    }
}

function spawnWorker(): Promise<RenderDataWorkerThread> {
    return spawn<RenderDataWorker>(createRenderDataWorker());
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
