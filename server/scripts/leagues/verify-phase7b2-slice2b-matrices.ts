/**
 * Static npc_kill matrix checks for Phase 7B-2 Slice 2B.
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7b2-slice2b-matrices.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASK_COMPLETION_VARPS } from "../../../src/shared/leagues/leagueTaskVarps";
import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService, type LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
import { PHASE7B2_SLICE2B_APPROVED } from "./lib/phase7b2Slice2bApproved";
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
        tasks: Array<{ sourceTaskId: number; mvpTaskId?: number }>;
    };
    return parsed.tasks.find((t) => t.sourceTaskId === sourceId)?.mvpTaskId;
}

function resetTaskCompletion(player: MockPlayer, taskId: number): void {
    player.clearLeagueTaskProgress(taskId);
    const group = (taskId / 32) | 0;
    const varpId = LEAGUE_TASK_COMPLETION_VARPS[group];
    if (varpId !== undefined) player.setVarpValue(varpId, 0);
}

function main(): void {
    let failed = 0;
    const logOk = (msg: string) => console.log(`OK    ${msg}`);
    const logFail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };

    console.log("[verify-phase7b2-slice2b-matrices] Phase 7B-2 Slice 2B npc_kill checks\n");

    const samples = [
        { label: "Edgeville Goblin", sourceTaskId: 659, npcId: 659, wrongNpcId: 655 },
        { label: "Karamja Volcano Lesser Demon", sourceTaskId: 752, npcId: 2008, wrongNpcId: 2007 },
        { label: "Kalphite Guardian", sourceTaskId: 1054, npcId: 962, wrongNpcId: 959 },
        { label: "Mos LeHarmless Cave Horror", sourceTaskId: 1121, npcId: 1050, wrongNpcId: 1047 },
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

    for (const sample of samples) {
        const mvpTaskId = sourceIdToMvpTaskId(sample.sourceTaskId);
        if (mvpTaskId === undefined) {
            logFail(`${sample.label}: missing mvpTaskId`);
            continue;
        }
        const trigger = getPhase7bNpcTrigger(sample.sourceTaskId);
        if (!trigger || trigger.type !== "npc_kill" || !trigger.npcIds.includes(sample.npcId)) {
            logFail(`${sample.label}: bad manifest trigger`);
            continue;
        }
        logOk(`${sample.label} manifest npc_kill ${sample.npcId}`);

        const indexed = index.getTasksForNpcKill(sample.npcId);
        if (!indexed.find((t) => t.taskId === mvpTaskId)) {
            logFail(`index missing mvpTaskId ${mvpTaskId} for npc ${sample.npcId}`);
            continue;
        }
        logOk(`index npc_kill/${sample.npcId} → mvpTaskId ${mvpTaskId}`);

        resetTaskCompletion(player, mvpTaskId);
        manager.onNpcKill(1, sample.npcId);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`onNpcKill completes CSV ${sample.sourceTaskId}`);
        } else {
            logFail(`onNpcKill failed CSV ${sample.sourceTaskId}`);
        }

        resetTaskCompletion(player, mvpTaskId);
        manager.onNpcKill(1, sample.wrongNpcId);
        if (!LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`wrong npcId ${sample.wrongNpcId} blocked`);
        } else {
            logFail(`wrong npcId ${sample.wrongNpcId} incorrectly completed CSV ${sample.sourceTaskId}`);
        }
    }

    for (const entry of PHASE7B2_SLICE2B_APPROVED) {
        const trig = getPhase7bNpcTrigger(entry.sourceTaskId);
        if (!trig || trig.type !== "npc_kill" || trig.npcIds[0] !== entry.chosenNpcId) {
            logFail(`manifest trigger CSV ${entry.sourceTaskId}`);
        }
    }
    logOk(`all ${PHASE7B2_SLICE2B_APPROVED.length} slice-2b manifest triggers resolve`);

    if (failed > 0) {
        console.error(`\n[verify-phase7b2-slice2b-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("\n[verify-phase7b2-slice2b-matrices] All Slice 2B matrix checks passed");
}

main();
