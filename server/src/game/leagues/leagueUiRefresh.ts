import { VARBIT_MASTERY_POINT_UNLOCK_BASE } from "../../../../src/shared/leagues/leagueTypes";
import { LEAGUE_TASK_COMPLETION_VARPS } from "../../../../src/shared/leagues/leagueTaskVarps";
import {
    FEATURE_FLAG_LEAGUES,
    MAP_FLAGS_LEAGUE_WORLD,
    VARBIT_LEAGUE_MAGIC_MASTERY,
    VARBIT_LEAGUE_MASTERY_POINTS_EARNED,
    VARBIT_LEAGUE_MASTERY_POINTS_TO_SPEND,
    VARBIT_LEAGUE_MELEE_MASTERY,
    VARBIT_LEAGUE_RANGED_MASTERY,
    VARBIT_LEAGUE_RELIC_1,
    VARBIT_LEAGUE_RELIC_2,
    VARBIT_LEAGUE_RELIC_3,
    VARBIT_LEAGUE_RELIC_4,
    VARBIT_LEAGUE_RELIC_5,
    VARBIT_LEAGUE_RELIC_6,
    VARBIT_LEAGUE_RELIC_7,
    VARBIT_LEAGUE_RELIC_8,
    VARBIT_LEAGUE_TOTAL_TASKS_COMPLETED,
    VARBIT_LEAGUE_TUTORIAL_COMPLETED,
    VARBIT_LEAGUE_TYPE,
    VARP_LEAGUE_GENERAL,
    VARP_LEAGUE_POINTS_CLAIMED,
    VARP_LEAGUE_POINTS_COMPLETED,
    VARP_LEAGUE_POINTS_CURRENCY,
    VARP_FEATURE_FLAGS_CACHED,
    VARP_MAP_FLAGS_CACHED,
} from "../../../../src/shared/vars";
import type { WidgetAction } from "../../widgets/WidgetManager";
import { getLeaguePackedVarpsForPlayer } from "./leaguePackedVarps";

const VARP_LEAGUE_TASK_COUNT = 2612;

const LEAGUE_MASTERY_POINT_UNLOCK_VARBITS: number[] = Array.from({ length: 10 }, (_, i) =>
    VARBIT_MASTERY_POINT_UNLOCK_BASE + i,
);

export type LeagueUiRefreshPlayer = {
    getVarpValue?: (id: number) => number;
    getVarbitValue?: (id: number) => number;
};

export type LeagueUiRefreshServices = {
    queueWidgetEvent?: (playerId: number, action: WidgetAction) => void;
};

function getLeagueVarbitsForRefresh(player: LeagueUiRefreshPlayer): Record<number, number> {
    const varbits: Record<number, number> = {
        [VARBIT_LEAGUE_TYPE]: player.getVarbitValue?.(VARBIT_LEAGUE_TYPE) ?? 0,
        [VARBIT_LEAGUE_TUTORIAL_COMPLETED]:
            player.getVarbitValue?.(VARBIT_LEAGUE_TUTORIAL_COMPLETED) ?? 0,
        [VARBIT_LEAGUE_TOTAL_TASKS_COMPLETED]:
            player.getVarbitValue?.(VARBIT_LEAGUE_TOTAL_TASKS_COMPLETED) ?? 0,
        [VARBIT_LEAGUE_RELIC_1]: player.getVarbitValue?.(VARBIT_LEAGUE_RELIC_1) ?? 0,
        [VARBIT_LEAGUE_RELIC_2]: player.getVarbitValue?.(VARBIT_LEAGUE_RELIC_2) ?? 0,
        [VARBIT_LEAGUE_RELIC_3]: player.getVarbitValue?.(VARBIT_LEAGUE_RELIC_3) ?? 0,
        [VARBIT_LEAGUE_RELIC_4]: player.getVarbitValue?.(VARBIT_LEAGUE_RELIC_4) ?? 0,
        [VARBIT_LEAGUE_RELIC_5]: player.getVarbitValue?.(VARBIT_LEAGUE_RELIC_5) ?? 0,
        [VARBIT_LEAGUE_RELIC_6]: player.getVarbitValue?.(VARBIT_LEAGUE_RELIC_6) ?? 0,
        [VARBIT_LEAGUE_RELIC_7]: player.getVarbitValue?.(VARBIT_LEAGUE_RELIC_7) ?? 0,
        [VARBIT_LEAGUE_RELIC_8]: player.getVarbitValue?.(VARBIT_LEAGUE_RELIC_8) ?? 0,
        [VARBIT_LEAGUE_MELEE_MASTERY]: player.getVarbitValue?.(VARBIT_LEAGUE_MELEE_MASTERY) ?? 0,
        [VARBIT_LEAGUE_RANGED_MASTERY]: player.getVarbitValue?.(VARBIT_LEAGUE_RANGED_MASTERY) ?? 0,
        [VARBIT_LEAGUE_MAGIC_MASTERY]: player.getVarbitValue?.(VARBIT_LEAGUE_MAGIC_MASTERY) ?? 0,
        [VARBIT_LEAGUE_MASTERY_POINTS_TO_SPEND]:
            player.getVarbitValue?.(VARBIT_LEAGUE_MASTERY_POINTS_TO_SPEND) ?? 0,
        [VARBIT_LEAGUE_MASTERY_POINTS_EARNED]:
            player.getVarbitValue?.(VARBIT_LEAGUE_MASTERY_POINTS_EARNED) ?? 0,
    };

    for (const varbitId of LEAGUE_MASTERY_POINT_UNLOCK_VARBITS) {
        varbits[varbitId] = player.getVarbitValue?.(varbitId) ?? 0;
    }

    return varbits;
}

function getLeagueVarpsForRefresh(player: LeagueUiRefreshPlayer): Record<number, number> {
    const varps: Record<number, number> = {
        [VARP_MAP_FLAGS_CACHED]: MAP_FLAGS_LEAGUE_WORLD,
        [VARP_FEATURE_FLAGS_CACHED]: FEATURE_FLAG_LEAGUES,
        [VARP_LEAGUE_GENERAL]: player.getVarpValue?.(VARP_LEAGUE_GENERAL) ?? 0,
        [VARP_LEAGUE_POINTS_CLAIMED]: player.getVarpValue?.(VARP_LEAGUE_POINTS_CLAIMED) ?? 0,
        [VARP_LEAGUE_POINTS_COMPLETED]: player.getVarpValue?.(VARP_LEAGUE_POINTS_COMPLETED) ?? 0,
        [VARP_LEAGUE_POINTS_CURRENCY]: player.getVarpValue?.(VARP_LEAGUE_POINTS_CURRENCY) ?? 0,
        [VARP_LEAGUE_TASK_COUNT]: player.getVarpValue?.(VARP_LEAGUE_TASK_COUNT) ?? 0,
        ...getLeaguePackedVarpsForPlayer({
            getVarbitValue: (id) => player.getVarbitValue?.(id) ?? 0,
            getVarpValue: (id) => player.getVarpValue?.(id) ?? 0,
        }),
    };

    for (const varpId of LEAGUE_TASK_COMPLETION_VARPS) {
        varps[varpId] = player.getVarpValue?.(varpId) ?? 0;
    }

    return varps;
}

/** Refresh the Leagues side panel in the Quest tab (progress bar + task/point text). */
export function refreshLeagueSidePanelProgress(
    playerId: number,
    player: LeagueUiRefreshPlayer,
    services: LeagueUiRefreshServices,
    opts?: {
        leagueType?: number;
        varps?: Record<number, number>;
        varbits?: Record<number, number>;
    },
): void {
    if (!services.queueWidgetEvent) {
        return;
    }

    const leagueType = opts?.leagueType ?? player.getVarbitValue?.(VARBIT_LEAGUE_TYPE) ?? 0;
    const isL3 = leagueType === 3;
    const panelGroupId = isL3 ? 736 : 656;
    const fillChildId = isL3 ? 10 : 23;
    const fillUid = ((panelGroupId & 0xffff) << 16) | (fillChildId & 0xffff);

    services.queueWidgetEvent(playerId, {
        action: "run_script",
        scriptId: isL3 ? 5800 : 3226,
        args: [fillUid, -1],
        varps: opts?.varps ?? getLeagueVarpsForRefresh(player),
        varbits: opts?.varbits ?? getLeagueVarbitsForRefresh(player),
    });
}

/** Refresh league UI surfaces that do not auto-update from varp transmit alone. */
export function refreshLeagueUiAfterTaskComplete(
    playerId: number,
    player: LeagueUiRefreshPlayer,
    services: LeagueUiRefreshServices,
): void {
    refreshLeagueSidePanelProgress(playerId, player, services);
}
