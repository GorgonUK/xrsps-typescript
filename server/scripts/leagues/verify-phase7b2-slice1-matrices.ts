/**
 * Static npc_kill matrix checks for Phase 7B-2 Slice 1.
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7b2-slice1-matrices.ts
 */
import fs from "fs";
import path from "path";

import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService, type LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
import { LEAGUE_TASK_COMPLETION_VARPS } from "../../../src/shared/leagues/leagueTaskVarps";
import { PHASE7B2_SLICE1_APPROVED } from "./lib/phase7b2Slice1Approved";
import { getPhase7bNpcTrigger } from "./lib/phase7bNpcTriggers";

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
    const manifestPath = path.resolve(__dirname, "../../data/leagues/phase7b-npc-disambiguation.json");
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        tasks: Array<{ sourceTaskId: number; mvpTaskId?: number; chosenNpcId?: number }>;
    };
    return parsed.tasks.find((t) => t.sourceTaskId === sourceId)?.mvpTaskId;
}

function resetTaskCompletion(player: MockPlayer, taskId: number): void {
    player.clearLeagueTaskProgress(taskId);
    const group = (taskId / 32) | 0;
    const varpId = LEAGUE_TASK_COMPLETION_VARPS[group];
    if (varpId !== undefined) {
        player.setVarpValue(varpId, 0);
    }
}

function main(): void {
    let failed = 0;
    const logOk = (msg: string) => console.log(`OK    ${msg}`);
    const logFail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };
    const logDoc = (msg: string) => console.log(`DOC   ${msg}`);

    console.log("[verify-phase7b2-slice1-matrices] Phase 7B-2 Slice 1 npc_kill checks\n");

    const matrixSamples: Array<{
        label: string;
        sourceTaskId: number;
        npcId: number;
        wrongNpcId?: number;
    }> = [
        { label: "Giant Rat Edgeville Dungeon", sourceTaskId: 661, npcId: 2856, wrongNpcId: 2510 },
        { label: "Abyssal Demon Morytania", sourceTaskId: 1120, npcId: 415, wrongNpcId: 416 },
        { label: "Kalphite Worker Desert", sourceTaskId: 1052, npcId: 955, wrongNpcId: 956 },
        { label: "Kalphite Soldier Desert", sourceTaskId: 1053, npcId: 957, wrongNpcId: 138 },
        { label: "Dust Devil Desert", sourceTaskId: 1050, npcId: 423, wrongNpcId: 7249 },
        { label: "Dust Devil Kourend", sourceTaskId: 1367, npcId: 7249, wrongNpcId: 423 },
        { label: "Ice Warrior Wilderness", sourceTaskId: 1273, npcId: 2841, wrongNpcId: 2842 },
        { label: "Basilisk Fremennik", sourceTaskId: 901, npcId: 417, wrongNpcId: 418 },
    ];

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

    for (const sample of matrixSamples) {
        const mvpTaskId = sourceIdToMvpTaskId(sample.sourceTaskId);
        if (mvpTaskId === undefined) {
            logFail(`${sample.label}: CSV ${sample.sourceTaskId} not in manifest with mvpTaskId`);
            continue;
        }

        const trigger = getPhase7bNpcTrigger(sample.sourceTaskId);
        if (!trigger || trigger.type !== "npc_kill") {
            logFail(`${sample.label}: missing manifest npc_kill trigger`);
            continue;
        }
        if (!trigger.npcIds.includes(sample.npcId)) {
            logFail(
                `${sample.label}: manifest npcIds ${trigger.npcIds.join(",")} !== expected ${sample.npcId}`,
            );
            continue;
        }
        logOk(`${sample.label} manifest npc_kill ${sample.npcId}`);

        const indexed = index.getTasksForNpcKill(sample.npcId);
        const match = indexed.find((t) => t.taskId === mvpTaskId);
        if (!match) {
            logFail(`index npc_kill/${sample.npcId} missing mvpTaskId ${mvpTaskId}`);
            continue;
        }
        logOk(`index npc_kill/${sample.npcId} → mvpTaskId ${mvpTaskId}`);

        resetTaskCompletion(player, mvpTaskId);
        manager.onNpcKill(1, sample.npcId);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`onNpcKill(${sample.npcId}) completes CSV ${sample.sourceTaskId}`);
        } else {
            logFail(`onNpcKill(${sample.npcId}) did not complete CSV ${sample.sourceTaskId}`);
        }

        if (sample.wrongNpcId !== undefined) {
            resetTaskCompletion(player, mvpTaskId);
            manager.onNpcKill(1, sample.wrongNpcId);
            if (!LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
                logOk(`wrong npcId ${sample.wrongNpcId} does not complete CSV ${sample.sourceTaskId}`);
            } else {
                logFail(`wrong npcId ${sample.wrongNpcId} incorrectly completed CSV ${sample.sourceTaskId}`);
            }
        }
    }

    // Shared wolf npcId 106 — document cross-completion behavior (no region gate on npc_kill).
    const wolfKandarinMvp = sourceIdToMvpTaskId(983);
    const wolfTirannwnMvp = sourceIdToMvpTaskId(1228);
    if (wolfKandarinMvp === undefined || wolfTirannwnMvp === undefined) {
        logFail("Wolf pair: missing mvpTaskId for CSV 983 or 1228");
    } else {
        resetTaskCompletion(player, wolfKandarinMvp);
        resetTaskCompletion(player, wolfTirannwnMvp);
        manager.onNpcKill(1, 106);

        const kComplete = LeagueTaskService.isTaskComplete(player, wolfKandarinMvp);
        const tComplete = LeagueTaskService.isTaskComplete(player, wolfTirannwnMvp);

        if (kComplete && tComplete) {
            logDoc(
                "shared wolf npcId 106: single onNpcKill completes BOTH CSV 983 (Kandarin) and 1228 (Tirannwn) — expected (npc_kill has no region gate)",
            );
        } else if (kComplete && !tComplete) {
            logDoc("shared wolf npcId 106: completes CSV 983 only (Tirannwn not complete)");
        } else if (!kComplete && tComplete) {
            logDoc("shared wolf npcId 106: completes CSV 1228 only (Kandarin not complete)");
        } else {
            logFail("shared wolf npcId 106: neither wolf task completed");
        }

        const wolfIndexed = index.getTasksForNpcKill(106);
        const wolfTaskIds = wolfIndexed.map((t) => t.taskId).sort((a, b) => a - b);
        logDoc(`index npc_kill/106 → mvpTaskIds [${wolfTaskIds.join(", ")}]`);
    }

    // All 19 manifest triggers resolve.
    for (const entry of PHASE7B2_SLICE1_APPROVED) {
        const trig = getPhase7bNpcTrigger(entry.sourceTaskId);
        if (!trig || trig.type !== "npc_kill" || trig.npcIds[0] !== entry.chosenNpcId) {
            logFail(`manifest trigger CSV ${entry.sourceTaskId} !== chosenNpcId ${entry.chosenNpcId}`);
        }
    }
    logOk(`all ${PHASE7B2_SLICE1_APPROVED.length} slice-1 manifest triggers resolve`);

    if (failed > 0) {
        console.error(`\n[verify-phase7b2-slice1-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("\n[verify-phase7b2-slice1-matrices] All Slice 1 matrix checks passed");
}

main();
