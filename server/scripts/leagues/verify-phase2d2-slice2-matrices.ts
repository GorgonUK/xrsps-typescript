/**
 * Static skilling_action matrix checks for Phase 2D-2 Slice 2 (fletch arrows).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase2d2-slice2-matrices.ts
 */
import fs from "fs";
import path from "path";

import {
    FLETCHING_COMBINE_RECIPES,
    FLETCHING_LOG_IDS,
    getFletchingProductsForLog,
} from "../../src/game/skills/fletching";
import { LEAGUE_TASK_COMPLETION_VARPS } from "../../../src/shared/leagues/leagueTaskVarps";
import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService } from "../../src/game/leagues/LeagueTaskService";
import type { LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
import { getPhase2dSkillingTrigger } from "./lib/phase2dSkillingTriggers";

const SLICE2_SAMPLES = [
    { sourceTaskId: 108, label: "Headless arrows", targetId: 53, wrongTargetId: 52 },
    { sourceTaskId: 109, label: "Bronze arrows", targetId: 882, wrongTargetId: 884 },
    { sourceTaskId: 110, label: "Iron arrows", targetId: 884, wrongTargetId: 882 },
    { sourceTaskId: 111, label: "Steel arrows", targetId: 886, wrongTargetId: 888 },
    { sourceTaskId: 112, label: "Mithril arrows", targetId: 888, wrongTargetId: 890 },
    { sourceTaskId: 113, label: "Adamant arrows", targetId: 890, wrongTargetId: 892 },
    { sourceTaskId: 114, label: "Rune arrows", targetId: 892, wrongTargetId: 890 },
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

function resetTaskCompletion(player: MockPlayer, taskId: number): void {
    const bit = taskId & 31;
    const group = taskId >> 5;
    const varpId = LEAGUE_TASK_COMPLETION_VARPS[group];
    if (varpId === undefined) return;
    const mask = 1 << bit;
    player.setVarpValue(varpId, player.getVarpValue(varpId) & ~mask);
    player.clearLeagueTaskProgress(taskId);
}

function buildFletchingProductItemIds(): Set<number> {
    const ids = new Set<number>();
    for (const logId of FLETCHING_LOG_IDS) {
        for (const product of getFletchingProductsForLog(logId) ?? []) ids.add(product.productItemId);
    }
    for (const recipe of FLETCHING_COMBINE_RECIPES) ids.add(recipe.productItemId);
    return ids;
}

const FLETCHING_PRODUCT_ITEM_IDS = buildFletchingProductItemIds();

function main(): void {
    let failed = 0;
    const logOk = (msg: string) => console.log(`OK    ${msg}`);
    const logFail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };

    console.log("[verify-phase2d2-slice2-matrices] Phase 2D-2 Slice 2 fletch arrow checks\n");

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

    for (const sample of SLICE2_SAMPLES) {
        if (!FLETCHING_PRODUCT_ITEM_IDS.has(sample.targetId)) {
            logFail(`${sample.label}: targetId ${sample.targetId} not in fletching.ts`);
            continue;
        }
        logOk(`${sample.label} productItemId ${sample.targetId} in fletching.ts`);

        const trigger = getPhase2dSkillingTrigger(sample.sourceTaskId);
        if (
            trigger?.type !== "skilling_action" ||
            trigger.skill !== "fletching" ||
            trigger.action !== "fletch" ||
            !trigger.targetIds?.includes(sample.targetId)
        ) {
            logFail(`CSV ${sample.sourceTaskId} manifest trigger mismatch`);
            continue;
        }
        logOk(`CSV ${sample.sourceTaskId} manifest fletching/fletch/${sample.targetId}`);

        const mvpTaskId = sourceIdToMvpTaskId(sample.sourceTaskId);
        if (mvpTaskId === undefined) {
            logFail(`CSV ${sample.sourceTaskId} missing mvpTaskId`);
            continue;
        }

        if (!index.getTasksForSkillingAction("fletching", "fletch", sample.targetId).some((t) => t.taskId === mvpTaskId)) {
            logFail(`index miss mvpTaskId ${mvpTaskId} for ${sample.label}`);
            continue;
        }
        logOk(`index fletching/fletch/${sample.targetId} → mvpTaskId ${mvpTaskId}`);

        resetTaskCompletion(player, mvpTaskId);
        manager.onSkillingAction(1, "fletching", "fletch", sample.targetId, 1);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`onSkillingAction completes CSV ${sample.sourceTaskId} (${sample.label})`);
        } else {
            logFail(`onSkillingAction did not complete CSV ${sample.sourceTaskId} (${sample.label})`);
        }

        resetTaskCompletion(player, mvpTaskId);
        manager.onSkillingAction(1, "fletching", "fletch", sample.wrongTargetId, 1);
        if (!LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(
                `${sample.label}: wrong target ${sample.wrongTargetId} does NOT complete CSV ${sample.sourceTaskId}`,
            );
        } else {
            logFail(
                `${sample.label}: wrong target ${sample.wrongTargetId} incorrectly completed CSV ${sample.sourceTaskId}`,
            );
        }
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase2d2-slice2-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase2d2-slice2-matrices] All Slice 2 fletch arrow matrix checks passed");
}

main();
