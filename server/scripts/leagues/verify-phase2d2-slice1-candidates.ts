/**
 * Pre-import gate for Phase 2D-2 Slice 1 (15 manifest-only skilling_action tasks).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase2d2-slice1-candidates.ts
 */
import fs from "fs";
import path from "path";

import { COOKING_RECIPES } from "../../src/game/skills/skillSurfaces";
import { FIREMAKING_LOG_IDS, getFiremakingLogDefinition } from "../../src/game/skills/firemaking";
import { getFishingSpotById } from "../../src/game/skills/fishing";
import { getWoodcuttingTreeById } from "../../src/game/skills/woodcutting";
import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { parseCsvFile } from "./lib/csv";
import { getPhase2dSkillingTrigger } from "./lib/phase2dSkillingTriggers";

/** Phase 2D-2 Slice 1 — manifest-only; no runtime changes. */
const SLICE1_SOURCE_IDS = [
    207, 720, 721, 726, 727, 728, 764, 878, 879, 1096, 1196, 1265, 1335, 1432, 1433,
] as const;

/** Live smith proxy convention (phase2d-skilling-tasks.json): mithril item → 1143, adamant → 1123, rune → 1127. */
const EXPECTED_TRIGGERS: Record<number, { skill: string; action: string; targetId: number }> = {
    207: { skill: "cooking", action: "cook", targetId: 13441 },
    720: { skill: "woodcutting", action: "chop", targetId: 6333 },
    721: { skill: "woodcutting", action: "chop", targetId: 6332 },
    726: { skill: "fishing", action: "catch", targetId: 3150 },
    727: { skill: "fishing", action: "catch", targetId: 3142 },
    728: { skill: "cooking", action: "cook", targetId: 3144 },
    764: { skill: "firemaking", action: "burn", targetId: 6332 },
    878: { skill: "woodcutting", action: "chop", targetId: 6333 },
    879: { skill: "firemaking", action: "burn", targetId: 6333 },
    1096: { skill: "fishing", action: "catch", targetId: 3150 },
    1196: { skill: "smithing", action: "smith", targetId: 1127 },
    1265: { skill: "smithing", action: "smith", targetId: 1127 },
    1335: { skill: "cooking", action: "cook", targetId: 13441 },
    1432: { skill: "smithing", action: "smith", targetId: 1143 },
    1433: { skill: "smithing", action: "smith", targetId: 1127 },
};

function triggerKey(skill: string, action: string, targetId: number): string {
    return `${skill}/${action}/${targetId}`;
}

function verifyContent(skill: string, action: string, targetId: number): boolean {
    switch (`${skill}/${action}`) {
        case "cooking/cook":
            return COOKING_RECIPES.some((r) => r.cookedItemId === targetId);
        case "firemaking/burn":
            return !!getFiremakingLogDefinition(targetId) || FIREMAKING_LOG_IDS.includes(targetId);
        case "woodcutting/chop":
            return ["teak", "mahogany", "arctic_pine"].some(
                (id) => getWoodcuttingTreeById(id)?.logItemId === targetId,
            );
        case "fishing/catch":
            return ["karambwan", "karambwanji"].some((spotId) => {
                const spot = getFishingSpotById(spotId);
                return spot?.methods.some((m) => m.catches.some((c) => c.itemId === targetId));
            });
        case "smithing/smith":
            return targetId > 0;
        default:
            return false;
    }
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));

    const liveTriggers = new Map<string, Array<{ taskId: number; name: string; csvId?: number }>>();
    for (const row of LEAGUE_TASKS) {
        const csv = csvRows.find((t) => t.name.trim() === row.name.trim());
        const entry = { taskId: row.taskId, name: row.name.trim(), csvId: csv?.id };
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

    console.log(`[verify-phase2d2-slice1-candidates] Phase 2D-2 Slice 1 gate (${SLICE1_SOURCE_IDS.length} tasks)\n`);

    let failed = 0;
    const fail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };
    const ok = (msg: string) => console.log(`OK    ${msg}`);

    for (const sourceId of SLICE1_SOURCE_IDS) {
        const csv = csvById.get(sourceId);
        if (!csv) {
            fail(`CSV ${sourceId}: missing row`);
            continue;
        }
        if (liveNames.has(csv.name.trim())) {
            fail(`CSV ${sourceId}: already live (${csv.name})`);
            continue;
        }

        const expected = EXPECTED_TRIGGERS[sourceId];
        if (!expected) {
            fail(`CSV ${sourceId}: missing expected trigger map`);
            continue;
        }

        const manifest = getPhase2dSkillingTrigger(sourceId);
        if (manifest?.type !== "skilling_action") {
            fail(`CSV ${sourceId}: missing phase2d manifest trigger`);
            continue;
        }
        if (
            manifest.skill !== expected.skill ||
            manifest.action !== expected.action ||
            !manifest.targetIds?.includes(expected.targetId)
        ) {
            fail(
                `CSV ${sourceId}: manifest mismatch (got ${manifest.skill}/${manifest.action}/${manifest.targetIds?.join(",")})`,
            );
            continue;
        }
        ok(`CSV ${sourceId} manifest ${expected.skill}/${expected.action}/${expected.targetId}`);

        if (!verifyContent(expected.skill, expected.action, expected.targetId)) {
            fail(`CSV ${sourceId}: runtime content proof failed for target ${expected.targetId}`);
            continue;
        }
        ok(`CSV ${sourceId} content targetId ${expected.targetId}`);
    }

    // Confirm live rune smith proxy convention: adamant uses 1123; rune uses 1127 (first rune imports).
    const liveSmithTargets = new Map<number, string[]>();
    for (const row of LEAGUE_TASKS) {
        const trig = LEAGUE_TASK_TRIGGER_BY_ID[row.taskId];
        if (trig?.type === "skilling_action" && trig.skill === "smithing" && trig.action === "smith") {
            for (const tid of trig.targetIds ?? []) {
                const list = liveSmithTargets.get(tid) ?? [];
                list.push(row.name.trim());
                liveSmithTargets.set(tid, list);
            }
        }
    }
    console.log("\n=== Live smith proxy targets ===");
    for (const [tid, names] of [...liveSmithTargets.entries()].sort((a, b) => a[0] - b[0])) {
        console.log(`  ${tid}: ${names.length} live task(s) — e.g. "${names[0]}"`);
    }
    if (liveSmithTargets.has(1123)) {
        ok("Live adamant smith proxy 1123 confirmed");
    } else {
        fail("Expected live adamant smith proxy 1123");
    }
    if (liveSmithTargets.has(1143)) {
        ok("Live mithril smith proxy 1143 confirmed");
    } else {
        fail("Expected live mithril smith proxy 1143");
    }
    if (liveSmithTargets.has(1127)) {
        console.log("NOTE  1127 already live — rune proxy pre-exists");
    } else {
        ok("1127 not yet live — establishing rune smith proxy (matches adamant 1123 ladder → rune platebody 1127)");
    }

    console.log("\n=== Intentional dual-completion trigger groups in this slice ===");
    const sliceGroups = new Map<string, number[]>();
    for (const sourceId of SLICE1_SOURCE_IDS) {
        const exp = EXPECTED_TRIGGERS[sourceId];
        const key = triggerKey(exp.skill, exp.action, exp.targetId);
        const list = sliceGroups.get(key) ?? [];
        list.push(sourceId);
        sliceGroups.set(key, list);
    }
    for (const [key, ids] of sliceGroups) {
        if (ids.length > 1) {
            console.log(`  ${key} → CSV ${ids.join(", ")}`);
        }
    }

    console.log("\n=== Location variants sharing live trigger (expected, not blocked) ===");
    for (const sourceId of SLICE1_SOURCE_IDS) {
        const exp = EXPECTED_TRIGGERS[sourceId];
        const key = triggerKey(exp.skill, exp.action, exp.targetId);
        const csv = csvById.get(sourceId)!;
        const liveMatches = (liveTriggers.get(key) ?? []).filter((l) => l.name.trim() !== csv.name.trim());
        if (liveMatches.length > 0) {
            console.log(`  CSV ${sourceId} "${csv.name}" ↔ ${liveMatches.length} live task(s) on ${key}`);
        }
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase2d2-slice1-candidates] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase2d2-slice1-candidates] PASS: all 15 candidates ready for import");
}

main();
