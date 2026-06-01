/**
 * Static area_enter matrix checks for Phase 3D Slice 1 (Crafting Guild, Warriors' Guild).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase3d-slice1-matrices.ts
 */
import fs from "fs";
import path from "path";

import {
    getLeagueAreasInsideNow,
    isInsideLeagueArea,
    resolveEnteredLeagueAreas,
} from "../../src/game/leagues/AreaRegistry";
import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService } from "../../src/game/leagues/LeagueTaskService";
import type { LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";

const CRAFTING_CSV = 779;
const WARRIORS_CSV = 781;

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
    const manifestPath = path.resolve(__dirname, "../../data/leagues/phase3d-area-tasks.json");
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        tasks: Array<{ sourceTaskId: number; mvpTaskId?: number }>;
    };
    return parsed.tasks.find((t) => t.sourceTaskId === sourceId)?.mvpTaskId;
}

function simulateEnter(
    manager: LeagueTaskManager,
    playerId: number,
    previousInside: Set<string>,
    x: number,
    y: number,
    plane: number,
): Set<string> {
    const { entered, insideNow } = resolveEnteredLeagueAreas(previousInside, x, y, plane);
    for (const areaKey of entered) {
        manager.onAreaEnter(playerId, areaKey);
    }
    return insideNow;
}

function main(): void {
    let failed = 0;
    const logOk = (msg: string) => console.log(`OK    ${msg}`);
    const logFail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };

    console.log("[verify-phase3d-slice1-matrices] Phase 3D Slice 1 area_enter checks\n");

    const craftingTaskId = sourceIdToMvpTaskId(CRAFTING_CSV);
    const warriorsTaskId = sourceIdToMvpTaskId(WARRIORS_CSV);
    if (craftingTaskId === undefined || warriorsTaskId === undefined) {
        console.error("[verify-phase3d-slice1-matrices] Missing mvpTaskId in phase3d manifest");
        process.exit(1);
    }

    const craftingTrigger = LEAGUE_TASK_TRIGGER_BY_ID[craftingTaskId];
    const warriorsTrigger = LEAGUE_TASK_TRIGGER_BY_ID[warriorsTaskId];
    if (craftingTrigger?.type !== "area_enter" || warriorsTrigger?.type !== "area_enter") {
        logFail("live triggers not area_enter");
        process.exit(1);
    }

    const index = LeagueTaskIndex.build(undefined, undefined);
    if (
        !index.getTasksForAreaEnter("crafting_guild").some((t) => t.taskId === craftingTaskId)
    ) {
        logFail("index crafting_guild miss");
    } else {
        logOk(`index crafting_guild → mvpTaskId ${craftingTaskId}`);
    }
    if (
        !index.getTasksForAreaEnter("warriors_guild").some((t) => t.taskId === warriorsTaskId)
    ) {
        logFail("index warriors_guild miss");
    } else {
        logOk(`index warriors_guild → mvpTaskId ${warriorsTaskId}`);
    }

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

    const craftingOutside = { x: 2930, y: 3273, plane: 0 };
    const craftingInside = { x: 2930, y: 3280, plane: 0 };
    const faladorNearby = { x: 2965, y: 3380, plane: 0 };

    const warriorsOutside = { x: 2832, y: 3545, plane: 0 };
    const warriorsInside = { x: 2855, y: 3545, plane: 0 };
    const burthorpeNearby = { x: 2920, y: 3540, plane: 0 };

    // 7. Nearby Falador tiles do not trigger Crafting Guild
    if (isInsideLeagueArea("crafting_guild", faladorNearby.x, faladorNearby.y, faladorNearby.plane)) {
        logFail(`Falador tile ${faladorNearby.x},${faladorNearby.y} inside crafting_guild`);
    } else {
        logOk(`Falador tile ${faladorNearby.x},${faladorNearby.y} outside crafting_guild`);
    }

    // 8. Nearby Burthorpe tiles do not trigger Warriors' Guild
    if (
        isInsideLeagueArea("warriors_guild", burthorpeNearby.x, burthorpeNearby.y, burthorpeNearby.plane)
    ) {
        logFail(`Burthorpe tile ${burthorpeNearby.x},${burthorpeNearby.y} inside warriors_guild`);
    } else {
        logOk(`Burthorpe tile ${burthorpeNearby.x},${burthorpeNearby.y} outside warriors_guild`);
    }

    // 1. Outside → inside Crafting Guild completes
    player.clearLeagueTaskProgress(craftingTaskId);
    let inside = simulateEnter(manager, 1, new Set(), craftingOutside.x, craftingOutside.y, craftingOutside.plane);
    if (LeagueTaskService.isTaskComplete(player, craftingTaskId)) {
        logFail("crafting complete before enter");
    }
    inside = simulateEnter(manager, 1, inside, craftingInside.x, craftingInside.y, craftingInside.plane);
    if (LeagueTaskService.isTaskComplete(player, craftingTaskId)) {
        logOk("outside → inside Crafting Guild completes");
    } else {
        logFail("outside → inside Crafting Guild did not complete");
    }

    // 2. Remaining inside does not re-complete
    const progressBefore = player.getLeagueTaskProgress(craftingTaskId);
    inside = simulateEnter(manager, 1, inside, craftingInside.x, craftingInside.y, craftingInside.plane);
    if (player.getLeagueTaskProgress(craftingTaskId) === progressBefore) {
        logOk("remaining inside Crafting Guild does not re-complete");
    } else {
        logFail("remaining inside Crafting Guild changed progress");
    }

    // 3. Login inside Crafting Guild does not auto-complete (fresh player, seed only — no enter event)
    {
        const loginPlayer = createMockPlayer();
        const loginInsideCrafting = getLeagueAreasInsideNow(
            craftingInside.x,
            craftingInside.y,
            craftingInside.plane,
        );
        if (!loginInsideCrafting.has("crafting_guild")) {
            logFail("login tile not detected inside crafting_guild for seeding");
        } else if (!LeagueTaskService.isTaskComplete(loginPlayer, craftingTaskId)) {
            logOk("login seed inside Crafting Guild does not auto-complete");
        } else {
            logFail("login inside Crafting Guild auto-completed");
        }
    }

    // 4. Outside → inside Warriors' Guild completes
    player.clearLeagueTaskProgress(warriorsTaskId);
    inside = simulateEnter(manager, 1, new Set(), warriorsOutside.x, warriorsOutside.y, warriorsOutside.plane);
    if (LeagueTaskService.isTaskComplete(player, warriorsTaskId)) {
        logFail("warriors complete before enter");
    }
    inside = simulateEnter(manager, 1, inside, warriorsInside.x, warriorsInside.y, warriorsInside.plane);
    if (LeagueTaskService.isTaskComplete(player, warriorsTaskId)) {
        logOk("outside → inside Warriors' Guild completes");
    } else {
        logFail("outside → inside Warriors' Guild did not complete");
    }

    // 5. Remaining inside does not re-complete
    const warriorsProgressBefore = player.getLeagueTaskProgress(warriorsTaskId);
    inside = simulateEnter(manager, 1, inside, warriorsInside.x, warriorsInside.y, warriorsInside.plane);
    if (player.getLeagueTaskProgress(warriorsTaskId) === warriorsProgressBefore) {
        logOk("remaining inside Warriors' Guild does not re-complete");
    } else {
        logFail("remaining inside Warriors' Guild changed progress");
    }

    // 6. Login inside Warriors' Guild does not auto-complete (fresh player, seed only — no enter event)
    {
        const loginPlayer = createMockPlayer();
        const loginInsideWarriors = getLeagueAreasInsideNow(
            warriorsInside.x,
            warriorsInside.y,
            warriorsInside.plane,
        );
        if (!loginInsideWarriors.has("warriors_guild")) {
            logFail("login tile not detected inside warriors_guild for seeding");
        } else if (!LeagueTaskService.isTaskComplete(loginPlayer, warriorsTaskId)) {
            logOk("login seed inside Warriors' Guild does not auto-complete");
        } else {
            logFail("login inside Warriors' Guild auto-completed");
        }
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase3d-slice1-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase3d-slice1-matrices] All Slice 1 area matrix checks passed");
}

main();
