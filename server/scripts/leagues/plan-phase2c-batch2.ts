/**
 * Plan Phase 2C-A Batch 2: verified skilling_action candidates only (no import).
 *
 * Usage: npx tsx server/scripts/leagues/plan-phase2c-batch2.ts
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
import { inferHookRoadmapType } from "./lib/hookRoadmap";

const WIRED_ACTIONS = new Set(["mine", "catch", "chop", "burn", "cook", "fletch", "smith", "spin"]);

/** Batch 1 already live — do not re-import. */
const BATCH1_SOURCE_IDS = new Set([
    656, 801, 684, 941, 1333, 712, 791, 688, 760, 658, 845, 1035, 690, 800, 685, 803, 96, 99, 749,
]);

/** Hard exclusions until content/trigger fixes land. */
const BLOCKED_SOURCE_IDS = new Set([196, 716, 82, 83, 84, 725]);

const MINING_ORE: Record<string, number> = {
    clay: 434,
    "copper ore": 436,
    "tin ore": 438,
    "iron ore": 440,
    "silver ore": 442,
    coal: 453,
    "gold ore": 444,
    "mithril ore": 447,
    "adamantite ore": 449,
    "runite ore": 451,
};

const LOG_BURN: Record<string, number> = {
    logs: 1511,
    "oak logs": 1521,
    "willow logs": 1519,
    "maple logs": 1517,
    "yew logs": 1515,
    "magic logs": 1513,
};

const LOG_CHOP: Record<string, number> = {
    logs: 1511,
    oak: 1521,
    "oak tree": 1521,
    willow: 1519,
    maple: 1517,
    yew: 1515,
    magic: 1513,
    teak: 6333,
    mahogany: 6332,
    redwood: 19669,
};

const FISH_CATCH: Record<string, number> = {
    shrimp: 317,
    anchovies: 321,
    sardine: 327,
    sardines: 327,
    herring: 345,
    trout: 335,
    pike: 349,
    salmon: 331,
    tuna: 359,
    lobster: 377,
    lobsters: 377,
    swordfish: 371,
    monkfish: 7944,
    shark: 383,
    sharks: 383,
};

/** Cook lookup uses COOKING_RECIPES at runtime — tuna is 361 not 362. */
function cookedIdForFish(fishKey: string): number | undefined {
    const recipeIdByKey: Record<string, string> = {
        shrimp: "cook_shrimps",
        anchovies: "cook_anchovies",
        sardine: "cook_sardine",
        sardines: "cook_sardine",
        herring: "cook_herring",
        trout: "cook_trout",
        pike: "cook_pike",
        salmon: "cook_salmon",
        tuna: "cook_tuna",
        lobster: "cook_lobster",
        lobsters: "cook_lobster",
        swordfish: "cook_swordfish",
        monkfish: "cook_monkfish",
        shark: "cook_shark",
        sharks: "cook_shark",
    };
    const recipeId = recipeIdByKey[fishKey];
    if (!recipeId) return undefined;
    return COOKING_RECIPES.find((r) => r.id === recipeId)?.cookedItemId;
}

const FLETCH_PRODUCT: Record<string, number> = {
    "arrow shafts": 52,
    "arrow shaft": 52,
    shortbows: 37,
    longbows: 48,
    "oak shortbows": 54,
    "oak longbows": 56,
    "willow shortbows": 60,
    "willow longbows": 58,
    "maple shortbows": 64,
    "maple longbows": 62,
    "yew shortbows": 68,
    "yew longbows": 66,
    "magic shortbows": 72,
    "magic longbows": 70,
};

type Candidate = {
    csvId: number;
    name: string;
    skill: string;
    action: string;
    targetId: number;
    count?: number;
    proof: string;
};

function normalizeName(s: string): string {
    return s.trim().replace(/\.$/, "").toLowerCase().replace(/\s+/g, " ");
}

function parseCountPrefix(name: string): { rest: string; count?: number } {
    const m = name.match(/^([\d,]+)\s+(.+)$/);
    if (!m) return { rest: name };
    const count = parseInt(m[1].replace(/,/g, ""), 10);
    return { rest: m[2], count: Number.isFinite(count) ? count : undefined };
}

function tryMapCandidate(row: { id: number; name: string }): Candidate | undefined {
    let name = row.name.trim();
    const { rest, count } = parseCountPrefix(name);
    name = rest.replace(/\.$/, "").trim();
    const n = normalizeName(name);

    let m = n.match(/^mine\s+(.+?)(?:\s+(?:in|on|at)\s+.+)?$/);
    if (m) {
        const ore = MINING_ORE[m[1].replace(/\.$/, "")];
        if (ore) {
            return {
                csvId: row.id,
                name: row.name,
                skill: "mining",
                action: "mine",
                targetId: ore,
                count,
                proof: `mining ROCK_DEFINITIONS oreItemId ${ore}`,
            };
        }
    }

    m = n.match(/^chop\s+(?:an?\s+)?(.+?)(?:\s+tree)?(?:\s+(?:in|on|at)\s+.+)?$/);
    if (m) {
        const key = m[1].replace(/\s+tree$/, "").replace(/\.$/, "");
        const logId = LOG_CHOP[key] ?? LOG_CHOP[`${key} tree`];
        if (logId) {
            return {
                csvId: row.id,
                name: row.name,
                skill: "woodcutting",
                action: "chop",
                targetId: logId,
                count,
                proof: `woodcutting tree logItemId ${logId}`,
            };
        }
    }

    m = n.match(/^(?:catch|fish)\s+(?:a\s+)?(.+?)(?:\s+(?:in|on|at)\s+.+)?\.?$/);
    if (m) {
        const fishKey = m[1].replace(/\.$/, "");
        const fish = FISH_CATCH[fishKey];
        if (fish) {
            return {
                csvId: row.id,
                name: row.name,
                skill: "fishing",
                action: "catch",
                targetId: fish,
                count,
                proof: `fishing catch.itemId ${fish}`,
            };
        }
    }

    m = n.match(/^cook\s+(.+?)(?:\s+(?:in|on|at)\s+.+)?\.?$/);
    if (m) {
        const fishKey = m[1].replace(/\.$/, "");
        const cooked = cookedIdForFish(fishKey);
        if (cooked !== undefined) {
            const recipe = COOKING_RECIPES.find((r) => r.cookedItemId === cooked);
            return {
                csvId: row.id,
                name: row.name,
                skill: "cooking",
                action: "cook",
                targetId: cooked,
                count,
                proof: `cooking.recipe ${recipe?.id ?? "?"} cookedItemId ${cooked}`,
            };
        }
    }

    m = n.match(/^burn\s+(.+?)\s+logs(?:\s+(?:in|on|at)\s+.+)?\.?$/);
    if (m) {
        const logId = LOG_BURN[`${m[1]} logs`] ?? LOG_BURN[m[1]];
        if (logId) {
            const def = getFiremakingLogDefinition(logId);
            return {
                csvId: row.id,
                name: row.name,
                skill: "firemaking",
                action: "burn",
                targetId: logId,
                count,
                proof: `firemaking.log ${def?.name ?? logId}`,
            };
        }
    }

    m = n.match(/^fletch\s+(.+?)\.?$/);
    if (m) {
        const product = FLETCH_PRODUCT[m[1].replace(/\.$/, "")];
        if (product) {
            return {
                csvId: row.id,
                name: row.name,
                skill: "fletching",
                action: "fletch",
                targetId: product,
                count,
                proof: `fletching.productItemId ${product}`,
            };
        }
    }

    if (n.includes("spin") && n.includes("bow string")) {
        return {
            csvId: row.id,
            name: row.name,
            skill: "crafting",
            action: "spin",
            targetId: 1777,
            count,
            proof: "crafting spin product 1777 (bow string)",
        };
    }

    return undefined;
}

const MINING_ROCK_IDS = [
    "clay", "copper", "tin", "iron", "silver", "coal", "gold", "mithril", "adamantite", "runite", "amethyst",
];
const FISHING_SPOT_IDS = [
    "sea_small_net", "river_lure_bait", "sea_cage_harpoon", "sea_big_net", "monkfish", "shark",
    "karambwan", "karambwanji", "barbarian_heavy_rod", "minnow",
];
const WOODCUTTING_TREE_IDS = [
    "normal", "oak", "willow", "maple", "yew", "magic", "teak", "mahogany", "achey", "arctic_pine", "redwood",
];

function buildMiningOreItemIds(): Set<number> {
    const ids = new Set<number>();
    for (const rockId of MINING_ROCK_IDS) {
        const rock = getMiningRockById(rockId);
        if (rock?.oreItemId) ids.add(rock.oreItemId);
    }
    return ids;
}

function buildFishingCatchItemIds(): Set<number> {
    const ids = new Set<number>();
    for (const spotId of FISHING_SPOT_IDS) {
        const spot = getFishingSpotById(spotId);
        if (!spot) continue;
        for (const method of spot.methods) {
            for (const c of method.catches) ids.add(c.itemId);
        }
    }
    return ids;
}

function buildWoodcuttingLogItemIds(): Set<number> {
    const ids = new Set<number>();
    for (const treeId of WOODCUTTING_TREE_IDS) {
        const tree = getWoodcuttingTreeById(treeId);
        if (tree?.logItemId) ids.add(tree.logItemId);
    }
    return ids;
}

function buildFletchingProductItemIds(): Set<number> {
    const ids = new Set<number>();
    for (const logId of FLETCHING_LOG_IDS) {
        for (const product of getFletchingProductsForLog(logId) ?? []) ids.add(product.productItemId);
    }
    for (const recipe of FLETCHING_COMBINE_RECIPES) ids.add(recipe.productItemId);
    return ids;
}

const MINING_ORE_ITEM_IDS = buildMiningOreItemIds();
const FISHING_CATCH_ITEM_IDS = buildFishingCatchItemIds();
const WOODCUTTING_LOG_ITEM_IDS = buildWoodcuttingLogItemIds();
const FLETCHING_PRODUCT_ITEM_IDS = buildFletchingProductItemIds();

function verifyRuntime(c: Candidate): { ok: boolean; proof: string } {
    const id = c.targetId | 0;
    switch (c.action) {
        case "mine":
            return MINING_ORE_ITEM_IDS.has(id)
                ? { ok: true, proof: c.proof }
                : { ok: false, proof: "targetId not in mining oreItemId set" };
        case "catch":
            return FISHING_CATCH_ITEM_IDS.has(id)
                ? { ok: true, proof: c.proof }
                : { ok: false, proof: "targetId not in fishing catch definitions" };
        case "cook": {
            const recipe = COOKING_RECIPES.find((r) => r.cookedItemId === id);
            return recipe
                ? { ok: true, proof: `cooking.recipe ${recipe.id} → ${recipe.cookedItemId}` }
                : { ok: false, proof: "no COOKING_RECIPES entry for cookedItemId" };
        }
        case "burn": {
            const def = getFiremakingLogDefinition(id);
            return def || FIREMAKING_LOG_IDS.includes(id)
                ? { ok: true, proof: c.proof }
                : { ok: false, proof: "not in firemaking LOG_DEFINITIONS" };
        }
        case "chop":
            return WOODCUTTING_LOG_ITEM_IDS.has(id)
                ? { ok: true, proof: c.proof }
                : { ok: false, proof: "not in woodcutting logItemId set" };
        case "fletch":
            return FLETCHING_PRODUCT_ITEM_IDS.has(id)
                ? { ok: true, proof: c.proof }
                : { ok: false, proof: "not in fletching productItemId set" };
        case "spin":
            return id === 1777
                ? { ok: true, proof: c.proof }
                : { ok: false, proof: "spin target must be 1777 (bow string)" };
        default:
            return { ok: false, proof: `unsupported action ${c.action}` };
    }
}

function collectLiveSourceIds(repoRoot: string, csvByName: Map<string, number>): Set<number> {
    const live = new Set<number>();
    for (const task of LEAGUE_TASKS) {
        const csvId = csvByName.get(task.name.trim());
        if (csvId !== undefined) live.add(csvId);
    }
    const manifestDir = path.join(repoRoot, "server/data/leagues");
    for (const file of fs.readdirSync(manifestDir)) {
        if (!file.endsWith(".json")) continue;
        const raw = fs.readFileSync(path.join(manifestDir, file), "utf8");
        if (!raw.includes("sourceTaskId")) continue;
        try {
            const parsed = JSON.parse(raw) as { tasks?: Array<{ sourceTaskId?: number }> };
            for (const t of parsed.tasks ?? []) {
                if (t.sourceTaskId !== undefined) live.add(t.sourceTaskId | 0);
            }
        } catch {
            /* skip malformed */
        }
    }
    return live;
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const tasks = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvByName = new Map(tasks.map((r) => [r.name.trim(), r.id] as const));
    const liveSourceIds = collectLiveSourceIds(repoRoot, csvByName);

    const verified: Candidate[] = [];
    const rejected: Array<{ c: Candidate; reason: string }> = [];

    for (const row of tasks) {
        if (BATCH1_SOURCE_IDS.has(row.id) || BLOCKED_SOURCE_IDS.has(row.id)) continue;
        if (liveSourceIds.has(row.id)) continue;
        if (inferHookRoadmapType(row) !== "skilling_action") continue;

        const mapped = tryMapCandidate(row);
        if (!mapped || !WIRED_ACTIONS.has(mapped.action)) continue;

        const runtime = verifyRuntime(mapped);
        if (!runtime.ok) {
            rejected.push({ c: mapped, reason: runtime.proof });
            continue;
        }
        verified.push({ ...mapped, proof: runtime.proof });
    }

    verified.sort((a, b) => a.csvId - b.csvId);

    const targetMin = 30;
    const targetMax = 40;
    const batch2 = verified.slice(0, targetMax);

    console.log("[plan-phase2c-batch2] Phase 2C-A Batch 2 candidate plan (NOT imported)\n");
    console.log(`Live tasks: ${LEAGUE_TASKS.length}`);
    console.log(`Verified pool (excl. live/batch1/blocked): ${verified.length}`);
    console.log(`Proposed Batch 2 slice: ${batch2.length} (target ${targetMin}–${targetMax})\n`);

    console.log(
        "| CSV | Task name | skill/action | targetId | Runtime proof | Duplicates live CSV? |",
    );
    console.log(
        "|-----|-----------|--------------|----------|---------------|----------------------|",
    );

    for (const c of batch2) {
        const dupNote = liveSourceIds.has(c.csvId) ? "YES (skip)" : "no";
        const countNote = c.count ? ` count=${c.count}` : "";
        console.log(
            `| ${c.csvId} | ${c.name} | ${c.skill}/${c.action} | ${c.targetId}${countNote} | ${c.proof} | ${dupNote} |`,
        );
    }

    console.log("");
    console.log(`Expected ready after import: ${LEAGUE_TASKS.length} → ${LEAGUE_TASKS.length + batch2.length}`);
    console.log(`CSV ids: ${batch2.map((c) => c.csvId).join(", ")}`);

    const reserve = verified.slice(targetMax);
    if (reserve.length > 0) {
        console.log(`\n=== Reserve (${reserve.length} verified, not in Batch 2 slice) ===`);
        for (const c of reserve) {
            console.log(`  ${c.csvId} ${c.name} → ${c.skill}/${c.action}/${c.targetId}`);
        }
    }

    if (rejected.length > 0) {
        console.log("\n=== REJECTED (sample) ===");
        for (const { c, reason } of rejected.slice(0, 15)) {
            console.log(`  ${c.csvId} ${c.name}: ${reason}`);
        }
        if (rejected.length > 15) console.log(`  ... and ${rejected.length - 15} more`);
    }

    if (batch2.length < targetMin) {
        console.error(`\n[plan-phase2c-batch2] WARN: only ${batch2.length} verified candidates (wanted ${targetMin}+)`);
        process.exit(1);
    }
}

main();
