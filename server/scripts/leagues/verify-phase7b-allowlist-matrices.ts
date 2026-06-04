/**
 * Static npc_kill matrix checks for Phase 7B-allowlist.
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7b-allowlist-matrices.ts
 */
import fs from "fs";
import path from "path";

import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService, type LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
import { LEAGUE_TASK_COMPLETION_VARPS } from "../../../src/shared/leagues/leagueTaskVarps";
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

function resetTaskCompletion(player: MockPlayer, taskId: number): void {
    const bit = taskId & 31;
    const group = taskId >> 5;
    const varpId = LEAGUE_TASK_COMPLETION_VARPS[group];
    if (varpId === undefined) {
        return;
    }
    const mask = 1 << bit;
    player.setVarpValue(varpId, player.getVarpValue(varpId) & ~mask);
    player.clearLeagueTaskProgress(taskId);
}

function sourceIdToMvpTaskId(sourceId: number): number | undefined {
    const manifestPath = path.resolve(__dirname, "../../data/leagues/phase7b-npc-disambiguation.json");
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        tasks: Array<{ sourceTaskId: number; mvpTaskId?: number; chosenNpcId?: number }>;
    };
    const entry = parsed.tasks.find((t) => t.sourceTaskId === sourceId);
    return entry?.mvpTaskId;
}

function main(): void {
    let failed = 0;
    const logOk = (msg: string) => console.log(`OK    ${msg}`);
    const logFail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };

    console.log("[verify-phase7b-allowlist-matrices] Phase 7B-allowlist npc_kill checks\n");

    const positiveSamples: Array<{
        label: string;
        sourceTaskId: number;
        npcId: number;
    }> = [
        { label: "Zulrah", sourceTaskId: 596, npcId: 2042 },
        { label: "Hespori", sourceTaskId: 638, npcId: 8583 },
        { label: "Kraken", sourceTaskId: 601, npcId: 494 },
    ];

    const negativeSamples: Array<{
        label: string;
        sourceTaskId: number;
        wrongNpcId: number;
    }> = [
        { label: "Zulrah form blue", sourceTaskId: 596, wrongNpcId: 2043 },
        { label: "Zulrah form red", sourceTaskId: 596, wrongNpcId: 2044 },
        { label: "Kraken phase 6640", sourceTaskId: 601, wrongNpcId: 6640 },
        { label: "Kraken phase 6656", sourceTaskId: 601, wrongNpcId: 6656 },
        { label: "Hespori alt 11192", sourceTaskId: 638, wrongNpcId: 11192 },
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

    for (const sample of positiveSamples) {
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
            logOk(`onNpcKill completes CSV ${sample.sourceTaskId} (${sample.label})`);
        } else {
            logFail(`onNpcKill did not complete CSV ${sample.sourceTaskId} (${sample.label})`);
        }
    }

    for (const sample of negativeSamples) {
        const mvpTaskId = sourceIdToMvpTaskId(sample.sourceTaskId);
        if (mvpTaskId === undefined) {
            logFail(`${sample.label}: missing mvpTaskId for CSV ${sample.sourceTaskId}`);
            continue;
        }
        resetTaskCompletion(player, mvpTaskId);
        manager.onNpcKill(1, sample.wrongNpcId);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logFail(
                `${sample.label}: onNpcKill(${sample.wrongNpcId}) incorrectly completed CSV ${sample.sourceTaskId}`,
            );
        } else {
            logOk(`${sample.label}: onNpcKill(${sample.wrongNpcId}) did not complete task`);
        }
    }

    if (failed > 0) {
        console.error(`\n[verify-phase7b-allowlist-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("\n[verify-phase7b-allowlist-matrices] All allowlist matrix checks passed");
}

main();
