/**
 * Static item_equip matrix checks for Phase 7A-1b (allowlist slice).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7a-slice1b-matrices.ts
 */
import fs from "fs";
import path from "path";

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

function main(): void {
    let failed = 0;
    const logOk = (msg: string) => console.log(`OK    ${msg}`);
    const logFail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };

    console.log("[verify-phase7a-slice1b-matrices] Phase 7A-1b item_equip checks\n");

    const matrixSamples: Array<{ label: string; sourceTaskId: number; itemId: number }> = [
        { label: "Slayer Helmet", sourceTaskId: 321, itemId: 11864 },
        { label: "Trident of the Swamp", sourceTaskId: 1531, itemId: 12899 },
        { label: "Abyssal Tentacle", sourceTaskId: 1532, itemId: 12006 },
        { label: "Ferocious Gloves", sourceTaskId: 1602, itemId: 22981 },
        { label: "Tome of Fire", sourceTaskId: 1603, itemId: 20714 },
        { label: "Holy Book", sourceTaskId: 1760, itemId: 3840 },
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
        logOk(`index item_equip/${sample.itemId} → mvpTaskId ${mvpTaskId}`);

        player.clearLeagueTaskProgress(mvpTaskId);
        manager.onItemEquip(1, sample.itemId);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`onItemEquip completes CSV ${sample.sourceTaskId} (${sample.label})`);
        } else {
            logFail(`onItemEquip did not complete CSV ${sample.sourceTaskId} (${sample.label})`);
        }
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase7a-slice1b-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase7a-slice1b-matrices] All Slice 1b matrix checks passed");
}

main();
