/**
 * Static item_equip matrix checks for Phase 7A-2 (Tier B-1 slice).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7a-slice2-matrices.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASK_COMPLETION_VARPS } from "../../../src/shared/leagues/leagueTaskVarps";
import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService } from "../../src/game/leagues/LeagueTaskService";
import type { LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
import { getPhase7aCollectionTrigger } from "./lib/phase7aCollectionTriggers";

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
    const manifestPath = path.resolve(__dirname, "../../data/leagues/phase7a-collection-disambiguation.json");
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

function main(): void {
    let failed = 0;
    const logOk = (msg: string) => console.log(`OK    ${msg}`);
    const logFail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };

    console.log("[verify-phase7a-slice2-matrices] Phase 7A-2 item_equip checks\n");

    const matrixSamples: Array<{ label: string; sourceTaskId: number; itemId: number; altItemId: number }> = [
        { label: "Dragon pickaxe", sourceTaskId: 1482, itemId: 11920, altItemId: 11921 },
        { label: "Ring of the gods", sourceTaskId: 1485, itemId: 12601, altItemId: 12602 },
        { label: "Armadyl crossbow", sourceTaskId: 1493, itemId: 11785, altItemId: 11786 },
        { label: "Berserker ring", sourceTaskId: 1509, itemId: 6737, altItemId: 6738 },
        { label: "Abyssal whip", sourceTaskId: 1524, itemId: 4151, altItemId: 4152 },
        { label: "Ghrazi rapier", sourceTaskId: 1544, itemId: 22324, altItemId: 22483 },
        { label: "Lightbearer", sourceTaskId: 1557, itemId: 25975, altItemId: 25976 },
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
        const trigger = getPhase7aCollectionTrigger(sample.sourceTaskId);
        const mvpTaskId = sourceIdToMvpTaskId(sample.sourceTaskId);
        if (!trigger || trigger.type !== "item_equip" || mvpTaskId === undefined) {
            logFail(`${sample.label} CSV ${sample.sourceTaskId} missing live manifest`);
            continue;
        }
        if (!trigger.itemIds?.includes(sample.itemId)) {
            logFail(`${sample.label} trigger itemId mismatch`);
            continue;
        }
        logOk(`${sample.label} manifest item_equip ${sample.itemId}`);

        if (!index.getTasksForItemEquip(sample.itemId).some((t) => t.taskId === mvpTaskId)) {
            logFail(`index miss mvpTaskId ${mvpTaskId} for ${sample.label}`);
            continue;
        }
        logOk(`index item_equip/${sample.itemId} -> mvpTaskId ${mvpTaskId}`);

        resetTaskCompletion(player, mvpTaskId);
        manager.onItemEquip(1, sample.itemId);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`onItemEquip completes CSV ${sample.sourceTaskId} (${sample.label})`);
        } else {
            logFail(`onItemEquip did not complete CSV ${sample.sourceTaskId} (${sample.label})`);
        }

        resetTaskCompletion(player, mvpTaskId);
        manager.onItemEquip(1, sample.altItemId);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logFail(
                `alternate item ${sample.altItemId} incorrectly completed CSV ${sample.sourceTaskId} (${sample.label})`,
            );
        } else {
            logOk(`alternate item ${sample.altItemId} does not complete (${sample.label})`);
        }
    }

    if (failed > 0) {
        console.error(`\n[verify-phase7a-slice2-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("\n[verify-phase7a-slice2-matrices] All Slice 2 matrix checks passed");
}

main();
