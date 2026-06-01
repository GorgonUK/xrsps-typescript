/**
 * Static area_enter matrix checks for Phase 3D Slice 2 (Woodcutting Guild, Taverley Dungeon).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase3d-slice2-matrices.ts
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

const WOODCUTTING_CSV = 1317;
const TAVERLEY_CSV = 785;

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

    console.log("[verify-phase3d-slice2-matrices] Phase 3D Slice 2 area_enter checks\n");

    const woodcuttingTaskId = sourceIdToMvpTaskId(WOODCUTTING_CSV);
    const taverleyTaskId = sourceIdToMvpTaskId(TAVERLEY_CSV);
    if (woodcuttingTaskId === undefined || taverleyTaskId === undefined) {
        console.error("[verify-phase3d-slice2-matrices] Missing mvpTaskId in phase3d manifest");
        process.exit(1);
    }

    const woodcuttingTrigger = LEAGUE_TASK_TRIGGER_BY_ID[woodcuttingTaskId];
    const taverleyTrigger = LEAGUE_TASK_TRIGGER_BY_ID[taverleyTaskId];
    if (woodcuttingTrigger?.type !== "area_enter" || taverleyTrigger?.type !== "area_enter") {
        logFail("live triggers not area_enter");
        process.exit(1);
    }

    const index = LeagueTaskIndex.build(undefined, undefined);
    if (
        !index.getTasksForAreaEnter("woodcutting_guild").some((t) => t.taskId === woodcuttingTaskId)
    ) {
        logFail("index woodcutting_guild miss");
    } else {
        logOk(`index woodcutting_guild → mvpTaskId ${woodcuttingTaskId}`);
    }
    if (!index.getTasksForAreaEnter("taverley_dungeon").some((t) => t.taskId === taverleyTaskId)) {
        logFail("index taverley_dungeon miss");
    } else {
        logOk(`index taverley_dungeon → mvpTaskId ${taverleyTaskId}`);
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

    const woodcuttingOutside = { x: 1620, y: 3478, plane: 0 };
    const woodcuttingInside = { x: 1620, y: 3490, plane: 0 };
    const woodcuttingFalsePositive = { x: 1658, y: 3490, plane: 0 };

    const taverleyOutside = { x: 2801, y: 9800, plane: 0 };
    const taverleyInside = { x: 2850, y: 9800, plane: 0 };
    const taverleySurfaceFalsePositive = { x: 2884, y: 3450, plane: 0 };

    if (
        isInsideLeagueArea(
            "woodcutting_guild",
            woodcuttingFalsePositive.x,
            woodcuttingFalsePositive.y,
            woodcuttingFalsePositive.plane,
        )
    ) {
        logFail(
            `tile ${woodcuttingFalsePositive.x},${woodcuttingFalsePositive.y} inside woodcutting_guild (false positive)`,
        );
    } else {
        logOk(
            `tile ${woodcuttingFalsePositive.x},${woodcuttingFalsePositive.y} outside woodcutting_guild`,
        );
    }

    if (
        isInsideLeagueArea(
            "taverley_dungeon",
            taverleySurfaceFalsePositive.x,
            taverleySurfaceFalsePositive.y,
            taverleySurfaceFalsePositive.plane,
        )
    ) {
        logFail(
            `surface tile ${taverleySurfaceFalsePositive.x},${taverleySurfaceFalsePositive.y} inside taverley_dungeon`,
        );
    } else {
        logOk(
            `surface tile ${taverleySurfaceFalsePositive.x},${taverleySurfaceFalsePositive.y} outside taverley_dungeon`,
        );
    }

    player.clearLeagueTaskProgress(woodcuttingTaskId);
    let inside = simulateEnter(
        manager,
        1,
        new Set(),
        woodcuttingOutside.x,
        woodcuttingOutside.y,
        woodcuttingOutside.plane,
    );
    if (LeagueTaskService.isTaskComplete(player, woodcuttingTaskId)) {
        logFail("woodcutting complete before enter");
    }
    inside = simulateEnter(
        manager,
        1,
        inside,
        woodcuttingInside.x,
        woodcuttingInside.y,
        woodcuttingInside.plane,
    );
    if (LeagueTaskService.isTaskComplete(player, woodcuttingTaskId)) {
        logOk("outside → inside Woodcutting Guild completes");
    } else {
        logFail("outside → inside Woodcutting Guild did not complete");
    }

    const woodcuttingProgressBefore = player.getLeagueTaskProgress(woodcuttingTaskId);
    inside = simulateEnter(
        manager,
        1,
        inside,
        woodcuttingInside.x,
        woodcuttingInside.y,
        woodcuttingInside.plane,
    );
    if (player.getLeagueTaskProgress(woodcuttingTaskId) === woodcuttingProgressBefore) {
        logOk("remaining inside Woodcutting Guild does not re-complete");
    } else {
        logFail("remaining inside Woodcutting Guild changed progress");
    }

    {
        const loginPlayer = createMockPlayer();
        const loginInsideWoodcutting = getLeagueAreasInsideNow(
            woodcuttingInside.x,
            woodcuttingInside.y,
            woodcuttingInside.plane,
        );
        if (!loginInsideWoodcutting.has("woodcutting_guild")) {
            logFail("login tile not detected inside woodcutting_guild for seeding");
        } else if (!LeagueTaskService.isTaskComplete(loginPlayer, woodcuttingTaskId)) {
            logOk("login seed inside Woodcutting Guild does not auto-complete");
        } else {
            logFail("login inside Woodcutting Guild auto-completed");
        }
    }

    player.clearLeagueTaskProgress(taverleyTaskId);
    inside = simulateEnter(
        manager,
        1,
        new Set(),
        taverleyOutside.x,
        taverleyOutside.y,
        taverleyOutside.plane,
    );
    if (LeagueTaskService.isTaskComplete(player, taverleyTaskId)) {
        logFail("taverley complete before enter");
    }
    inside = simulateEnter(
        manager,
        1,
        inside,
        taverleyInside.x,
        taverleyInside.y,
        taverleyInside.plane,
    );
    if (LeagueTaskService.isTaskComplete(player, taverleyTaskId)) {
        logOk("outside → inside Taverley Dungeon completes");
    } else {
        logFail("outside → inside Taverley Dungeon did not complete");
    }

    const taverleyProgressBefore = player.getLeagueTaskProgress(taverleyTaskId);
    inside = simulateEnter(
        manager,
        1,
        inside,
        taverleyInside.x,
        taverleyInside.y,
        taverleyInside.plane,
    );
    if (player.getLeagueTaskProgress(taverleyTaskId) === taverleyProgressBefore) {
        logOk("remaining inside Taverley Dungeon does not re-complete");
    } else {
        logFail("remaining inside Taverley Dungeon changed progress");
    }

    {
        const loginPlayer = createMockPlayer();
        const loginInsideTaverley = getLeagueAreasInsideNow(
            taverleyInside.x,
            taverleyInside.y,
            taverleyInside.plane,
        );
        if (!loginInsideTaverley.has("taverley_dungeon")) {
            logFail("login tile not detected inside taverley_dungeon for seeding");
        } else if (!LeagueTaskService.isTaskComplete(loginPlayer, taverleyTaskId)) {
            logOk("login seed inside Taverley Dungeon does not auto-complete");
        } else {
            logFail("login inside Taverley Dungeon auto-completed");
        }
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase3d-slice2-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase3d-slice2-matrices] All Slice 2 area matrix checks passed");
}

main();
