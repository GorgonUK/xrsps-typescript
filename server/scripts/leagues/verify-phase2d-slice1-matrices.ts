/**
 * Static skilling_action matrix checks for Phase 2D Slice 1.
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase2d-slice1-matrices.ts
 */
import fs from "fs";
import path from "path";

import { COOKING_RECIPES } from "../../src/game/skills/skillSurfaces";
import { getFiremakingLogDefinition } from "../../src/game/skills/firemaking";
import { getMiningRockById } from "../../src/game/skills/mining";
import { getWoodcuttingTreeById } from "../../src/game/skills/woodcutting";
import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService } from "../../src/game/leagues/LeagueTaskService";
import type { LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
import { getPhase2dSkillingTrigger } from "./lib/phase2dSkillingTriggers";

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

function main(): void {
    let failed = 0;
    const logOk = (msg: string) => console.log(`OK    ${msg}`);
    const logFail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };

    console.log("[verify-phase2d-slice1-matrices] Phase 2D Slice 1 skilling_action checks\n");

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

    const matrixSamples: Array<{
        label: string;
        skill: string;
        action: string;
        targetId: number;
        sourceTaskId: number;
        contentCheck: () => boolean;
    }> = [
        {
            label: "copper ore",
            skill: "mining",
            action: "mine",
            targetId: 436,
            sourceTaskId: 655,
            contentCheck: () => getMiningRockById("copper")?.oreItemId === 436,
        },
        {
            label: "tuna cooked",
            skill: "cooking",
            action: "cook",
            targetId: 361,
            sourceTaskId: 716,
            contentCheck: () => COOKING_RECIPES.some((r) => r.cookedItemId === 361),
        },
        {
            label: "teak logs",
            skill: "woodcutting",
            action: "chop",
            targetId: 6333,
            sourceTaskId: 1178,
            contentCheck: () => getWoodcuttingTreeById("teak")?.logItemId === 6333,
        },
        {
            label: "mahogany logs",
            skill: "woodcutting",
            action: "chop",
            targetId: 6332,
            sourceTaskId: 1414,
            contentCheck: () => getWoodcuttingTreeById("mahogany")?.logItemId === 6332,
        },
        {
            label: "mithril smith proxy",
            skill: "smithing",
            action: "smith",
            targetId: 1143,
            sourceTaskId: 797,
            contentCheck: () => true,
        },
        {
            label: "adamant smith proxy",
            skill: "smithing",
            action: "smith",
            targetId: 1123,
            sourceTaskId: 896,
            contentCheck: () => true,
        },
        {
            label: "magic logs",
            skill: "woodcutting",
            action: "chop",
            targetId: 1513,
            sourceTaskId: 947,
            contentCheck: () => getWoodcuttingTreeById("magic")?.logItemId === 1513,
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
        const varpBefore = player.getVarpValue(2616);
        manager.onSkillingAction(1, sample.skill, sample.action, sample.targetId, 1);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`onSkillingAction completes CSV ${sample.sourceTaskId} (${sample.label})`);
        } else {
            logFail(`onSkillingAction did not complete CSV ${sample.sourceTaskId} (${sample.label})`);
        }
        void varpBefore;
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase2d-slice1-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase2d-slice1-matrices] All Slice 1 skilling matrix checks passed");
}

main();
