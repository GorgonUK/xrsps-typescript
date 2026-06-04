import fs from "fs";
import path from "path";

import { getCacheLoaderFactory } from "../../../../src/rs/cache/loader/CacheLoaderFactory";
import {
    buildNameLookups,
    type TriggerParserLoaders,
} from "../../../src/game/leagues/triggers/TriggerParser";
import { initCacheEnv } from "../../../src/world/CacheEnv";
import collectionLogData from "../../../../src/shared/collectionlog/collection-log.json";
import { loadLeagueObtainAllowlistItemIds } from "./leagueObtainAllowlist";
import { loadLeagueNpcKillAllowlistSourceIds } from "./leagueNpcKillAllowlist";

export type ValidationRegistries = {
    loaders: TriggerParserLoaders;
    npcName: (name: string) => string;
    getNpcIdsByName: (name: string) => number[];
    getItemIdsByName: (name: string) => number[];
    getNpcName: (id: number) => string;
    getItemName: (id: number) => string;
    spawnedNpcIds: Set<number>;
    collectionLogItemIds: Set<number>;
    pickpocketNpcIds: Set<number>;
    pickpocketDisplayNames: string[];
    manualDropItemNames: Set<string>;
    leagueObtainAllowlistItemIds: Set<number>;
    leagueNpcKillAllowlistSourceIds: Set<number>;
    cacheAvailable: boolean;
};

function normalizeEntityName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function loadNpcSpawns(repoRoot: string): Set<number> {
    const spawnPath = path.join(repoRoot, "server/data/npc-spawns.json");
    const spawned = new Set<number>();
    if (!fs.existsSync(spawnPath)) return spawned;
    const raw = JSON.parse(fs.readFileSync(spawnPath, "utf8")) as Array<{ id?: number }>;
    for (const entry of raw) {
        const id = entry.id;
        if (typeof id === "number" && id >= 0) spawned.add(id);
    }
    return spawned;
}

function loadCollectionLogItemIds(): Set<number> {
    const ids = new Set<number>();
    const categories = (collectionLogData as { categories?: Array<{ itemIds?: number[] }> })
        .categories;
    if (!Array.isArray(categories)) return ids;
    for (const cat of categories) {
        for (const itemId of cat.itemIds ?? []) {
            if (itemId > 0) ids.add(itemId);
        }
    }
    return ids;
}

function loadPickpocketFromThieving(repoRoot: string): {
    npcIds: Set<number>;
    displayNames: string[];
} {
    const npcIds = new Set<number>();
    const displayNames: string[] = [];
    const filePath = path.join(repoRoot, "server/src/game/scripts/modules/thieving.ts");
    if (!fs.existsSync(filePath)) return { npcIds, displayNames };
    const src = fs.readFileSync(filePath, "utf8");
    const nameMatches = src.matchAll(/displayName:\s*"([^"]+)"/g);
    for (const m of nameMatches) displayNames.push(m[1]);
    const idMatches = src.matchAll(/npcIds:\s*\[([\s\S]*?)\]/g);
    for (const m of idMatches) {
        const nums = m[1].match(/\d+/g);
        if (!nums) continue;
        for (const n of nums) npcIds.add(parseInt(n, 10));
    }
    return { npcIds, displayNames };
}

function loadManualDropItemNames(repoRoot: string): Set<string> {
    const names = new Set<string>();
    const manualPath = path.join(repoRoot, "server/src/game/drops/manualTables.ts");
    if (!fs.existsSync(manualPath)) return names;
    const src = fs.readFileSync(manualPath, "utf8");
    for (const m of src.matchAll(/drop\(\s*"([^"]+)"/g)) {
        names.add(normalizeEntityName(m[1]));
    }
    for (const m of src.matchAll(/itemName:\s*"([^"]+)"/g)) {
        names.add(normalizeEntityName(m[1]));
    }
    return names;
}

export function buildRegistries(repoRoot: string): ValidationRegistries {
    let cacheAvailable = false;
    let loaders: TriggerParserLoaders = {
        getNpcIdsByName: () => [],
        getItemIdsByName: () => [],
    };
    const npcIdToName = new Map<number, string>();
    const itemIdToName = new Map<number, string>();

    try {
        const cacheEnv = initCacheEnv(path.join(repoRoot, "caches"));
        const cacheFactory = getCacheLoaderFactory(cacheEnv.info, cacheEnv.cacheSystem as never);
        const npcTypeLoader = cacheFactory.getNpcTypeLoader?.();
        const objTypeLoader = cacheFactory.getObjTypeLoader?.();
        if (npcTypeLoader && objTypeLoader) {
            loaders = buildNameLookups(npcTypeLoader, objTypeLoader);
            cacheAvailable = true;
            for (let id = 0; id < 20000; id++) {
                const npc = npcTypeLoader.load(id);
                if (npc?.name && npc.name !== "null") npcIdToName.set(id, npc.name);
            }
            for (let id = 0; id < 30000; id++) {
                const item = objTypeLoader.load(id);
                if (item?.name && item.name !== "null") itemIdToName.set(id, item.name);
            }
        }
    } catch (err) {
        console.log(`[validate-tasks] Cache unavailable: ${(err as Error).message}`);
    }

    const pickpocket = loadPickpocketFromThieving(repoRoot);

    return {
        loaders,
        npcName: normalizeEntityName,
        getNpcIdsByName: (name) => loaders.getNpcIdsByName(name),
        getItemIdsByName: (name) => loaders.getItemIdsByName(name),
        getNpcName: (id) => npcIdToName.get(id) ?? `npc:${id}`,
        getItemName: (id) => itemIdToName.get(id) ?? `item:${id}`,
        spawnedNpcIds: loadNpcSpawns(repoRoot),
        collectionLogItemIds: loadCollectionLogItemIds(),
        pickpocketNpcIds: pickpocket.npcIds,
        pickpocketDisplayNames: pickpocket.displayNames,
        manualDropItemNames: loadManualDropItemNames(repoRoot),
        leagueObtainAllowlistItemIds: loadLeagueObtainAllowlistItemIds(),
        leagueNpcKillAllowlistSourceIds: loadLeagueNpcKillAllowlistSourceIds(),
        cacheAvailable,
    };
}
