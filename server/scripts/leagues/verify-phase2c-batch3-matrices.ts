/**
 * Static skilling_action matrix checks for Phase 2C-A Batch 3 Tier A.
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase2c-batch3-matrices.ts
 */
import fs from "fs";
import path from "path";

import { COOKING_RECIPES } from "../../src/game/skills/skillSurfaces";
import { getFiremakingLogDefinition } from "../../src/game/skills/firemaking";
import { getMiningRockById } from "../../src/game/skills/mining";
import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService } from "../../src/game/leagues/LeagueTaskService";
import type { LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";
import { getPhase2cSkillingTrigger } from "./lib/phase2cSkillingTriggers";

const BATCH3_SOURCE_IDS = [
    1218, 1247, 1248, 1252, 1304, 1305, 1382, 1407, 1412, 1454, 1462,
];

type MockPlayer = LeagueTaskPlayer & {
    varps: Map<number, number>;
    varbits: Map<number, number>;
    progress: Map<number, number>;
};

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

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
    const manifestPath = path.resolve(__dirname, "../../data/leagues/phase2c-skilling-tasks.json");
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        tasks: Array<{ sourceTaskId: number; mvpTaskId?: number }>;
    };
    return parsed.tasks.find((t) => t.sourceTaskId === sourceId)?.mvpTaskId;
}

function main(): void {
    let failed = 0;
    const logOk = (msg: string) => console.log(`OK    ${msg}`);
    const logFail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };

    console.log("[verify-phase2c-batch3-matrices] Batch 3 Tier A matrix checks\n");

    const index = LeagueTaskIndex.build(undefined, undefined);
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

    const matrixSamples: Array<{
        label: string;
        skill: string;
        action: string;
        targetId: number;
        sourceTaskId: number;
        contentCheck: () => boolean;
    }> = [
        {
            label: "runite ore",
            skill: "mining",
            action: "mine",
            targetId: 451,
            sourceTaskId: 1247,
            contentCheck: () => getMiningRockById("runite")?.oreItemId === 451,
        },
        {
            label: "adamantite ore",
            skill: "mining",
            action: "mine",
            targetId: 449,
            sourceTaskId: 1248,
            contentCheck: () => getMiningRockById("adamantite")?.oreItemId === 449,
        },
        {
            label: "coal",
            skill: "mining",
            action: "mine",
            targetId: 453,
            sourceTaskId: 1304,
            contentCheck: () => getMiningRockById("coal")?.oreItemId === 453,
        },
        {
            label: "yew logs",
            skill: "firemaking",
            action: "burn",
            targetId: 1515,
            sourceTaskId: 1218,
            contentCheck: () => !!getFiremakingLogDefinition(1515),
        },
        {
            label: "magic logs",
            skill: "firemaking",
            action: "burn",
            targetId: 1513,
            sourceTaskId: 1252,
            contentCheck: () => !!getFiremakingLogDefinition(1513),
        },
        {
            label: "lobster",
            skill: "cooking",
            action: "cook",
            targetId: 379,
            sourceTaskId: 1412,
            contentCheck: () => COOKING_RECIPES.some((r) => r.cookedItemId === 379),
        },
        {
            label: "swordfish",
            skill: "cooking",
            action: "cook",
            targetId: 373,
            sourceTaskId: 1462,
            contentCheck: () => COOKING_RECIPES.some((r) => r.cookedItemId === 373),
        },
    ];

    for (const sample of matrixSamples) {
        if (!sample.contentCheck()) {
            logFail(`${sample.label} targetId ${sample.targetId} missing skill definition`);
            continue;
        }
        logOk(`${sample.label} content targetId ${sample.targetId} verified`);
    }

    for (const sourceId of BATCH3_SOURCE_IDS) {
        const trigger = getPhase2cSkillingTrigger(sourceId);
        if (trigger?.type !== "skilling_action") {
            logFail(`CSV ${sourceId} missing phase2c skilling trigger`);
            continue;
        }

        const mvpTaskId = sourceIdToMvpTaskId(sourceId);
        if (mvpTaskId === undefined) {
            logFail(`CSV ${sourceId} missing mvpTaskId in manifest`);
            continue;
        }

        const liveTrigger = LEAGUE_TASK_TRIGGER_BY_ID[mvpTaskId];
        if (JSON.stringify(liveTrigger) !== JSON.stringify(trigger)) {
            logFail(`CSV ${sourceId} live trigger mismatch at mvpTaskId ${mvpTaskId}`);
            continue;
        }

        const targetId = trigger.targetIds?.[0];
        if (targetId === undefined) {
            logFail(`CSV ${sourceId} trigger has no targetIds`);
            continue;
        }

        const indexed = index
            .getTasksForSkillingAction(trigger.skill, trigger.action, targetId)
            .some((t) => t.taskId === mvpTaskId);
        if (indexed) {
            logOk(
                `CSV ${sourceId} ${trigger.skill}/${trigger.action}/${targetId} → mvpTaskId ${mvpTaskId}`,
            );
        } else {
            logFail(`CSV ${sourceId} index miss for mvpTaskId ${mvpTaskId}`);
        }

        player.clearLeagueTaskProgress(mvpTaskId);
        manager.onSkillingAction(1, trigger.skill, trigger.action, targetId, 1);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`CSV ${sourceId} onSkillingAction completes mvpTaskId ${mvpTaskId}`);
        } else {
            logFail(`CSV ${sourceId} onSkillingAction did not complete mvpTaskId ${mvpTaskId}`);
        }
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase2c-batch3-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase2c-batch3-matrices] All Batch 3 matrix checks passed");
}

main();
