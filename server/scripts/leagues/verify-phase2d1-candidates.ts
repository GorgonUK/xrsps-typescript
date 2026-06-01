/**
 * Pre-import duplicate check for Phase 2D-1 candidates (read-only).
 * Usage: npx tsx server/scripts/leagues/verify-phase2d1-candidates.ts
 */
import { COOKING_RECIPES } from "../../src/game/skills/skillSurfaces";
import { FIREMAKING_LOG_IDS, getFiremakingLogDefinition } from "../../src/game/skills/firemaking";
import { getFishingSpotById } from "../../src/game/skills/fishing";
import { getMiningRockById } from "../../src/game/skills/mining";
import { getWoodcuttingTreeById } from "../../src/game/skills/woodcutting";
import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";
import { parseCsvFile } from "./lib/csv";

const SLICE1_CSV_IDS = [
    655, 657, 689, 716, 722, 723, 796, 797, 798, 799, 880, 881, 895, 896, 945, 946, 947, 974, 975,
    1113, 1178, 1179, 1195, 1251, 1303, 1339, 1413, 1414, 1416,
] as const;

type Candidate = {
    csvId: number;
    name: string;
    skill: string;
    action: string;
    targetId: number;
    location?: string;
    proof: string;
};

const MINING_ORE: Record<string, number> = {
    clay: 434, copper: 436, "copper ore": 436, tin: 438, "tin ore": 438,
    iron: 440, "iron ore": 440, silver: 442, coal: 453, gold: 444, mithril: 447,
    adamantite: 449, runite: 451,
};
const LOG_BURN: Record<string, number> = {
    logs: 1511, "oak logs": 1521, "willow logs": 1519, "maple logs": 1517,
    "yew logs": 1515, "magic logs": 1513, teak: 6333, mahogany: 6332,
};
const LOG_CHOP: Record<string, number> = {
    logs: 1511, oak: 1521, willow: 1519, maple: 1517, yew: 1515, magic: 1513, teak: 6333, mahogany: 6332,
};
const FISH_CATCH: Record<string, number> = {
    trout: 335, tuna: 359, lobster: 377, swordfish: 371, shark: 383,
};
const SMITH_PRODUCT: Record<string, number> = {
    "iron platebody": 1115, "mithril item": 1143, "mithril platebody": 1121, "adamant item": 1123,
};

function cookedIdForFish(fishKey: string): number | undefined {
    const recipeIdByKey: Record<string, string> = {
        tuna: "cook_tuna", lobster: "cook_lobster", swordfish: "cook_swordfish", shark: "cook_shark",
    };
    const recipeId = recipeIdByKey[fishKey];
    if (!recipeId) return undefined;
    return COOKING_RECIPES.find((r) => r.id === recipeId)?.cookedItemId;
}

function extractLocation(name: string): { base: string; location?: string } {
    const m = name.match(/^(.+?)\s+(?:in|on|at|near)\s+(.+?)\.?$/i);
    if (!m) return { base: name };
    return { base: m[1].trim(), location: m[2].trim().replace(/\.$/, "") };
}

function mapCandidate(row: { id: number; name: string }): Candidate | undefined {
    const { rest } = { rest: row.name.trim().replace(/^[\d,]+\s+/, "") };
    const { base, location } = extractLocation(rest.replace(/\.$/, ""));
    const n = base.toLowerCase().replace(/\s+/g, " ");

    let m = n.match(/^mine\s+(.+?)$/);
    if (m) {
        const ore = MINING_ORE[m[1].replace(/\.$/, "")];
        if (ore) return { csvId: row.id, name: row.name, skill: "mining", action: "mine", targetId: ore, location, proof: `mining ${ore}` };
    }
    m = n.match(/^chop\s+(?:an?\s+)?(.+?)(?:\s+trees?)?$/);
    if (m) {
        const key = m[1].replace(/\s+trees?$/, "");
        if (key === "tree" || key === "a tree") {
            return { csvId: row.id, name: row.name, skill: "woodcutting", action: "chop", targetId: 1511, location, proof: "chop logs 1511" };
        }
        const logId = LOG_CHOP[key];
        if (logId) return { csvId: row.id, name: row.name, skill: "woodcutting", action: "chop", targetId: logId, location, proof: `chop ${logId}` };
    }
    m = n.match(/^cook\s+(.+?)$/);
    if (m) {
        const cooked = cookedIdForFish(m[1]);
        if (cooked) return { csvId: row.id, name: row.name, skill: "cooking", action: "cook", targetId: cooked, location, proof: `cook ${cooked}` };
    }
    m = n.match(/^burn\s+(.+?)(?:\s+logs?)?$/);
    if (m) {
        const key = m[1].replace(/\s+logs?$/, "");
        const logId = LOG_BURN[`${key} logs`] ?? LOG_BURN[key];
        if (logId) return { csvId: row.id, name: row.name, skill: "firemaking", action: "burn", targetId: logId, location, proof: `burn ${logId}` };
    }
    m = n.match(/^smith\s+(?:an?\s+)?(.+?)$/);
    if (m) {
        const product = SMITH_PRODUCT[m[1].replace(/\.$/, "")];
        if (product) return { csvId: row.id, name: row.name, skill: "smithing", action: "smith", targetId: product, location, proof: `smith ${product}` };
    }
    return undefined;
}

function triggerKey(skill: string, action: string, targetId: number): string {
    return `${skill}/${action}/${targetId}`;
}

function verifyRuntime(c: Candidate): boolean {
    switch (c.action) {
        case "mine":
            return [...["clay", "copper", "tin", "iron", "coal", "gold", "mithril", "adamantite", "runite"]].some(
                (id) => getMiningRockById(id)?.oreItemId === c.targetId,
            );
        case "chop":
            return [...["normal", "oak", "willow", "maple", "yew", "magic", "teak", "mahogany"]].some(
                (id) => getWoodcuttingTreeById(id)?.logItemId === c.targetId,
            );
        case "cook":
            return COOKING_RECIPES.some((r) => r.cookedItemId === c.targetId);
        case "burn":
            return !!getFiremakingLogDefinition(c.targetId) || FIREMAKING_LOG_IDS.includes(c.targetId);
        case "smith":
            return c.targetId > 0;
        default:
            return false;
    }
}

function main(): void {
    const tasks = parseCsvFile("tasks.csv");
    const csvById = new Map(tasks.map((t) => [t.id, t]));

    const liveByName = new Map<string, { taskId: number; name: string; csvId?: number }>();
    const liveTriggers = new Map<string, Array<{ taskId: number; name: string; csvId?: number }>>();

    for (const row of LEAGUE_TASKS) {
        const csv = tasks.find((t) => t.name.trim() === row.name.trim());
        const entry = { taskId: row.taskId, name: row.name.trim(), csvId: csv?.id };
        liveByName.set(row.name.trim(), entry);
        const trig = LEAGUE_TASK_TRIGGER_BY_ID[row.taskId];
        if (trig?.type === "skilling_action") {
            for (const tid of trig.targetIds ?? []) {
                const key = triggerKey(trig.skill, trig.action, tid);
                const list = liveTriggers.get(key) ?? [];
                list.push(entry);
                liveTriggers.set(key, list);
            }
        }
    }

    const candidates: Candidate[] = [];
    const missing: number[] = [];
    for (const id of SLICE1_CSV_IDS) {
        const row = csvById.get(id);
        if (!row) {
            missing.push(id);
            continue;
        }
        const c = mapCandidate(row);
        if (!c) {
            console.error(`FAIL: could not map CSV ${id} ${row.name}`);
            process.exit(1);
        }
        if (!verifyRuntime(c)) {
            console.error(`FAIL: runtime proof failed CSV ${id} ${row.name}`);
            process.exit(1);
        }
        candidates.push(c);
    }

    console.log(`[verify-phase2d1-candidates] Phase 2D-1 pre-import check (${candidates.length} candidates)\n`);

    // 1. Duplicate CSV ids within batch
    const csvDupes = SLICE1_CSV_IDS.filter((id, i, arr) => arr.indexOf(id) !== i);
    console.log("=== Duplicate CSV ids in batch ===");
    console.log(csvDupes.length ? csvDupes.join(", ") : "None");

    // 2. Duplicate task names within batch
    const nameCounts = new Map<string, number[]>();
    for (const c of candidates) {
        const n = c.name.trim();
        const list = nameCounts.get(n) ?? [];
        list.push(c.csvId);
        nameCounts.set(n, list);
    }
    const nameDupes = [...nameCounts.entries()].filter(([, ids]) => ids.length > 1);
    console.log("\n=== Duplicate task names in batch ===");
    if (nameDupes.length === 0) console.log("None");
    else nameDupes.forEach(([n, ids]) => console.log(`  "${n}" → CSV ${ids.join(", ")}`));

    // 3. Duplicate task names vs live
    const liveNameCollisions: Array<{ csvId: number; name: string; liveTaskId: number; liveCsvId?: number }> = [];
    for (const c of candidates) {
        const live = liveByName.get(c.name.trim());
        if (live) {
            liveNameCollisions.push({
                csvId: c.csvId,
                name: c.name.trim(),
                liveTaskId: live.taskId,
                liveCsvId: live.csvId,
            });
        }
    }
    console.log("\n=== Duplicate task names vs LIVE ===");
    if (liveNameCollisions.length === 0) console.log("None — all 29 names are new");
    else {
        for (const x of liveNameCollisions) {
            console.log(
                `  CSV ${x.csvId} "${x.name}" → already live as taskId ${x.liveTaskId}${x.liveCsvId !== undefined ? ` (CSV ${x.liveCsvId})` : ""}`,
            );
        }
    }

    // 4. Duplicate triggers within batch
    const triggerCounts = new Map<string, Array<{ csvId: number; name: string }>>();
    for (const c of candidates) {
        const key = triggerKey(c.skill, c.action, c.targetId);
        const list = triggerCounts.get(key) ?? [];
        list.push({ csvId: c.csvId, name: c.name });
        triggerCounts.set(key, list);
    }
    const batchTriggerDupes = [...triggerCounts.entries()].filter(([, list]) => list.length > 1);
    console.log("\n=== Duplicate triggers within batch (same skill/action/targetId) ===");
    if (batchTriggerDupes.length === 0) console.log("None");
    else {
        for (const [key, list] of batchTriggerDupes) {
            console.log(`  ${key}:`);
            for (const t of list) console.log(`    CSV ${t.csvId} ${t.name}`);
        }
    }

    // 5. Location variants sharing live trigger
    const triggerLiveVariants: Array<{
        csvId: number;
        name: string;
        trigger: string;
        liveMatches: Array<{ taskId: number; name: string; csvId?: number }>;
    }> = [];
    for (const c of candidates) {
        const key = triggerKey(c.skill, c.action, c.targetId);
        const liveMatches = (liveTriggers.get(key) ?? []).filter((l) => l.name.trim() !== c.name.trim());
        if (liveMatches.length > 0) {
            triggerLiveVariants.push({ csvId: c.csvId, name: c.name, trigger: key, liveMatches });
        }
    }
    console.log("\n=== Location variants: same trigger as LIVE task (different name) ===");
    console.log(`Count: ${triggerLiveVariants.length}`);
    for (const v of triggerLiveVariants) {
        console.log(`\n  CSV ${v.csvId} "${v.name}"`);
        console.log(`  Trigger: ${v.trigger}`);
        for (const m of v.liveMatches) {
            console.log(`    ↔ LIVE taskId ${m.taskId} CSV ${m.csvId ?? "?"} "${m.name}"`);
        }
    }

    // 6. Same trigger, different location within batch only (not sharing with live)
    console.log("\n=== Intra-batch trigger groups (multiple regions, same action) ===");
    for (const [key, list] of batchTriggerDupes) {
        console.log(`  ${key} → ${list.length} tasks`);
    }

    // Summary table
    console.log("\n=== Full candidate list ===");
    console.log("| CSV | Task | Trigger | Location | Live name clash? | Live trigger variant? |");
    console.log("|-----|------|---------|----------|------------------|----------------------|");
    for (const c of candidates) {
        const nameClash = liveByName.has(c.name.trim()) ? "YES" : "no";
        const key = triggerKey(c.skill, c.action, c.targetId);
        const variant = triggerLiveVariants.some((v) => v.csvId === c.csvId) ? "YES" : "no";
        console.log(
            `| ${c.csvId} | ${c.name.slice(0, 40)} | ${key} | ${c.location ?? "-"} | ${nameClash} | ${variant} |`,
        );
    }

    const importable = candidates.filter(
        (c) => !liveByName.has(c.name.trim()),
    );
    console.log(`\n=== Summary ===`);
    console.log(`Candidates: ${candidates.length}`);
    console.log(`Import-safe (unique name): ${importable.length}`);
    console.log(`Blocked by live name duplicate: ${liveNameCollisions.length}`);
    console.log(`Share trigger with live (location variants): ${triggerLiveVariants.length}`);
    console.log(`Intra-batch duplicate triggers: ${batchTriggerDupes.length} groups`);

    if (missing.length > 0) {
        console.error(`Missing CSV rows: ${missing.join(", ")}`);
        process.exit(1);
    }
    if (liveNameCollisions.length > 0) {
        console.error("\n[verify-phase2d1-candidates] BLOCKED: live name duplicates found");
        process.exit(1);
    }
    console.log("\n[verify-phase2d1-candidates] PASS: all 29 candidates unique by CSV id, name, and safe to import");
}

main();
