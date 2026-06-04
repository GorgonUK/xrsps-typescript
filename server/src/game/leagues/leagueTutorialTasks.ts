import { getLeagueTaskIdByName } from "../../../../src/shared/leagues/leagueTasks";
import { LeagueTaskService, type LeagueTaskAwardResult, type LeagueTaskPlayer } from "./LeagueTaskService";

/** OSRS tutorial task names (not tied to numeric ids — the live task list is reordered). */
export const LEAGUE_TUTORIAL_TASK_OPEN_MENU = "Open the Leagues Menu";
export const LEAGUE_TUTORIAL_TASK_COMPLETE = "Complete the Leagues Tutorial";

/**
 * Award a league task by name when present in the live task table.
 * Returns undefined when the task is not imported yet (avoids stale hardcoded ids).
 */
export function completeLeagueTaskByName(
    player: LeagueTaskPlayer,
    taskName: string,
): LeagueTaskAwardResult | undefined {
    const taskId = getLeagueTaskIdByName(taskName);
    if (taskId === undefined) {
        return undefined;
    }
    return LeagueTaskService.completeTask(player, taskId);
}
