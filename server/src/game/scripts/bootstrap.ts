import fs from "fs";
import path from "path";

import { ScriptRuntime } from "./ScriptRuntime";
import type { ScriptManifestEntry } from "./manifest";

const MANIFEST_PATH = path.resolve(__dirname, "manifest");
const GAME_DIR = path.resolve(__dirname, "..");

/**
 * Directories whose contents are considered "hot-reloadable content". Editing
 * any TypeScript file inside these trees while SCRIPT_HOT_RELOAD=1 will:
 *   1. Wipe Node's require.cache for every loaded file under any of these roots.
 *   2. Re-evaluate the manifest and re-register all script modules.
 *
 * Engine code (wsServer, player, npcManager, the renderer, networking, ...) is
 * intentionally NOT in this list — reloading those would corrupt live world
 * state. For changes to those files, use `npm run server:dev` (tsx watch).
 */
const CONTENT_ROOTS: readonly string[] = [
    path.resolve(__dirname), // server/src/game/scripts/ (manifest + modules + types)
    path.resolve(GAME_DIR, "skills"), // server/src/game/skills/ (data layer for skills)
    path.resolve(GAME_DIR, "content"), // server/src/game/content/ (boss/encounter data)
];

const isUnderRoot = (filePath: string): boolean => {
    for (const root of CONTENT_ROOTS) {
        const rel = path.relative(root, filePath);
        if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return true;
    }
    return false;
};

const debounce = (fn: () => void, delayMs: number): (() => void) => {
    let timeout: NodeJS.Timeout | undefined;
    return () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = undefined;
            fn();
        }, delayMs);
    };
};

function loadManifestEntries(): ScriptManifestEntry[] {
    delete require.cache[require.resolve(MANIFEST_PATH)];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const manifestModule = require(MANIFEST_PATH);
    const entries: ScriptManifestEntry[] = manifestModule.SCRIPT_MANIFEST ?? [];
    return entries.filter((entry) => (entry.enableWhen ? entry.enableWhen(process.env) : true));
}

/**
 * Deep-invalidate the require cache for every file currently loaded from any
 * of the configured CONTENT_ROOTS. Needed because Node's cache is per-resolved
 * file: invalidating a script module only does not invalidate data files the
 * module imports (e.g. modules/skills/hunter.ts imports skills/hunter.ts).
 */
function invalidateContentCache(): number {
    let cleared = 0;
    for (const key of Object.keys(require.cache)) {
        if (isUnderRoot(key)) {
            delete require.cache[key];
            cleared += 1;
        }
    }
    return cleared;
}

export interface ScriptBootstrapHandle {
    /**
     * Manually trigger a hot reload of all script modules. Performs the same
     * cycle the file-watcher does (deep-invalidate require.cache + re-register
     * every module). Safe to call regardless of SCRIPT_HOT_RELOAD env state.
     * Returns the number of files cleared from the require cache.
     */
    reload(reason?: string): { reloadedModules: number; clearedFiles: number };
}

export function bootstrapScripts(runtime: ScriptRuntime): ScriptBootstrapHandle {
    let loadedCount = 0;

    const loadAll = (label: string = "boot") => {
        const entries = loadManifestEntries();
        runtime.reset();
        for (const entry of entries) {
            try {
                runtime.loadModule(entry.load());
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error(`[script] failed to load module ${entry.id}`, err);
            }
        }
        loadedCount = entries.length;
        // eslint-disable-next-line no-console
        console.log(`[script] ${label}: loaded ${entries.length} module(s)`);
    };

    const manualReload = (reason?: string) => {
        const cleared = invalidateContentCache();
        loadAll(`manual reload${reason ? ` (${reason})` : ""} (cleared ${cleared} cached files)`);
        return { reloadedModules: loadedCount, clearedFiles: cleared };
    };

    loadAll("boot");

    if (process.env.SCRIPT_HOT_RELOAD === "1") {
        const reload = debounce(() => {
            const cleared = invalidateContentCache();
            try {
                loadAll(`hot reload (cleared ${cleared} cached files)`);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[script] hot reload failed", err);
            }
        }, 100);

        const watchRoot = (root: string) => {
            try {
                // recursive is supported on win32 + macOS; harmless if unsupported.
                fs.watch(root, { persistent: false, recursive: true }, (_event, filename) => {
                    if (typeof filename === "string" && !filename.endsWith(".ts") && !filename.endsWith(".js")) {
                        return;
                    }
                    reload();
                });
            } catch (err) {
                // eslint-disable-next-line no-console
                console.warn(`[script] failed to watch ${root}`, err);
            }
        };

        for (const root of CONTENT_ROOTS) {
            watchRoot(root);
        }

        // Also watch the manifest file directly so adding a new module
        // doesn't require touching one of the existing modules first.
        for (const ext of [".ts", ".js"]) {
            try {
                fs.watch(`${MANIFEST_PATH}${ext}`, { persistent: false }, reload);
            } catch {}
        }

        // eslint-disable-next-line no-console
        console.log(
            `[script] hot reload enabled, watching:\n  - ${CONTENT_ROOTS.join("\n  - ")}`,
        );
    }

    return {
        reload: manualReload,
    };
}
