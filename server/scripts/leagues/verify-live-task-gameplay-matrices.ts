/**
 * Matrix tests: grouped gameplay actions complete expected live task sets.
 *
 * Usage: npx tsx server/scripts/leagues/verify-live-task-gameplay-matrices.ts
 */
import path from "path";

import { LEAGUE_TASK_COMPLETION_VARPS } from "../../../src/shared/leagues/leagueTaskVarps";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";
import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService, type LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
import {
    buildGameplayTestGroups,
    buildLiveTaskGameplayAudit,
} from "./lib/liveTaskGameplayAudit";

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

function resetTaskCompletion(player: MockPlayer, taskId: number): void {
    player.clearLeagueTaskProgress(taskId);
    const group = (taskId / 32) | 0;
    const varpId = LEAGUE_TASK_COMPLETION_VARPS[group];
    if (varpId !== undefined) player.setVarpValue(varpId, 0);
}

function main(): void {
    let failed = 0;
    const logOk = (msg: string) => console.log(`OK    ${msg}`);
    const logFail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };

    console.log("[verify-live-task-gameplay-matrices] Grouped gameplay action checks\n");

    const audit = buildLiveTaskGameplayAudit(path.resolve(__dirname, "../../.."));
    const groups = buildGameplayTestGroups(audit);

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

    // Representative samples per trigger type (fixed high-value groups)
    const samples: Array<{
        label: string;
        invoke: () => void;
        taskIds: number[];
        wrongInvoke?: () => void;
        wrongLabel?: string;
    }> = [];

    for (const [, g] of groups) {
        if (g.taskIds.length === 0) continue;
        const entry = audit.entries.find((e) => e.taskId === g.taskIds[0]);
        if (!entry) continue;

        if (entry.triggerType === "skilling_action") {
            const m = entry.triggerDetail.match(/^(\w+)\/(\w+)/);
            const skill = m?.[1];
            const action = m?.[2];
            const tid = entry.targetIds[0];
            if (!skill || !action || !tid) continue;
            samples.push({
                label: `${g.actionLabel} (${g.taskIds.length} tasks)`,
                taskIds: g.taskIds,
                invoke: () => {
                    let maxCount = 1;
                    for (const taskId of g.taskIds) {
                        const trig = LEAGUE_TASK_TRIGGER_BY_ID[taskId];
                        if (trig?.type === "skilling_action") {
                            maxCount = Math.max(maxCount, trig.count ?? 1);
                        }
                    }
                    manager.onSkillingAction(1, skill, action, tid, maxCount);
                },
            });
        } else if (entry.triggerType === "npc_kill") {
            const nid = entry.targetIds[0];
            samples.push({
                label: `Kill npc ${nid} (${g.taskIds.length} tasks)`,
                taskIds: g.taskIds,
                invoke: () => manager.onNpcKill(1, nid),
                wrongInvoke: () => manager.onNpcKill(1, 1),
                wrongLabel: "wrong npcId",
            });
        } else if (entry.triggerType === "item_equip") {
            const iid = entry.targetIds[0];
            samples.push({
                label: `Equip ${iid} (${g.taskIds.length} tasks)`,
                taskIds: g.taskIds,
                invoke: () => manager.onItemEquip(1, iid),
            });
        }
    }

    // Cap samples for runtime — test unique groups, prioritize multi-task groups
    const prioritized = samples
        .sort((a, b) => b.taskIds.length - a.taskIds.length)
        .slice(0, 40);

    for (const sample of prioritized) {
        for (const taskId of sample.taskIds) {
            resetTaskCompletion(player, taskId);
        }
        sample.invoke();
        for (const taskId of sample.taskIds) {
            if (LeagueTaskService.isTaskComplete(player, taskId)) {
                logOk(`${sample.label} → taskId ${taskId}`);
            } else {
                logFail(`${sample.label} → taskId ${taskId} not complete`);
            }
        }

        if (sample.wrongInvoke && sample.taskIds.length === 1) {
            const taskId = sample.taskIds[0];
            resetTaskCompletion(player, taskId);
            sample.wrongInvoke();
            if (!LeagueTaskService.isTaskComplete(player, taskId)) {
                logOk(`${sample.wrongLabel} blocked for taskId ${taskId}`);
            } else {
                logFail(`${sample.wrongLabel} incorrectly completed taskId ${taskId}`);
            }
        }
    }

    // Woodcut MVP fix verification (after trigger correction)
    const woodcutSamples = [
        { taskId: 41, logId: 1511 },
        { taskId: 42, logId: 1521 },
        { taskId: 47, cookedId: 2140 },
        { taskId: 48, hunterNpcTypeId: 5551 },
    ];
    console.log("\n=== MVP woodcut/cook/hunter natural path ===");
    for (const s of woodcutSamples) {
        resetTaskCompletion(player, s.taskId);
        if (s.logId) {
            manager.onSkillingAction(1, "woodcutting", "chop", s.logId, 1);
        } else if (s.cookedId) {
            manager.onSkillingAction(1, "cooking", "cook", s.cookedId, 1);
        } else if (s.hunterNpcTypeId) {
            manager.onSkillingAction(1, "hunter", "catch", s.hunterNpcTypeId, 1);
        }
        if (LeagueTaskService.isTaskComplete(player, s.taskId)) {
            logOk(`MVP taskId ${s.taskId} completes via skilling_action`);
        } else {
            logFail(`MVP taskId ${s.taskId} not complete via skilling_action`);
        }
    }

    if (failed > 0) {
        console.error(`\n[verify-live-task-gameplay-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("\n[verify-live-task-gameplay-matrices] All sampled gameplay matrix checks passed");
}

main();
