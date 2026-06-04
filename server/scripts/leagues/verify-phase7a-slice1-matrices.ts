/**
 * Static item_equip / item_obtain matrix checks for Phase 7A-1.
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7a-slice1-matrices.ts
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
    const logSkip = (msg: string) => console.log(`SKIP  ${msg}`);

    console.log("[verify-phase7a-slice1-matrices] Phase 7A-1 item hook checks\n");

    const matrixSamples: Array<{
        label: string;
        sourceTaskId: number;
        itemId: number;
        hook: "equip" | "obtain";
        expectImported: boolean;
        skipReason?: string;
    }> = [
        {
            label: "Slayer Helmet",
            sourceTaskId: 321,
            itemId: 11864,
            hook: "equip",
            expectImported: false,
            skipReason: "Tier A rejected: itemId not in collection log registry",
        },
        {
            label: "Giant Key",
            sourceTaskId: 699,
            itemId: 20754,
            hook: "obtain",
            expectImported: true,
        },
        {
            label: "Mossy Key",
            sourceTaskId: 700,
            itemId: 22374,
            hook: "obtain",
            expectImported: true,
        },
        {
            label: "Trident of the Swamp",
            sourceTaskId: 1531,
            itemId: 12899,
            hook: "equip",
            expectImported: false,
            skipReason: "Tier A rejected: not in collection log registry",
        },
        {
            label: "Sanguinesti Staff",
            sourceTaskId: 1543,
            itemId: 22323,
            hook: "equip",
            expectImported: false,
            skipReason: "Tier A rejected: not in collection log registry",
        },
        {
            label: "Bow of Faerdhinen",
            sourceTaskId: 1587,
            itemId: 25865,
            hook: "equip",
            expectImported: false,
            skipReason: "Tier A rejected: not in collection log registry",
        },
        {
            label: "Ferocious Gloves",
            sourceTaskId: 1602,
            itemId: 22981,
            hook: "equip",
            expectImported: false,
            skipReason: "Tier A rejected: not in collection log registry",
        },
        {
            label: "Nightmare Staff (imported proxy)",
            sourceTaskId: 1546,
            itemId: 24422,
            hook: "equip",
            expectImported: true,
        },
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

        if (!sample.expectImported) {
            if (trigger === undefined && mvpTaskId === undefined) {
                logSkip(`${sample.label} CSV ${sample.sourceTaskId}: ${sample.skipReason ?? "not imported"}`);
            } else {
                logFail(`${sample.label} should not be imported but manifest has CSV ${sample.sourceTaskId}`);
            }
            continue;
        }

        if (!trigger || mvpTaskId === undefined) {
            logFail(`${sample.label} CSV ${sample.sourceTaskId} missing manifest/live mapping`);
            continue;
        }

        const expectedType = sample.hook === "equip" ? "item_equip" : "item_obtain";
        if (trigger.type !== expectedType || !trigger.itemIds?.includes(sample.itemId)) {
            logFail(`${sample.label} trigger mismatch`);
            continue;
        }
        logOk(`${sample.label} manifest ${expectedType} itemId ${sample.itemId}`);

        const indexed =
            sample.hook === "equip"
                ? index.getTasksForItemEquip(sample.itemId)
                : index.getTasksForItemObtain(sample.itemId);
        if (!indexed.some((t) => t.taskId === mvpTaskId)) {
            logFail(`index miss mvpTaskId ${mvpTaskId} for ${sample.label}`);
            continue;
        }
        logOk(`index → mvpTaskId ${mvpTaskId}`);

        player.clearLeagueTaskProgress(mvpTaskId);
        if (sample.hook === "equip") {
            manager.onItemEquip(1, sample.itemId);
        } else {
            manager.onItemObtain(1, sample.itemId, 1);
        }
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(`hook completes CSV ${sample.sourceTaskId} (${sample.label})`);
        } else {
            logFail(`hook did not complete CSV ${sample.sourceTaskId} (${sample.label})`);
        }
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase7a-slice1-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase7a-slice1-matrices] All Slice 1 matrix checks passed");
}

main();
