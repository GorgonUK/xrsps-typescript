/**
 * Admin/debug helpers for MVP league task verification.
 */
import { LEAGUE_TASKS } from "../../../../src/shared/leagues/leagueTasks.data";
import { ENUM_IDS } from "../../../../src/shared/leagues/custom/CustomContentTypes";
import { getLeagueTaskTrigger } from "../../../../src/shared/leagues/leagueTaskTriggers";
import {
    getMvpLeagueTaskEnumCountOverride,
    getMvpLeagueTaskEnumValueOverride,
} from "../../../../src/shared/leagues/leagueTasksEnumOverride";
import { getLeagueTaskByTaskId } from "../../../../src/shared/leagues/leagueTasks";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../../src/shared/leagues/leagueTaskTriggers.data";
import { LEAGUE_TASK_COMPLETION_VARPS } from "../../../../src/shared/leagues/leagueTaskVarps";
import type { LeagueTaskRow } from "../../../../src/shared/leagues/leagueTypes";
import {
    VARP_LEAGUE_POINTS_CLAIMED,
    VARP_LEAGUE_POINTS_COMPLETED,
    VARP_LEAGUE_POINTS_CURRENCY,
} from "../../../../src/shared/vars";
import type { PlayerState } from "../player";
import { LeagueTaskService, type LeagueTaskAwardResult } from "./LeagueTaskService";

export type LeagueTaskDebugServices = {
    queueVarp: (playerId: number, varpId: number, value: number) => void;
    queueVarbit: (playerId: number, varbitId: number, value: number) => void;
    queueNotification: (playerId: number, notification: unknown) => void;
    onNpcKill?: (playerId: number, npcId: number, combatLevel?: number) => void;
    onItemObtain?: (playerId: number, itemId: number, count: number) => void;
    onItemEquip?: (playerId: number, itemId: number) => void;
    onItemCraft?: (playerId: number, itemId: number, count: number) => void;
    onSkillingAction?: (
        playerId: number,
        skill: string,
        action: string,
        targetId: number,
        count: number,
    ) => void;
    onAreaEnter?: (playerId: number, areaKey: string) => void;
    onWildernessLevelCross?: (
        playerId: number,
        previousLevel: number,
        currentLevel: number,
    ) => void;
    onSpellCast?: (
        playerId: number,
        opts: {
            spellId?: number;
            spellCategory?: "combat" | "teleport" | "utility" | "binding";
            teleportName?: string;
        },
    ) => void;
    syncSkillProgressLeagueTasks?: (playerId: number) => void;
};

function getTaskBitfield(taskId: number): { varpId: number; mask: number } {
    const bit = taskId & 31;
    const group = taskId >> 5;
    const mappedVarpId = LEAGUE_TASK_COMPLETION_VARPS[group];
    const varpId = mappedVarpId ?? 2616 + group;
    if (varpId < 0) return { varpId: -1, mask: 0 };
    return { varpId, mask: 1 << bit };
}

export function applyLeagueTaskAward(
    player: PlayerState,
    playerId: number,
    result: LeagueTaskAwardResult,
    services: LeagueTaskDebugServices,
): void {
    if (!result.changed) return;
    for (const v of result.varpUpdates) {
        services.queueVarp(playerId, v.id, v.value);
    }
    for (const v of result.varbitUpdates) {
        services.queueVarbit(playerId, v.id, v.value);
    }
    if (result.notification) {
        services.queueNotification(playerId, result.notification);
    }
}

export function completeLeagueTaskDebug(
    player: PlayerState,
    playerId: number,
    taskId: number,
    services: LeagueTaskDebugServices,
): LeagueTaskAwardResult {
    const result = LeagueTaskService.completeTask(player, taskId);
    applyLeagueTaskAward(player, playerId, result, services);
    return result;
}

export function resetLeagueTask(player: PlayerState, taskId: number): boolean {
    const tid = taskId | 0;
    const row = getLeagueTaskByTaskId(tid);
    if (!row) return false;

    const { varpId, mask } = getTaskBitfield(tid);
    if (varpId < 0 || mask === 0) return false;

    const prev = player.getVarpValue(varpId);
    if ((prev & mask) === 0) {
        player.clearLeagueTaskProgress(tid);
        return true;
    }

    player.setVarpValue(varpId, prev & ~mask);
    player.clearLeagueTaskProgress(tid);
    return true;
}

export function resetAllMvpLeagueTasks(player: PlayerState): number {
    let count = 0;
    for (const row of LEAGUE_TASKS) {
        if (resetLeagueTask(player, row.taskId)) count++;
    }
    return count;
}

function formatTaskLine(row: LeagueTaskRow, player: PlayerState): string {
    const complete = LeagueTaskService.isTaskComplete(player, row.taskId) ? "Y" : "N";
    const progress = player.getLeagueTaskProgress(row.taskId);
    const structId = row.structId ?? -1;
    const trigger = getLeagueTaskTrigger(row.taskId);
    const triggerType = trigger?.type ?? "?";
    return `[${row.taskId}] struct=${structId} done=${complete} prog=${progress} ${triggerType} | ${row.name}`;
}

export function listMvpLeagueTasks(player: PlayerState): string[] {
    const lines: string[] = [`MVP league tasks (${LEAGUE_TASKS.length}):`];
    for (const row of LEAGUE_TASKS) {
        lines.push(formatTaskLine(row, player));
    }
    return lines;
}

export function showLeagueTaskProgress(player: PlayerState, taskId?: number): string[] {
    if (taskId !== undefined) {
        const row = getLeagueTaskByTaskId(taskId);
        if (!row) return [`Unknown task id ${taskId} (MVP range 0-${LEAGUE_TASKS.length - 1})`];
        return [formatTaskLine(row, player)];
    }
    const completed = LEAGUE_TASKS.filter((r) =>
        LeagueTaskService.isTaskComplete(player, r.taskId),
    ).length;
    const lines: string[] = [
        `Completed ${completed}/${LEAGUE_TASKS.length}. Points currency=${player.getVarpValue(VARP_LEAGUE_POINTS_CURRENCY)}`,
    ];
    for (const row of LEAGUE_TASKS) {
        const prog = player.getLeagueTaskProgress(row.taskId);
        const done = LeagueTaskService.isTaskComplete(player, row.taskId);
        if (done || prog > 0) {
            lines.push(formatTaskLine(row, player));
        }
    }
    return lines;
}

export function verifyMvpLeagueTasksStatic(): string[] {
    const lines: string[] = [];
    let ok = true;

    const enumCount = getMvpLeagueTaskEnumCountOverride(ENUM_IDS.L5_TASKS);
    if (enumCount !== LEAGUE_TASKS.length) {
        ok = false;
        lines.push(`FAIL enum count: ${enumCount} !== tasks ${LEAGUE_TASKS.length}`);
    } else {
        lines.push(`OK enum ${ENUM_IDS.L5_TASKS} count = ${enumCount}`);
    }

    const triggerKeys = Object.keys(LEAGUE_TASK_TRIGGER_BY_ID).length;
    if (triggerKeys !== LEAGUE_TASKS.length) {
        ok = false;
        lines.push(`FAIL triggers ${triggerKeys} !== tasks ${LEAGUE_TASKS.length}`);
    } else {
        lines.push(`OK triggers = ${triggerKeys}`);
    }

    for (let i = 0; i < LEAGUE_TASKS.length; i++) {
        const row = LEAGUE_TASKS[i];
        if (row.taskId !== i) {
            ok = false;
            lines.push(`FAIL taskId not contiguous at index ${i}: ${row.taskId}`);
        }
        const expectedStruct = 90_000 + row.taskId;
        if (row.structId !== expectedStruct) {
            ok = false;
            lines.push(
                `FAIL task ${row.taskId} structId ${row.structId} !== ${expectedStruct}`,
            );
        }
        const enumStruct = getMvpLeagueTaskEnumValueOverride(ENUM_IDS.L5_TASKS, row.taskId);
        if (enumStruct !== expectedStruct) {
            ok = false;
            lines.push(`FAIL enum[${row.taskId}] = ${enumStruct} !== ${expectedStruct}`);
        }
        if (!getLeagueTaskTrigger(row.taskId)) {
            ok = false;
            lines.push(`FAIL missing trigger for task ${row.taskId}`);
        }
    }

    lines.unshift(ok ? "<col=00ff00>MVP verify: PASS</col>" : "<col=ff0000>MVP verify: FAIL</col>");
    return lines;
}

export function simulateLeagueTaskTrigger(
    player: PlayerState,
    playerId: number,
    type: string,
    args: string[],
    services: LeagueTaskDebugServices,
): string[] {
    void player;
    const typeNorm = type.toLowerCase().replace(/-/g, "_");

    if (typeNorm === "skill" || typeNorm === "skilling" || typeNorm === "skill_progress") {
        services.syncSkillProgressLeagueTasks?.(playerId);
        return ["Simulated syncSkillProgressLeagueTasks."];
    }

    switch (typeNorm) {
        case "npc_kill":
        case "boss_kill": {
            const id = args[0] !== undefined ? parseInt(args[0], 10) : NaN;
            if (!Number.isFinite(id)) {
                return ["Usage: ::ltask sim npc_kill <npcTypeId>"];
            }
            services.onNpcKill?.(playerId, id, 999);
            return [`Simulated onNpcKill npcTypeId=${id}`];
        }

        case "item_obtain":
        case "obtain": {
            const id = args[0] !== undefined ? parseInt(args[0], 10) : NaN;
            const count = args[1] !== undefined ? Math.max(1, parseInt(args[1], 10) || 1) : 1;
            if (!Number.isFinite(id)) {
                return ["Usage: ::ltask sim item_obtain <itemId> [count]"];
            }
            services.onItemObtain?.(playerId, id, count);
            return [`Simulated onItemObtain itemId=${id} count=${count}`];
        }

        case "item_equip":
        case "equip": {
            const id = args[0] !== undefined ? parseInt(args[0], 10) : NaN;
            if (!Number.isFinite(id)) {
                return ["Usage: ::ltask sim item_equip <itemId>"];
            }
            services.onItemEquip?.(playerId, id);
            return [`Simulated onItemEquip itemId=${id}`];
        }

        case "item_craft":
        case "craft": {
            const id = args[0] !== undefined ? parseInt(args[0], 10) : NaN;
            const count = args[1] !== undefined ? Math.max(1, parseInt(args[1], 10) || 1) : 1;
            if (!Number.isFinite(id)) {
                return ["Usage: ::ltask sim item_craft <itemId> [count]"];
            }
            services.onItemCraft?.(playerId, id, count);
            return [`Simulated onItemCraft itemId=${id} count=${count}`];
        }

        case "skilling_action": {
            const skill = args[0];
            const action = args[1];
            const targetId = args[2] !== undefined ? parseInt(args[2], 10) : NaN;
            const actionCount =
                args[3] !== undefined ? Math.max(1, parseInt(args[3], 10) || 1) : 1;
            if (!skill || !action || !Number.isFinite(targetId)) {
                return [
                    "Usage: ::ltask sim skilling_action <skill> <action> <targetId> [count]",
                    "Example: ::ltask sim skilling_action mining mine 453",
                ];
            }
            services.onSkillingAction?.(playerId, skill, action, targetId, actionCount);
            return [
                `Simulated onSkillingAction skill=${skill} action=${action} targetId=${targetId} count=${actionCount}`,
            ];
        }

        case "area_enter": {
            const areaKey = args[0]?.trim().toLowerCase();
            if (!areaKey) {
                return ["Usage: ::ltask sim area_enter <areaKey>"];
            }
            services.onAreaEnter?.(playerId, areaKey);
            return [`Simulated onAreaEnter areaKey=${areaKey}`];
        }

        case "wilderness_level": {
            const minLevel = args[0] !== undefined ? parseInt(args[0], 10) : NaN;
            if (!Number.isFinite(minLevel) || minLevel <= 0) {
                return ["Usage: ::ltask sim wilderness_level <minLevel>"];
            }
            services.onWildernessLevelCross?.(playerId, minLevel - 1, minLevel);
            return [`Simulated onWildernessLevelCross minLevel=${minLevel}`];
        }

        case "spell_cast": {
            const spellId =
                args[0] !== undefined && args[0] !== "teleport"
                    ? parseInt(args[0], 10)
                    : undefined;
            const teleportName =
                args[0] === "teleport" ? args.slice(1).join(" ") : args[1]?.trim();
            if (
                (spellId === undefined || !Number.isFinite(spellId) || spellId <= 0) &&
                !teleportName
            ) {
                return [
                    "Usage: ::ltask sim spell_cast <spellId>",
                    "       ::ltask sim spell_cast teleport <Teleport Name>",
                    "Example: ::ltask sim spell_cast 3273",
                    "Example: ::ltask sim spell_cast teleport Varrock Teleport",
                ];
            }
            services.onSpellCast?.(playerId, {
                spellId: spellId && spellId > 0 ? spellId : undefined,
                teleportName: teleportName || undefined,
                spellCategory: teleportName ? "teleport" : undefined,
            });
            if (teleportName) {
                return [`Simulated onSpellCast teleportName=${teleportName}`];
            }
            return [`Simulated onSpellCast spellId=${spellId}`];
        }

        default:
            return [
                "Unknown sim type. Use: skill | npc_kill | item_obtain | item_equip | item_craft | skilling_action | area_enter | wilderness_level | spell_cast",
            ];
    }
}

export function handleLeagueTaskDebugCommand(
    player: PlayerState,
    parts: string[],
    services: LeagueTaskDebugServices,
): string[] | null {
    const sub = (parts[1] ?? "help").toLowerCase();
    const playerId = player.id;

    switch (sub) {
        case "help":
        case "?":
            return [
                "::ltask list — list all MVP tasks",
                "::ltask verify — static enum/struct/trigger checks",
                "::ltask complete <id> — force complete",
                "::ltask reset <id|all> — clear completion",
                "::ltask progress [id] — show progress",
                "::ltask sim <type> [args...] — simulate trigger",
                "::ltask sim skilling_action <skill> <action> <targetId> [count]",
                "::ltask sim area_enter <areaKey>",
                "::ltask sim spell_cast <spellId>",
                "::ltask sim spell_cast teleport <Teleport Name>",
                "::ltask sim wilderness_level <minLevel>",
                "::ltask sim skill_progress — sync level/combat milestones",
            ];

        case "list":
            return listMvpLeagueTasks(player);

        case "verify":
            return verifyMvpLeagueTasksStatic();

        case "complete": {
            const taskId = parseInt(parts[2] ?? "", 10);
            if (!Number.isFinite(taskId)) {
                return ["Usage: ::ltask complete <taskId>"];
            }
            const result = completeLeagueTaskDebug(player, playerId, taskId, services);
            return [
                result.changed
                    ? `Completed task ${taskId}.`
                    : `Task ${taskId} already complete or invalid.`,
            ];
        }

        case "reset": {
            const target = parts[2] ?? "";
            if (target.toLowerCase() === "all") {
                const n = resetAllMvpLeagueTasks(player);
                return [
                    `Reset ${n} task(s). Note: league points varps are not reversed.`,
                ];
            }
            const taskId = parseInt(target, 10);
            if (!Number.isFinite(taskId)) {
                return ["Usage: ::ltask reset <taskId|all>"];
            }
            return [
                resetLeagueTask(player, taskId)
                    ? `Reset task ${taskId}.`
                    : `Could not reset task ${taskId}.`,
            ];
        }

        case "progress": {
            const taskIdRaw = parts[2];
            const taskId =
                taskIdRaw !== undefined ? parseInt(taskIdRaw, 10) : undefined;
            if (taskIdRaw !== undefined && !Number.isFinite(taskId!)) {
                return ["Usage: ::ltask progress [taskId]"];
            }
            return showLeagueTaskProgress(player, taskId);
        }

        case "sim":
        case "simulate":
            return simulateLeagueTaskTrigger(
                player,
                playerId,
                parts[2] ?? "",
                parts.slice(3),
                services,
            );

        default:
            return [`Unknown ::ltask subcommand "${sub}". Try ::ltask help`];
    }
}
