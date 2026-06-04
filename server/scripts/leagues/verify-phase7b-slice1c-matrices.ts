/**
 * Static npc_kill matrix checks for Phase 7B-1c.
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7b-slice1c-matrices.ts
 */
import fs from "fs";
import path from "path";

import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService, type LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
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

    console.log("[verify-phase7b-slice1c-matrices] Phase 7B-1c npc_kill checks\n");

    const matrixSamples: Array<{
        label: string;
        sourceTaskId: number;
        npcId: number;
    }> = [
        { label: "Graardor", sourceTaskId: 604, npcId: 2215 },
        { label: "Rex", sourceTaskId: 592, npcId: 2267 },
        { label: "Skeletal Wyvern", sourceTaskId: 580, npcId: 465 },
        { label: "Abyssal Sire", sourceTaskId: 603, npcId: 5886 },
        { label: "Cerberus", sourceTaskId: 600, npcId: 5863 },
        { label: "Vorkath", sourceTaskId: 597, npcId: 8058 },
        { label: "Vet'ion", sourceTaskId: 640, npcId: 6611 },
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

        player.clearLeagueTaskProgress(mvpTaskId);
        manager.onNpcKill(1, sample.npcId);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`onNpcKill completes CSV ${sample.sourceTaskId} (${sample.label})`);
        } else {
            logFail(`onNpcKill did not complete CSV ${sample.sourceTaskId} (${sample.label})`);
        }
    }

    if (failed > 0) {
        console.error(`\n[verify-phase7b-slice1c-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("\n[verify-phase7b-slice1c-matrices] All Slice 1c matrix checks passed");
}

main();
