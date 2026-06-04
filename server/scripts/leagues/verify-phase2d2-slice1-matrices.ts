/**
 * Static skilling_action matrix checks for Phase 2D-2 Slice 1.
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase2d2-slice1-matrices.ts
 */
import fs from "fs";
import path from "path";

import { COOKING_RECIPES } from "../../src/game/skills/skillSurfaces";
import { getFiremakingLogDefinition } from "../../src/game/skills/firemaking";
import { getFishingSpotById } from "../../src/game/skills/fishing";
import { getWoodcuttingTreeById } from "../../src/game/skills/woodcutting";
import { LEAGUE_TASK_COMPLETION_VARPS } from "../../../src/shared/leagues/leagueTaskVarps";
import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService } from "../../src/game/leagues/LeagueTaskService";
import type { LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
import { getPhase2dSkillingTrigger } from "./lib/phase2dSkillingTriggers";

const SLICE1_SOURCE_IDS = [
    207, 720, 721, 726, 727, 728, 764, 878, 879, 1096, 1196, 1265, 1335, 1432, 1433,
] as const;

type MockPlayer = LeagueTaskPlayer & {
    varps: Map<number, number>;
    varbits: Map<number, number>;
    progress: Map<number, number>;
};

function createMockPlayer(): MockPlayer {
    const varps = new Map<number, number>();
    const varbits = new Map<number, number>();
    const progress = new Map<number, number>();
    return {
        varps,
        varbits,
        progress,
        getVarpValue(id: number) {
            return varps.get(id) ?? 0;
        },
        setVarpValue(id: number, value: number) {
            varps.set(id, value);
        },
        getVarbitValue(id: number) {
            return varbits.get(id) ?? 0;
        },
        setVarbitValue(id: number, value: number) {
            varbits.set(id, value);
        },
        getLeagueTaskProgress(taskId: number) {
            return progress.get(taskId) ?? 0;
        },
        setLeagueTaskProgress(taskId: number, value: number) {
            progress.set(taskId, value);
        },
        clearLeagueTaskProgress(taskId: number) {
            progress.delete(taskId);
        },
        getChallengeProgress() {
            return 0;
        },
        setChallengeProgress() {},
    };
}

function sourceIdToMvpTaskId(sourceId: number): number | undefined {
    const manifestPath = path.resolve(__dirname, "../../data/leagues/phase2d-skilling-tasks.json");
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        tasks: Array<{ sourceTaskId: number; mvpTaskId?: number }>;
    };
    return parsed.tasks.find((t) => t.sourceTaskId === sourceId)?.mvpTaskId;
}

type MatrixSample = {
    label: string;
    skill: string;
    action: string;
    targetId: number;
    sourceTaskId: number;
    contentCheck: () => boolean;
};

function resetTaskCompletion(player: MockPlayer, taskId: number): void {
    const bit = taskId & 31;
    const group = taskId >> 5;
    const varpId = LEAGUE_TASK_COMPLETION_VARPS[group];
    if (varpId === undefined) return;
    const mask = 1 << bit;
    player.setVarpValue(varpId, player.getVarpValue(varpId) & ~mask);
    player.clearLeagueTaskProgress(taskId);
}

function main(): void {
    let failed = 0;
    const logOk = (msg: string) => console.log(`OK    ${msg}`);
    const logFail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };

    console.log("[verify-phase2d2-slice1-matrices] Phase 2D-2 Slice 1 skilling_action checks\n");

    const player = createMockPlayer();
    const services = {
        getPlayer: (playerId: number) => (playerId === 1 ? player : undefined),
        queueVarp: (playerId: number, varpId: number, value: number) => {
            if (playerId === 1) player.setVarpValue(varpId, value);
        },
        queueVarbit: (playerId: number, varbitId: number, value: number) => {
            if (playerId === 1) player.setVarbitValue(varbitId, value);
        },
        queueNotification: () => {},
    };
    const manager = LeagueTaskManager.create(undefined, undefined, services);
    const index = LeagueTaskIndex.build(undefined, undefined);

    const matrixSamples: MatrixSample[] = [
        {
            label: "cook anglerfish",
            skill: "cooking",
            action: "cook",
            targetId: 13441,
            sourceTaskId: 207,
            contentCheck: () => COOKING_RECIPES.some((r) => r.id === "cook_anglerfish" && r.cookedItemId === 13441),
        },
        {
            label: "chop teak",
            skill: "woodcutting",
            action: "chop",
            targetId: 6333,
            sourceTaskId: 720,
            contentCheck: () => getWoodcuttingTreeById("teak")?.logItemId === 6333,
        },
        {
            label: "chop mahogany",
            skill: "woodcutting",
            action: "chop",
            targetId: 6332,
            sourceTaskId: 721,
            contentCheck: () => getWoodcuttingTreeById("mahogany")?.logItemId === 6332,
        },
        {
            label: "catch karambwanji",
            skill: "fishing",
            action: "catch",
            targetId: 3150,
            sourceTaskId: 726,
            contentCheck: () => {
                const spot = getFishingSpotById("karambwanji");
                return spot?.methods.some((m) => m.catches.some((c) => c.itemId === 3150)) ?? false;
            },
        },
        {
            label: "catch karambwan",
            skill: "fishing",
            action: "catch",
            targetId: 3142,
            sourceTaskId: 727,
            contentCheck: () => {
                const spot = getFishingSpotById("karambwan");
                return spot?.methods.some((m) => m.catches.some((c) => c.itemId === 3142)) ?? false;
            },
        },
        {
            label: "cook karambwan",
            skill: "cooking",
            action: "cook",
            targetId: 3144,
            sourceTaskId: 728,
            contentCheck: () => COOKING_RECIPES.some((r) => r.id === "cook_karambwan" && r.cookedItemId === 3144),
        },
        {
            label: "burn mahogany",
            skill: "firemaking",
            action: "burn",
            targetId: 6332,
            sourceTaskId: 764,
            contentCheck: () => !!getFiremakingLogDefinition(6332),
        },
        {
            label: "chop arctic pine",
            skill: "woodcutting",
            action: "chop",
            targetId: 6333,
            sourceTaskId: 878,
            contentCheck: () => getWoodcuttingTreeById("teak")?.logItemId === 6333,
        },
        {
            label: "burn arctic pine",
            skill: "firemaking",
            action: "burn",
            targetId: 6333,
            sourceTaskId: 879,
            contentCheck: () => !!getFiremakingLogDefinition(6333),
        },
        {
            label: "catch karambwanji morytania",
            skill: "fishing",
            action: "catch",
            targetId: 3150,
            sourceTaskId: 1096,
            contentCheck: () => {
                const spot = getFishingSpotById("karambwanji");
                return spot?.methods.some((m) => m.catches.some((c) => c.itemId === 3150)) ?? false;
            },
        },
        {
            label: "smith rune proxy",
            skill: "smithing",
            action: "smith",
            targetId: 1127,
            sourceTaskId: 1196,
            contentCheck: () => true,
        },
        {
            label: "smith rune wilderness",
            skill: "smithing",
            action: "smith",
            targetId: 1127,
            sourceTaskId: 1265,
            contentCheck: () => true,
        },
        {
            label: "cook anglerfish kourend",
            skill: "cooking",
            action: "cook",
            targetId: 13441,
            sourceTaskId: 1335,
            contentCheck: () => COOKING_RECIPES.some((r) => r.cookedItemId === 13441),
        },
        {
            label: "smith mithril proxy",
            skill: "smithing",
            action: "smith",
            targetId: 1143,
            sourceTaskId: 1432,
            contentCheck: () => true,
        },
        {
            label: "smith rune armor varlamore",
            skill: "smithing",
            action: "smith",
            targetId: 1127,
            sourceTaskId: 1433,
            contentCheck: () => true,
        },
    ];

    for (const sample of matrixSamples) {
        if (!sample.contentCheck()) {
            logFail(`${sample.label} targetId ${sample.targetId} missing skill definition`);
            continue;
        }
        logOk(`${sample.label} content targetId ${sample.targetId} verified`);
    }

    for (const sample of matrixSamples) {
        const trigger = getPhase2dSkillingTrigger(sample.sourceTaskId);
        if (trigger?.type !== "skilling_action") {
            logFail(`CSV ${sample.sourceTaskId} missing phase2d skilling trigger`);
            continue;
        }
        if (
            trigger.skill !== sample.skill ||
            trigger.action !== sample.action ||
            !trigger.targetIds?.includes(sample.targetId)
        ) {
            logFail(`CSV ${sample.sourceTaskId} trigger mismatch for ${sample.label}`);
            continue;
        }
        logOk(`CSV ${sample.sourceTaskId} manifest trigger ${sample.skill}/${sample.action}/${sample.targetId}`);

        const mvpTaskId = sourceIdToMvpTaskId(sample.sourceTaskId);
        if (mvpTaskId === undefined) {
            logFail(`CSV ${sample.sourceTaskId} missing mvpTaskId in manifest`);
            continue;
        }

        const indexed = index.getTasksForSkillingAction(sample.skill, sample.action, sample.targetId);
        if (!indexed.some((t) => t.taskId === mvpTaskId)) {
            logFail(`index miss mvpTaskId ${mvpTaskId} for ${sample.label}`);
            continue;
        }
        logOk(`index ${sample.skill}/${sample.action}/${sample.targetId} → mvpTaskId ${mvpTaskId}`);

        player.clearLeagueTaskProgress(mvpTaskId);
        resetTaskCompletion(player, mvpTaskId);
        manager.onSkillingAction(1, sample.skill, sample.action, sample.targetId, 1);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`onSkillingAction completes CSV ${sample.sourceTaskId} (${sample.label})`);
        } else {
            logFail(`onSkillingAction did not complete CSV ${sample.sourceTaskId} (${sample.label})`);
        }
    }

    // Variant guards: wrong item ids must not complete chosen tasks.
    const variantGuards: Array<{
        label: string;
        sourceTaskId: number;
        skill: string;
        action: string;
        wrongTargetId: number;
    }> = [
        { label: "anglerfish burnt variant", sourceTaskId: 207, skill: "cooking", action: "cook", wrongTargetId: 13442 },
        { label: "karambwanji cache variant", sourceTaskId: 726, skill: "fishing", action: "catch", wrongTargetId: 21394 },
        { label: "mithril platebody not proxy", sourceTaskId: 1432, skill: "smithing", action: "smith", wrongTargetId: 1121 },
        { label: "adamant platebody not rune", sourceTaskId: 1196, skill: "smithing", action: "smith", wrongTargetId: 1123 },
    ];

    console.log("\n=== Variant guards ===");
    for (const guard of variantGuards) {
        const mvpTaskId = sourceIdToMvpTaskId(guard.sourceTaskId);
        if (mvpTaskId === undefined) {
            logFail(`variant guard CSV ${guard.sourceTaskId}: missing mvpTaskId`);
            continue;
        }
        resetTaskCompletion(player, mvpTaskId);
        manager.onSkillingAction(1, guard.skill, guard.action, guard.wrongTargetId, 1);
        if (!LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`${guard.label}: wrong target ${guard.wrongTargetId} does NOT complete CSV ${guard.sourceTaskId}`);
        } else {
            logFail(`${guard.label}: wrong target ${guard.wrongTargetId} incorrectly completed CSV ${guard.sourceTaskId}`);
        }
    }

    // Dual-completion: shared trigger pairs complete together.
    console.log("\n=== Dual-completion pairs ===");
    const dualPairs: Array<[number, number, string, string, number]> = [
        [726, 1096, "fishing", "catch", 3150],
        [207, 1335, "cooking", "cook", 13441],
    ];
    for (const [idA, idB, skill, action, targetId] of dualPairs) {
        const mvpA = sourceIdToMvpTaskId(idA);
        const mvpB = sourceIdToMvpTaskId(idB);
        if (mvpA === undefined || mvpB === undefined) {
            logFail(`dual pair ${idA}/${idB}: missing mvpTaskId`);
            continue;
        }
        resetTaskCompletion(player, mvpA);
        resetTaskCompletion(player, mvpB);
        manager.onSkillingAction(1, skill, action, targetId, 1);
        const aDone = LeagueTaskService.isTaskComplete(player, mvpA);
        const bDone = LeagueTaskService.isTaskComplete(player, mvpB);
        if (aDone && bDone) {
            logOk(`dual pair ${idA}+${idB}: both complete on ${skill}/${action}/${targetId}`);
        } else {
            logFail(`dual pair ${idA}+${idB}: a=${aDone} b=${bDone}`);
        }
    }

    for (const sourceId of SLICE1_SOURCE_IDS) {
        if (sourceIdToMvpTaskId(sourceId) === undefined) {
            logFail(`CSV ${sourceId} missing from manifest mvpTaskId set`);
        }
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase2d2-slice1-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase2d2-slice1-matrices] All Slice 1 skilling matrix checks passed");
}

main();
