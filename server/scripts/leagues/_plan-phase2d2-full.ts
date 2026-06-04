/**
 * Phase 2D-2 full decision scan (read-only).
 * Usage: npx tsx server/scripts/leagues/_plan-phase2d2-full.ts
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
import { categorizeTask } from "./lib/categorize";
import { inferHookRoadmapType } from "./lib/hookRoadmap";

const BLOCKED = new Set([196, 716, 82, 83, 84, 725]);
const WIRED_ACTIONS = new Set(["mine", "catch", "chop", "burn", "cook", "fletch", "smith", "spin", "pickpocket"]);

const MINING_ORE: Record<string, number> = {
    clay: 434, "copper ore": 436, copper: 436, "tin ore": 438, tin: 438,
    "iron ore": 440, iron: 440, "silver ore": 442, silver: 442, coal: 453,
    "gold ore": 444, gold: 444, "mithril ore": 447, mithril: 447,
    "adamantite ore": 449, adamantite: 449, "runite ore": 451, runite: 451,
    amethyst: 21347,
};
const LOG_BURN: Record<string, number> = {
    logs: 1511, "oak logs": 1521, "willow logs": 1519, "maple logs": 1517,
    "yew logs": 1515, "magic logs": 1513, teak: 6333, mahogany: 6332,
    "arctic pine logs": 6333, "arctic pine log": 6333,
};
const LOG_CHOP: Record<string, number> = {
    logs: 1511, oak: 1521, "oak tree": 1521, willow: 1519, maple: 1517,
    yew: 1515, magic: 1513, teak: 6333, mahogany: 6332, redwood: 19669,
    "arctic pine": 6333, "arctic pine trees": 6333, "arctic pine tree": 6333,
};
const FISH_CATCH: Record<string, number> = {
    shrimp: 317, anchovies: 321, sardine: 327, sardines: 327, herring: 345,
    trout: 335, pike: 349, salmon: 331, tuna: 359, lobster: 377, lobsters: 377,
    swordfish: 371, monkfish: 7944, shark: 383, sharks: 383, karambwan: 3142,
    karambwanji: 3150, minnow: 21356, anglerfish: 13441,
};
const SMITH_PRODUCT: Record<string, number> = {
    "iron platebody": 1115, "mithril item": 1143, "mithril platebody": 1121,
    "adamant item": 1123, "rune item": 1127, "mithril armor": 1121, "rune armor": 1127,
    "iron item": 1115, "steel item": 1119, "bronze item": 1117,
};
const FLETCH_PRODUCT: Record<string, number> = {
    "arrow shafts": 52, "arrow shaft": 52, shortbows: 37, longbows: 48,
    "oak shortbows": 54, "oak longbows": 56, "willow shortbows": 60, "willow longbows": 58,
    "maple shortbows": 64, "maple longbows": 62, "yew shortbows": 68, "yew longbows": 66,
    "magic shortbows": 72, "magic longbows": 70,
};

function cookedIdForFish(fishKey: string): number | undefined {
    const recipeIdByKey: Record<string, string> = {
        shrimp: "cook_shrimps", anchovies: "cook_anchovies", sardine: "cook_sardine",
        sardines: "cook_sardine", herring: "cook_herring", trout: "cook_trout",
        pike: "cook_pike", salmon: "cook_salmon", tuna: "cook_tuna",
        lobster: "cook_lobster", lobsters: "cook_lobster", swordfish: "cook_swordfish",
        monkfish: "cook_monkfish", shark: "cook_shark", sharks: "cook_shark",
        karambwan: "cook_karambwan", anglerfish: "cook_anglerfish",
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
    const m = name.match(/^([\d,]+)\s+(.+)$/);
    if (!m) return { rest: name };
    const count = parseInt(m[1].replace(/,/g, ""), 10);
    return { rest: m[2], count: Number.isFinite(count) ? count : undefined };
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
    confidence: "high" | "medium" | "low";
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
        if (ore) return { csvId: row.id, name: row.name, skill: "mining", action: "mine", targetId: ore, count, location, hasLocation: !!location, proof: `mining oreItemId ${ore}`, parserGap: "existing", confidence: "high" };
    }
    m = n.match(/^chop\s+(?:an?\s+)?(.+?)(?:\s+trees?)?$/);
    if (m) {
        const key = m[1].replace(/\s+trees?$/, "").replace(/\.$/, "");
        if (key === "tree" || key === "a tree") {
            return { csvId: row.id, name: row.name, skill: "woodcutting", action: "chop", targetId: 1511, count, location, hasLocation: !!location, proof: "woodcutting logItemId 1511", parserGap: "existing", confidence: "high" };
        }
        const logId = LOG_CHOP[key] ?? LOG_CHOP[`${key} tree`];
        if (logId) return { csvId: row.id, name: row.name, skill: "woodcutting", action: "chop", targetId: logId, count, location, hasLocation: !!location, proof: `woodcutting logItemId ${logId}`, parserGap: "existing", confidence: "high" };
    }
    m = n.match(/^(?:catch|fish)\s+(?:a\s+)?(.+?)$/);
    if (m) {
        const fish = FISH_CATCH[m[1].replace(/\.$/, "")];
        if (fish) return { csvId: row.id, name: row.name, skill: "fishing", action: "catch", targetId: fish, count, location, hasLocation: !!location, proof: `fishing catch.itemId ${fish}`, parserGap: "existing", confidence: "high" };
    }
    m = n.match(/^cook\s+(.+?)$/);
    if (m) {
        const cooked = cookedIdForFish(m[1].replace(/\.$/, ""));
        if (cooked) {
            const recipe = COOKING_RECIPES.find((r) => r.cookedItemId === cooked);
            return { csvId: row.id, name: row.name, skill: "cooking", action: "cook", targetId: cooked, count, location, hasLocation: !!location, proof: `cooking.recipe ${recipe?.id} → ${cooked}`, parserGap: "existing", confidence: "high" };
        }
    }
    m = n.match(/^burn\s+(?:an?\s+)?(.+?)(?:\s+logs?)?$/);
    if (m) {
        const key = m[1].replace(/\s+logs?$/, "");
        const logId = LOG_BURN[`${key} logs`] ?? LOG_BURN[key] ?? LOG_BURN[`${key} log`];
        if (logId) {
            const def = getFiremakingLogDefinition(logId);
            return { csvId: row.id, name: row.name, skill: "firemaking", action: "burn", targetId: logId, count, location, hasLocation: !!location, proof: `firemaking.log ${def?.name ?? logId}`, parserGap: "existing", confidence: "high" };
        }
    }
    m = n.match(/^fletch\s+(.+?)$/);
    if (m) {
        const product = FLETCH_PRODUCT[m[1].replace(/\.$/, "")];
        if (product) return { csvId: row.id, name: row.name, skill: "fletching", action: "fletch", targetId: product, count, location, hasLocation: !!location, proof: `fletching productItemId ${product}`, parserGap: "existing", confidence: "high" };
    }
    m = n.match(/^smith\s+(?:an?\s+)?(.+?)$/);
    if (m) {
        const product = SMITH_PRODUCT[m[1].replace(/\.$/, "")];
        if (product) return { csvId: row.id, name: row.name, skill: "smithing", action: "smith", targetId: product, count, location, hasLocation: !!location, proof: `smithing product ${product}`, parserGap: "smith-map", confidence: "high" };
    }
    if (n.includes("spin") && n.includes("bow string")) {
        return { csvId: row.id, name: row.name, skill: "crafting", action: "spin", targetId: 1777, count, location, hasLocation: !!location, proof: "crafting spin → 1777 bow string", parserGap: "existing", confidence: "high" };
    }
    return undefined;
}

function classifyUnmapped(name: string): string {
    const n = name.toLowerCase();
    if (/^smith/.test(n)) return "smith-parser-gap";
    if (/^fletch/.test(n)) return "fletch-parser-gap";
    if (/^pickpocket|^steal from/.test(n)) return "pickpocket-parser-gap";
    if (/^craft|^make |^create |^string |^add |^combine |^clean |^brew |^plant |^harvest |^pick /.test(n)) return "crafting-other-parser-gap";
    if (/^mine/.test(n)) return "mining-parser-gap";
    if (/^chop/.test(n)) return "wc-parser-gap";
    if (/^catch|^fish/.test(n)) return "fishing-parser-gap";
    if (/^cook/.test(n)) return "cooking-parser-gap";
    if (/^burn/.test(n)) return "fm-parser-gap";
    if (/^complete \d+ slayer|^slayer task|^learn a slayer|^block a slayer|^skip a slayer|^receive a task from/.test(n)) return "slayer-parser-gap";
    if (/^spin/.test(n)) return "spin-parser-gap";
    return "other-skilling-action";
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
    for (const rockId of ["clay","copper","tin","iron","silver","coal","gold","mithril","adamantite","runite","amethyst"]) {
        const r = getMiningRockById(rockId);
        if (r?.oreItemId) mining.add(r.oreItemId);
    }
    const fishing = new Set<number>();
    for (const spotId of ["sea_small_net","river_lure_bait","sea_cage_harpoon","sea_big_net","monkfish","shark","karambwan","barbarian_heavy_rod","minnow","karambwanji"]) {
        const s = getFishingSpotById(spotId);
        for (const m of s?.methods ?? []) for (const c of m.catches) fishing.add(c.itemId);
    }
    const wc = new Set<number>();
    for (const treeId of ["normal","oak","willow","maple","yew","magic","teak","mahogany","arctic_pine","redwood"]) {
        const t = getWoodcuttingTreeById(treeId);
        if (t?.logItemId) wc.add(t.logItemId);
    }
    const fletch = new Set<number>();
    for (const logId of FLETCHING_LOG_IDS) for (const p of getFletchingProductsForLog(logId) ?? []) fletch.add(p.productItemId);
    for (const r of FLETCHING_COMBINE_RECIPES) fletch.add(r.productItemId);
    return { mining, fishing, wc, fletch };
}

function verifyRuntime(c: Candidate, sets: ReturnType<typeof buildRuntimeSets>): boolean {
    const id = c.targetId;
    switch (c.action) {
        case "mine": return sets.mining.has(id);
        case "catch": return sets.fishing.has(id);
        case "chop": return sets.wc.has(id);
        case "cook": return COOKING_RECIPES.some((r) => r.cookedItemId === id);
        case "burn": return !!getFiremakingLogDefinition(id) || FIREMAKING_LOG_IDS.includes(id);
        case "fletch": return sets.fletch.has(id);
        case "smith": return id > 0;
        case "spin": return id === 1777;
        default: return false;
    }
}

const EMIT_PROOF: Record<string, string> = {
    mine: "SkillActionHandler.executeSkillMiningAction → emitLeagueSkillingAction(mining/mine)",
    catch: "SkillActionHandler.executeSkillFishingAction → emitLeagueSkillingAction(fishing/catch)",
    chop: "SkillActionHandler.executeSkillWoodcutAction → emitLeagueSkillingAction(woodcutting/chop)",
    cook: "SkillActionHandler.executeSkillCookAction → emitLeagueSkillingAction(cooking/cook)",
    burn: "SkillActionHandler.executeSkillFiremakingAction → emitLeagueSkillingAction(firemaking/burn)",
    fletch: "SkillActionHandler.executeSkillFletchAction → emitLeagueSkillingAction(fletching/fletch)",
    smith: "SkillActionHandler.executeSkillSmithAction → emitLeagueSkillingAction(smithing/smith)",
    spin: "SkillActionHandler.executeSkillSpinAction → emitLeagueSkillingAction(crafting/spin)",
    pickpocket: "SkillActionHandler.executeSkillPickpocketAction → emitLeagueSkillingAction(thieving/pickpocket)",
};

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const rows = parseValidationReport(path.join(repoRoot, "server/data/leagues/reports/validate-tasks-latest.csv"));
    const csv = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csv.map((r) => [r.id, r]));
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));
    const imported = collectImportedSourceIds(repoRoot);
    const sets = buildRuntimeSets();

    const skillsRows = rows.filter((r) => {
        const c = csvById.get(r.task_id);
        return c && categorizeTask(c) === "skills";
    });

    const skillingActionPool = skillsRows.filter((r) => {
        const c = csvById.get(r.task_id);
        if (!c) return false;
        if (r.status !== "need_hook" && r.status !== "ambiguous") return false;
        return inferHookRoadmapType(c) === "skilling_action";
    });

    const mapped: Candidate[] = [];
    const unmapped: Array<{ id: number; name: string; status: string; gap: string }> = [];

    for (const row of skillingActionPool) {
        const c = csvById.get(row.task_id)!;
        if (liveNames.has(c.name.trim()) || imported.has(row.task_id) || BLOCKED.has(row.task_id)) continue;
        const m = tryMap(c);
        if (!m) {
            unmapped.push({ id: row.task_id, name: c.name, status: row.status, gap: classifyUnmapped(c.name) });
            continue;
        }
        if (!WIRED_ACTIONS.has(m.action)) {
            unmapped.push({ id: row.task_id, name: c.name, status: row.status, gap: `runtime-not-wired:${m.action}` });
            continue;
        }
        if (!verifyRuntime(m, sets)) {
            unmapped.push({ id: row.task_id, name: c.name, status: row.status, gap: "content-missing" });
            continue;
        }
        mapped.push(m);
    }

    mapped.sort((a, b) => a.csvId - b.csvId);
    const locationTagged = mapped.filter((m) => m.hasLocation);
    const generic = mapped.filter((m) => !m.hasLocation);

    const gapCounts: Record<string, number> = {};
    for (const u of unmapped) gapCounts[u.gap] = (gapCounts[u.gap] ?? 0) + 1;

    const slice1 = locationTagged.length >= 7 ? locationTagged : mapped.slice(0, Math.min(40, mapped.length));

    const report = {
        baseline: { ready: 585, skillsNeedHook: skillsRows.filter((r) => r.status === "need_hook").length, skillsAmbiguous: skillsRows.filter((r) => r.status === "ambiguous").length },
        skillingActionPool: skillingActionPool.length,
        parserReadyNow: mapped.length,
        locationTagged: locationTagged.length,
        genericNoLocation: generic.length,
        unmappedByGap: gapCounts,
        unmappedTotal: unmapped.length,
        slice1: slice1.map((m) => ({
            csvId: m.csvId,
            name: m.name,
            trigger: `${m.skill}/${m.action}/${m.targetId}`,
            targetId: m.targetId,
            count: m.count,
            location: m.location,
            emitProof: EMIT_PROOF[m.action],
            contentProof: m.proof,
            parserGap: m.parserGap,
            confidence: m.confidence,
            runtimeChanges: "none",
        })),
        expectedReadyGain: slice1.length,
        parserFiles: [
            "server/scripts/leagues/plan-phase2c-batch2.ts (tryMapCandidate — add smith + arctic/mahogany burn patterns)",
            "server/scripts/leagues/lib/phase2dSkillingTriggers.ts (loader — no logic change)",
            "server/scripts/leagues/import-phase2d-slice2-tasks.ts (new import script mirroring slice1)",
            "server/data/leagues/phase2d-skilling-tasks.json (manifest append)",
        ],
        unmappedSamples: Object.fromEntries(
            Object.keys(gapCounts).sort().map((gap) => [
                gap,
                unmapped.filter((u) => u.gap === gap).slice(0, 8).map((u) => ({ id: u.id, name: u.name })),
            ]),
        ),
    };

    const outPath = path.join(repoRoot, "server/data/leagues/reports/phase2d2-decision-scan.json");
    fs.writeFileSync(outPath, JSON.stringify({ ...report, allMapped: mapped.map((m) => ({ csvId: m.csvId, name: m.name, trigger: `${m.skill}/${m.action}/${m.targetId}`, hasLocation: m.hasLocation })), genericOnly: generic.map((m) => ({ csvId: m.csvId, name: m.name, trigger: `${m.skill}/${m.action}/${m.targetId}` })) }, null, 2));
    console.log(`Wrote ${outPath}`);
    console.log(JSON.stringify(report, null, 2));
}

main();
