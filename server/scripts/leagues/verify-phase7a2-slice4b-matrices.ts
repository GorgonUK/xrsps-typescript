/**
 * Static item_equip matrix checks for Phase 7A-2 Slice 4b.
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7a2-slice4b-matrices.ts
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

    console.log("[verify-phase7a2-slice4b-matrices] Phase 7A-2 Slice 4b item_equip checks\n");

    const matrixSamples: Array<{ label: string; sourceTaskId: number; itemId: number; altItemId: number }> = [
        { label: "Shortbow", sourceTaskId: 478, itemId: 841, altItemId: 842 },
        { label: "Helm of Neitiznot", sourceTaskId: 1517, itemId: 10828, altItemId: 10843 },
        { label: "Black Mask", sourceTaskId: 1528, itemId: 8921, altItemId: 8922 },
        { label: "Dragon Platelegs", sourceTaskId: 1573, itemId: 4087, altItemId: 4088 },
        { label: "Granite Shield", sourceTaskId: 1570, itemId: 3122, altItemId: 3134 },
        { label: "Xerician Hat", sourceTaskId: 1608, itemId: 13385, altItemId: 13386 },
        { label: "Unholy Book", sourceTaskId: 1761, itemId: 3842, altItemId: 14407 },
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

    // Dragon Chainbody (1551): registry-backed 3140 — exhaustive candidate matrix.
    const dragonChainCsvId = 1551;
    const dragonChainPositiveId = 3140;
    const dragonChainNegativeIds = [2513, 3141, 14099, 20428];
    const dragonChainMvpTaskId = sourceIdToMvpTaskId(dragonChainCsvId);
    const dragonChainTrigger = getPhase7aCollectionTrigger(dragonChainCsvId);

    if (dragonChainMvpTaskId === undefined || !dragonChainTrigger || dragonChainTrigger.type !== "item_equip") {
        logFail("Dragon Chainbody CSV 1551 missing live manifest");
    } else if (!dragonChainTrigger.itemIds?.includes(dragonChainPositiveId)) {
        logFail("Dragon Chainbody trigger must use itemId 3140");
    } else {
        logOk("Dragon Chainbody manifest item_equip 3140 (registry-backed)");

        resetTaskCompletion(player, dragonChainMvpTaskId);
        manager.onItemEquip(1, dragonChainPositiveId);
        if (LeagueTaskService.isTaskComplete(player, dragonChainMvpTaskId)) {
            logOk("Dragon Chainbody: 3140 completes CSV 1551");
        } else {
            logFail("Dragon Chainbody: 3140 did not complete CSV 1551");
        }

        for (const altId of dragonChainNegativeIds) {
            resetTaskCompletion(player, dragonChainMvpTaskId);
            manager.onItemEquip(1, altId);
            if (LeagueTaskService.isTaskComplete(player, dragonChainMvpTaskId)) {
                logFail(`Dragon Chainbody: alternate item ${altId} incorrectly completed CSV 1551`);
            } else {
                logOk(`Dragon Chainbody: alternate item ${altId} does not complete CSV 1551`);
            }
        }
    }

    if (failed > 0) {
        console.error(`\n[verify-phase7a2-slice4b-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("\n[verify-phase7a2-slice4b-matrices] All Slice 4b matrix checks passed");
}

main();
