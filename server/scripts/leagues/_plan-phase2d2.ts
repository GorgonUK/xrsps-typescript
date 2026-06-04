/**
 * Phase 2D-2 decision scan (read-only). Usage: npx tsx server/scripts/leagues/_plan-phase2d2.ts
 */
import fs from "fs";
import path from "path";

import { COOKING_RECIPES } from "../../src/game/skills/skillSurfaces";
import { FIREMAKING_LOG_IDS, getFiremakingLogDefinition } from "../../src/game/skills/firemaking";
import { getFishingSpotById } from "../../src/game/skills/fishing";
import { getMiningRockById } from "../../src/game/skills/mining";
import { getWoodcuttingTreeById } from "../../src/game/skills/woodcutting";
import {
    FLETCHING_COMBINE_RECIPES,
    FLETCHING_LOG_IDS,
    getFletchingProductsForLog,
} from "../../src/game/skills/fletching";
import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { parseCsvFile } from "./lib/csv";
import { parseValidationReport } from "./lib/parseValidation";

const REGION = /\b(in|at|on|near|from)\s+(the\s+)?[A-Za-z]/i;
const COUNT_PATTERN = /^(\d+|1,000|10,000)\s+/i;
const BLOCKED = new Set([196, 716, 82, 83, 84, 725]);

const MINING_ORE: Record<string, number> = {
    clay: 434, "copper ore": 436, copper: 436, "tin ore": 438, tin: 438,
    "iron ore": 440, iron: 440, "silver ore": 442, silver: 442, coal: 453,
    "gold ore": 444, gold: 444, "mithril ore": 447, mithril: 447,
    "adamantite ore": 449, adamantite: 449, "runite ore": 451, runite: 451,
};
const LOG_BURN: Record<string, number> = {
    logs: 1511, "oak logs": 1521, "willow logs": 1519, "maple logs": 1517,
    "yew logs": 1515, "magic logs": 1513, teak: 6333, mahogany: 6332,
    "arctic pine logs": 6333,
};
const LOG_CHOP: Record<string, number> = {
    logs: 1511, oak: 1521, "oak tree": 1521, willow: 1519, maple: 1517,
    yew: 1515, magic: 1513, teak: 6333, mahogany: 6332, redwood: 19669,
    "arctic pine": 6333, "arctic pine trees": 6333,
};
const FISH_CATCH: Record<string, number> = {
    shrimp: 317, anchovies: 321, sardine: 327, sardines: 327, herring: 345,
    trout: 335, pike: 349, salmon: 331, tuna: 359, lobster: 377, lobsters: 377,
    swordfish: 371, monkfish: 7944, shark: 383, sharks: 383,
};
const SMITH_PRODUCT: Record<string, number> = {
    "iron platebody": 1115, "mithril item": 1143, "mithril platebody": 1121,
    "adamant item": 1123, "rune item": 1127, "mithril armor": 1121, "rune armor": 1127,
};

function cookedIdForFish(fishKey: string): number | undefined {
    const recipeIdByKey: Record<string, string> = {
        shrimp: "cook_shrimps", anchovies: "cook_anchovies", sardine: "cook_sardine",
        herring: "cook_herring", trout: "cook_trout", pike: "cook_pike", salmon: "cook_salmon",
        tuna: "cook_tuna", lobster: "cook_lobster", swordfish: "cook_swordfish",
        monkfish: "cook_monkfish", shark: "cook_shark",
    };
    const recipeId = recipeIdByKey[fishKey];
    if (!recipeId) return undefined;
    return COOKING_RECIPES.find((r) => r.id === recipeId)?.cookedItemId;
}

function extractLocation(name: string): { base: string; location?: string } {
    const m = name.match(/^(.+?)\s+(?:in|on|at|near|from)\s+(.+?)\.?$/i);
    if (!m) return { base: name };
    return { base: m[1].trim(), location: m[2].trim().replace(/\.$/, "") };
}

function parseCountPrefix(name: string): { rest: string; count?: number } {
    const m = name.match(COUNT_PATTERN);
    if (!m) return { rest: name };
    return { rest: name.slice(m[0].length), count: parseInt(m[1].replace(/,/g, ""), 10) };
}

type Candidate = {
    csvId: number;
    name: string;
    skill: string;
    action: string;
    targetId: number;
    count?: number;
    location?: string;
    hasLocation: boolean;
    proof: string;
    parserGap: string;
};

function tryMap(row: { id: number; name: string }): Candidate | undefined {
    let name = row.name.trim();
    const { rest, count } = parseCountPrefix(name);
    name = rest.replace(/\.$/, "").trim();
    const { base, location } = extractLocation(name);
    const n = base.toLowerCase().replace(/\s+/g, " ");

    let m = n.match(/^mine\s+(.+?)$/);
    if (m) {
        const ore = MINING_ORE[m[1].replace(/\.$/, "")];
        if (ore) return { csvId: row.id, name: row.name, skill: "mining", action: "mine", targetId: ore, count, location, hasLocation: !!location, proof: `mining ore ${ore}`, parserGap: "existing" };
    }
    m = n.match(/^chop\s+(?:an?\s+)?(.+?)(?:\s+trees?)?$/);
    if (m) {
        const key = m[1].replace(/\s+trees?$/, "").replace(/\.$/, "");
        if (key === "tree" || key === "a tree") {
            return { csvId: row.id, name: row.name, skill: "woodcutting", action: "chop", targetId: 1511, count, location, hasLocation: !!location, proof: "chop logs 1511", parserGap: "existing" };
        }
        const logId = LOG_CHOP[key] ?? LOG_CHOP[`${key} tree`];
        if (logId) return { csvId: row.id, name: row.name, skill: "woodcutting", action: "chop", targetId: logId, count, location, hasLocation: !!location, proof: `chop ${logId}`, parserGap: "existing" };
    }
    m = n.match(/^(?:catch|fish)\s+(?:a\s+)?(.+?)$/);
    if (m) {
        const fish = FISH_CATCH[m[1].replace(/\.$/, "")];
        if (fish) return { csvId: row.id, name: row.name, skill: "fishing", action: "catch", targetId: fish, count, location, hasLocation: !!location, proof: `catch ${fish}`, parserGap: "existing" };
    }
    m = n.match(/^cook\s+(.+?)$/);
    if (m) {
        const cooked = cookedIdForFish(m[1].replace(/\.$/, ""));
        if (cooked) return { csvId: row.id, name: row.name, skill: "cooking", action: "cook", targetId: cooked, count, location, hasLocation: !!location, proof: `cook ${cooked}`, parserGap: "existing" };
    }
    m = n.match(/^burn\s+(?:an?\s+)?(.+?)(?:\s+logs?)?$/);
    if (m) {
        const key = m[1].replace(/\s+logs?$/, "");
        const logId = LOG_BURN[`${key} logs`] ?? LOG_BURN[key] ?? LOG_BURN[`${key} log`];
        if (logId) return { csvId: row.id, name: row.name, skill: "firemaking", action: "burn", targetId: logId, count, location, hasLocation: !!location, proof: `burn ${logId}`, parserGap: "existing" };
    }
    m = n.match(/^smith\s+(?:an?\s+)?(.+?)$/);
    if (m) {
        const product = SMITH_PRODUCT[m[1].replace(/\.$/, "")];
        if (product) return { csvId: row.id, name: row.name, skill: "smithing", action: "smith", targetId: product, count, location, hasLocation: !!location, proof: `smith ${product}`, parserGap: "smith-map" };
    }
    return undefined;
}

function collectImportedSourceIds(repoRoot: string): Set<number> {
    const ids = new Set<number>();
    for (const file of ["phase2-skilling-tasks.json", "phase2c-skilling-tasks.json", "phase2d-skilling-tasks.json"]) {
        const p = path.join(repoRoot, "server/data/leagues", file);
        if (!fs.existsSync(p)) continue;
        const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as { tasks?: Array<{ sourceTaskId?: number }> };
        for (const t of parsed.tasks ?? []) if (t.sourceTaskId) ids.add(t.sourceTaskId);
    }
    return ids;
}

function buildRuntimeSets() {
    const mining = new Set<number>();
    for (const rockId of ["clay","copper","tin","iron","silver","coal","gold","mithril","adamantite","runite"]) {
        const r = getMiningRockById(rockId);
        if (r?.oreItemId) mining.add(r.oreItemId);
    }
    const fishing = new Set<number>();
    for (const spotId of ["sea_small_net","river_lure_bait","sea_cage_harpoon","sea_big_net","monkfish","shark","karambwan","barbarian_heavy_rod"]) {
        const s = getFishingSpotById(spotId);
        for (const m of s?.methods ?? []) for (const c of m.catches) fishing.add(c.itemId);
    }
    const wc = new Set<number>();
    for (const treeId of ["normal","oak","willow","maple","yew","magic","teak","mahogany","arctic_pine","redwood"]) {
        const t = getWoodcuttingTreeById(treeId);
        if (t?.logItemId) wc.add(t.logItemId);
    }
    return { mining, fishing, wc };
}

function verifyRuntime(c: Candidate, sets: ReturnType<typeof buildRuntimeSets>): boolean {
    const id = c.targetId;
    switch (c.action) {
        case "mine": return sets.mining.has(id);
        case "catch": return sets.fishing.has(id);
        case "chop": return sets.wc.has(id);
        case "cook": return COOKING_RECIPES.some((r) => r.cookedItemId === id);
        case "burn": return !!getFiremakingLogDefinition(id) || FIREMAKING_LOG_IDS.includes(id);
        case "smith": return id > 0; // smith products verified at import time
        default: return false;
    }
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const rows = parseValidationReport(path.join(repoRoot, "server/data/leagues/reports/validate-tasks-latest.csv"));
    const csv = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csv.map((r) => [r.id, r]));
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));
    const imported = collectImportedSourceIds(repoRoot);
    const sets = buildRuntimeSets();

    const skillsNeedHook = rows.filter((r) => r.status === "need_hook" && csvById.get(r.task_id)?.area !== undefined);
    const skillsAmbiguous = rows.filter((r) => r.status === "ambiguous" && csvById.get(r.task_id));

    const mapped: Candidate[] = [];
    const unmapped: Array<{ id: number; name: string; reason: string }> = [];

    for (const row of rows) {
        if (row.status !== "need_hook" && row.status !== "ambiguous") continue;
        const c = csvById.get(row.task_id);
        if (!c) continue;
        if (liveNames.has(c.name.trim()) || imported.has(row.task_id) || BLOCKED.has(row.task_id)) continue;
        const m = tryMap(c);
        if (!m) {
            if (c.name.match(/^(Mine|Chop|Catch|Fish|Cook|Burn|Fletch|Smith|Spin)/i)) {
                unmapped.push({ id: row.task_id, name: c.name, reason: row.status });
            }
            continue;
        }
        if (!verifyRuntime(m, sets)) {
            unmapped.push({ id: row.task_id, name: c.name, reason: "runtime verify fail" });
            continue;
        }
        mapped.push(m);
    }

    mapped.sort((a, b) => a.csvId - b.csvId);
    const locationTagged = mapped.filter((m) => m.hasLocation);
    const generic = mapped.filter((m) => !m.hasLocation);

    console.log(JSON.stringify({
        skillsNeedHook: rows.filter((r) => r.status === "need_hook").length,
        skillsAmbiguousItem: rows.filter((r) => r.status === "ambiguous" && r.matched_hook?.includes("onItem")).length,
        mappableTotal: mapped.length,
        locationTagged: locationTagged.length,
        generic: generic.length,
        unmappedSkillingVerb: unmapped.length,
        slice1LocationFirst40: locationTagged.slice(0, 40).map((m) => ({
            id: m.csvId, name: m.name, trigger: `${m.skill}/${m.action}/${m.targetId}`, loc: m.location,
        })),
        allMappedIds: mapped.map((m) => m.csvId),
    }, null, 2));
}

main();
