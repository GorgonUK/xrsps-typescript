/**
 * Verify Phase 2C-A candidate targetIds resolve to live server skill definitions.
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase2c-target-content.ts
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

type Candidate = {
    sourceTaskId: number;
    name: string;
    skill: string;
    action: string;
    targetId: number;
    count?: number;
};

/** Top 50 safest 2C-A imports from roadmap analysis. */
const TOP_50_CANDIDATES: Candidate[] = [
    { sourceTaskId: 107, name: "Fletch Arrow Shafts.", skill: "fletching", action: "fletch", targetId: 52 },
    { sourceTaskId: 196, name: "Cook Sardines.", skill: "cooking", action: "cook", targetId: 325 },
    { sourceTaskId: 656, name: "Fish Shrimp in Lumbridge.", skill: "fishing", action: "catch", targetId: 317 },
    { sourceTaskId: 658, name: "Burn Logs in Varrock.", skill: "firemaking", action: "burn", targetId: 1511 },
    { sourceTaskId: 684, name: "Catch Trout in Barbarian Village.", skill: "fishing", action: "catch", targetId: 335 },
    { sourceTaskId: 688, name: "Mine Iron Ore in Varrock Mine.", skill: "mining", action: "mine", targetId: 440 },
    { sourceTaskId: 712, name: "Fish Shrimp on Karamja.", skill: "fishing", action: "catch", targetId: 317 },
    { sourceTaskId: 760, name: "Mine Iron Ore on Karamja.", skill: "mining", action: "mine", targetId: 440 },
    { sourceTaskId: 791, name: "Mine Clay in the Dwarven Mine.", skill: "mining", action: "mine", targetId: 434 },
    { sourceTaskId: 801, name: "Fish Sardines in Port Sarim.", skill: "fishing", action: "catch", targetId: 327 },
    { sourceTaskId: 845, name: "Burn Oak Logs in Port Sarim.", skill: "firemaking", action: "burn", targetId: 1521 },
    { sourceTaskId: 941, name: "Fish Trout in Kandarin.", skill: "fishing", action: "catch", targetId: 335 },
    { sourceTaskId: 1035, name: "Burn Oak Logs in the Desert.", skill: "firemaking", action: "burn", targetId: 1521 },
    { sourceTaskId: 1333, name: "Fish Trout in Kourend.", skill: "fishing", action: "catch", targetId: 335 },
    { sourceTaskId: 104, name: "Chop 25 Trees", skill: "woodcutting", action: "chop", targetId: 1511, count: 25 },
    { sourceTaskId: 82, name: "Mine Sandstone", skill: "mining", action: "mine", targetId: 6971 },
    { sourceTaskId: 83, name: "Mine Gem rocks", skill: "mining", action: "mine", targetId: 1625 },
    { sourceTaskId: 84, name: "Mine Granite", skill: "mining", action: "mine", targetId: 6979 },
    { sourceTaskId: 96, name: "Chop a Mahogany Tree", skill: "woodcutting", action: "chop", targetId: 6332 },
    { sourceTaskId: 99, name: "Chop a Redwood Tree", skill: "woodcutting", action: "chop", targetId: 19669 },
    { sourceTaskId: 685, name: "Cook Lobsters in Edgeville.", skill: "cooking", action: "cook", targetId: 379 },
    { sourceTaskId: 690, name: "Burn Willow Logs in Draynor.", skill: "firemaking", action: "burn", targetId: 1519 },
    { sourceTaskId: 713, name: "Catch Tuna on Karamja.", skill: "fishing", action: "catch", targetId: 359 },
    { sourceTaskId: 714, name: "Catch Lobsters on Karamja.", skill: "fishing", action: "catch", targetId: 377 },
    { sourceTaskId: 715, name: "Catch Swordfish on Karamja.", skill: "fishing", action: "catch", targetId: 371 },
    { sourceTaskId: 716, name: "Cook Tuna on Karamja.", skill: "cooking", action: "cook", targetId: 362 },
    { sourceTaskId: 717, name: "Cook Lobsters on Karamja.", skill: "cooking", action: "cook", targetId: 379 },
    { sourceTaskId: 718, name: "Cook Swordfish on Karamja.", skill: "cooking", action: "cook", targetId: 373 },
    { sourceTaskId: 724, name: "Mine Gold Ore in Karamja Volcano.", skill: "mining", action: "mine", targetId: 444 },
    { sourceTaskId: 725, name: "Mine Gem Rocks in Shilo Village.", skill: "mining", action: "mine", targetId: 1625 },
    { sourceTaskId: 749, name: "Catch Salmon on Karamja.", skill: "fishing", action: "catch", targetId: 331 },
    { sourceTaskId: 757, name: "Catch Lobsters at Musa Point.", skill: "fishing", action: "catch", targetId: 377 },
    { sourceTaskId: 761, name: "Mine Mithril Ore on Karamja.", skill: "mining", action: "mine", targetId: 447 },
    { sourceTaskId: 792, name: "Mine Coal in the Mining Guild.", skill: "mining", action: "mine", targetId: 453 },
    { sourceTaskId: 793, name: "Mine Mithril Ore in the Mining Guild.", skill: "mining", action: "mine", targetId: 447 },
    { sourceTaskId: 794, name: "Mine Adamantite Ore in the Mining Guild.", skill: "mining", action: "mine", targetId: 449 },
    { sourceTaskId: 800, name: "Burn Willow Logs in Falador.", skill: "firemaking", action: "burn", targetId: 1519 },
    { sourceTaskId: 802, name: "Fish Lobsters in Port Sarim.", skill: "fishing", action: "catch", targetId: 377 },
    { sourceTaskId: 803, name: "Cook Lobsters in Port Sarim.", skill: "cooking", action: "cook", targetId: 379 },
    { sourceTaskId: 867, name: "Mine Coal in Fremennik.", skill: "mining", action: "mine", targetId: 453 },
    { sourceTaskId: 868, name: "Mine Mithril Ore in Fremennik.", skill: "mining", action: "mine", targetId: 447 },
    { sourceTaskId: 869, name: "Mine Adamantite Ore in Fremennik.", skill: "mining", action: "mine", targetId: 449 },
    { sourceTaskId: 871, name: "Catch Lobsters in Fremennik.", skill: "fishing", action: "catch", targetId: 377 },
    { sourceTaskId: 872, name: "Catch Sharks in Fremennik.", skill: "fishing", action: "catch", targetId: 383 },
    { sourceTaskId: 873, name: "Cook Sharks in Fremennik.", skill: "cooking", action: "cook", targetId: 385 },
    { sourceTaskId: 916, name: "Catch Monkfish in Fremennik.", skill: "fishing", action: "catch", targetId: 7944 },
    { sourceTaskId: 917, name: "Burn Yew Logs in Fremennik.", skill: "firemaking", action: "burn", targetId: 1515 },
    { sourceTaskId: 918, name: "Mine Runite Ore in Fremennik.", skill: "mining", action: "mine", targetId: 451 },
    { sourceTaskId: 938, name: "Mine Coal in Kandarin.", skill: "mining", action: "mine", targetId: 453 },
    { sourceTaskId: 939, name: "Mine Mithril Ore in Kandarin.", skill: "mining", action: "mine", targetId: 447 },
];

/** Batch 1 smoke-test subset (20 tasks). */
const BATCH_1_IDS = new Set([
    656, 801, 684, 941, 1333, 712, // fish shrimp/sardines/trout
    791, 688, 760, // mine clay/iron
    658, 845, 1035, 690, 800, // burn logs/oak/willow
    196, 685, 803, // cook sardines/lobsters
    96, 99, // chop mahogany/redwood
]);

const MINING_ROCK_IDS = [
    "clay",
    "copper",
    "tin",
    "iron",
    "silver",
    "coal",
    "gold",
    "mithril",
    "adamantite",
    "runite",
    "amethyst",
];

const FISHING_SPOT_IDS = [
    "sea_small_net",
    "river_lure_bait",
    "sea_cage_harpoon",
    "sea_big_net",
    "monkfish",
    "shark",
    "karambwan",
    "karambwanji",
    "barbarian_heavy_rod",
    "minnow",
];

const WOODCUTTING_TREE_IDS = [
    "normal",
    "oak",
    "willow",
    "maple",
    "yew",
    "magic",
    "teak",
    "mahogany",
    "achey",
    "arctic_pine",
    "redwood",
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
            for (const c of method.catches) {
                ids.add(c.itemId);
            }
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
        for (const product of getFletchingProductsForLog(logId) ?? []) {
            ids.add(product.productItemId);
        }
    }
    for (const recipe of FLETCHING_COMBINE_RECIPES) {
        ids.add(recipe.productItemId);
    }
    return ids;
}

const MINING_ORE_ITEM_IDS = buildMiningOreItemIds();
const FISHING_CATCH_ITEM_IDS = buildFishingCatchItemIds();
const WOODCUTTING_LOG_ITEM_IDS = buildWoodcuttingLogItemIds();
const FLETCHING_PRODUCT_ITEM_IDS = buildFletchingProductItemIds();

type VerifyResult = {
    ok: boolean;
    detail: string;
    runtimeTargetId?: number;
};

function verifyTarget(c: Candidate): VerifyResult {
    const id = c.targetId | 0;

    switch (c.action) {
        case "mine": {
            if (MINING_ORE_ITEM_IDS.has(id)) {
                return { ok: true, detail: "mining.oreItemId", runtimeTargetId: id };
            }
            return {
                ok: false,
                detail: "not in mining ROCK_DEFINITIONS oreItemId set (missing rock content: sandstone/granite/gem?)",
            };
        }
        case "catch": {
            if (FISHING_CATCH_ITEM_IDS.has(id)) {
                return { ok: true, detail: "fishing.catch.itemId", runtimeTargetId: id };
            }
            return { ok: false, detail: "not in fishing catch definitions" };
        }
        case "cook": {
            const recipe = COOKING_RECIPES.find((r) => r.cookedItemId === id);
            if (recipe) {
                return {
                    ok: true,
                    detail: `cooking.recipe ${recipe.id}`,
                    runtimeTargetId: recipe.cookedItemId,
                };
            }
            return {
                ok: false,
                detail: "no COOKING_RECIPES entry with this cookedItemId (recipe may be missing entirely)",
            };
        }
        case "burn": {
            const def = getFiremakingLogDefinition(id);
            if (def) {
                return { ok: true, detail: `firemaking.log ${def.name}`, runtimeTargetId: def.logId };
            }
            if (FIREMAKING_LOG_IDS.includes(id)) {
                return { ok: true, detail: "firemaking.log", runtimeTargetId: id };
            }
            return { ok: false, detail: "not in firemaking LOG_DEFINITIONS" };
        }
        case "chop": {
            if (WOODCUTTING_LOG_ITEM_IDS.has(id)) {
                return { ok: true, detail: "woodcutting.logItemId", runtimeTargetId: id };
            }
            return { ok: false, detail: "not in woodcutting tree logItemId set" };
        }
        case "fletch": {
            if (FLETCHING_PRODUCT_ITEM_IDS.has(id)) {
                return { ok: true, detail: "fletching.productItemId", runtimeTargetId: id };
            }
            return { ok: false, detail: "not in fletching recipe productItemId set" };
        }
        default:
            return { ok: false, detail: `unsupported action ${c.action}` };
    }
}

function main(): void {
    void fs; // keep import for future report output
    const repoRoot = path.resolve(__dirname, "../../..");
    void repoRoot;

    let failCount = 0;
    const failures: Array<{ c: Candidate; result: VerifyResult }> = [];
    const batch1Failures: Array<{ c: Candidate; result: VerifyResult }> = [];

    console.log("[verify-phase2c-target-content] Top 50 candidate targetId check\n");
    console.log("| OK | ID | Task | skill/action | targetId | detail |");
    console.log("|----|-----|------|--------------|----------|--------|");

    for (const c of TOP_50_CANDIDATES) {
        const result = verifyTarget(c);
        const mark = result.ok ? "yes" : "NO";
        console.log(
            `| ${mark} | ${c.sourceTaskId} | ${c.name} | ${c.skill}/${c.action} | ${c.targetId} | ${result.detail} |`,
        );
        if (!result.ok) {
            failCount++;
            failures.push({ c, result });
            if (BATCH_1_IDS.has(c.sourceTaskId)) {
                batch1Failures.push({ c, result });
            }
        }
    }

    console.log("");
    console.log(`Summary: ${TOP_50_CANDIDATES.length - failCount}/${TOP_50_CANDIDATES.length} resolve to live content`);
    console.log(`Batch 1 subset: ${BATCH_1_IDS.size} tasks, ${batch1Failures.length} blocked`);

    if (failures.length > 0) {
        console.log("\n=== FAILURES (do not import until resolved) ===");
        for (const { c, result } of failures) {
            console.log(`  ${c.sourceTaskId} ${c.name} → targetId ${c.targetId}: ${result.detail}`);
        }
    }

    if (batch1Failures.length > 0) {
        console.log("\n=== BATCH 1 BLOCKERS ===");
        for (const { c, result } of batch1Failures) {
            console.log(`  ${c.sourceTaskId} ${c.name}: ${result.detail}`);
        }
    }

    // Flag cook id mismatches where a nearby recipe exists
    console.log("\n=== COOK TARGET MISMATCH NOTES ===");
    for (const c of TOP_50_CANDIDATES.filter((x) => x.action === "cook")) {
        const recipe = COOKING_RECIPES.find((r) => r.cookedItemId === c.targetId);
        if (recipe) continue;
        const byName = COOKING_RECIPES.find((r) =>
            c.name.toLowerCase().includes(r.name.toLowerCase()),
        );
        if (byName) {
            console.log(
                `  ${c.sourceTaskId} ${c.name}: manifest target ${c.targetId} but runtime emits cookedItemId ${byName.cookedItemId} (${byName.id})`,
            );
        }
    }

    if (failCount > 0) {
        process.exit(1);
    }
    console.log("\n[verify-phase2c-target-content] All Top 50 targets resolve");
}

main();
