/**
 * Static skilling_action matrix checks for Phase 2C-A (no server boot).
 */
import fs from "fs";
import path from "path";

import { COOKING_RECIPES } from "../../src/game/skills/skillSurfaces";
import { getFiremakingLogDefinition } from "../../src/game/skills/firemaking";
import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService } from "../../src/game/leagues/LeagueTaskService";
import type { LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";
import { getPhase2SkillingTrigger } from "./lib/phase2Triggers";
import { getPhase2cSkillingTrigger } from "./lib/phase2cSkillingTriggers";
import { parseCsvFile } from "./lib/csv";

const CSV_201_MVP_TASK_ID = 69;
const PHASE2C_BATCH1_SOURCE_IDS = [
    656, 801, 684, 941, 1333, 712, 791, 688, 760, 658, 845, 1035, 690, 800, 685, 803, 96, 99,
    749,
];

type MockPlayer = LeagueTaskPlayer & {
    varps: Map<number, number>;
    varbits: Map<number, number>;
    progress: Map<number, number>;
};

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

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
    const manifestPath = path.resolve(__dirname, "../../data/leagues/phase2c-skilling-tasks.json");
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

    console.log("[verify-phase2c-matrices] Phase 2C skilling_action matrix checks\n");

    // --- cook_tuna / CSV 201 fix ---
    const cookTunaRecipe = COOKING_RECIPES.find((r) => r.id === "cook_tuna");
    if (cookTunaRecipe?.cookedItemId === 361) {
        logOk("cook_tuna recipe emits cookedItemId 361");
    } else {
        logFail(`cook_tuna recipe cookedItemId=${cookTunaRecipe?.cookedItemId ?? "missing"}`);
    }

    const trigger201 = getPhase2SkillingTrigger(201);
    if (trigger201?.type === "skilling_action" && trigger201.targetIds?.includes(361)) {
        logOk("CSV 201 phase2 manifest targetId 361");
    } else {
        logFail(`CSV 201 phase2 trigger targetIds=${JSON.stringify(trigger201)}`);
    }

    const liveTrigger69 = LEAGUE_TASK_TRIGGER_BY_ID[CSV_201_MVP_TASK_ID];
    if (
        liveTrigger69?.type === "skilling_action" &&
        liveTrigger69.targetIds?.includes(361) &&
        !liveTrigger69.targetIds?.includes(362)
    ) {
        logOk(`live mvpTaskId ${CSV_201_MVP_TASK_ID} trigger targetId 361`);
    } else {
        logFail(`live task 69 trigger=${JSON.stringify(liveTrigger69)}`);
    }

    const index = LeagueTaskIndex.build(undefined, undefined);

    const matches361 = index
        .getTasksForSkillingAction("cooking", "cook", 361)
        .some((t) => t.taskId === CSV_201_MVP_TASK_ID);
    if (matches361) {
        logOk("index cooking/cook/361 matches mvpTaskId 69 (CSV 201)");
    } else {
        logFail("index cooking/cook/361 does not match mvpTaskId 69");
    }

    const matches362 = index
        .getTasksForSkillingAction("cooking", "cook", 362)
        .some((t) => t.taskId === CSV_201_MVP_TASK_ID);
    if (!matches362) {
        logOk("index cooking/cook/362 does NOT match mvpTaskId 69 (stale id rejected)");
    } else {
        logFail("index cooking/cook/362 still matches mvpTaskId 69");
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
    manager.onSkillingAction(1, "cooking", "cook", 361, 1);
    if (LeagueTaskService.isTaskComplete(player, CSV_201_MVP_TASK_ID)) {
        logOk("onSkillingAction cooking/cook/361 completes mvpTaskId 69 (CSV 201)");
    } else {
        logFail("onSkillingAction cooking/cook/361 did not complete mvpTaskId 69");
    }

    // --- representative skill matrices ---
    const matrixSamples: Array<{
        label: string;
        skill: string;
        action: string;
        targetId: number;
        sourceTaskId: number;
    }> = [
        {
            label: "firemaking",
            skill: "firemaking",
            action: "burn",
            targetId: 1511,
            sourceTaskId: 658,
        },
        {
            label: "fishing",
            skill: "fishing",
            action: "catch",
            targetId: 317,
            sourceTaskId: 656,
        },
        {
            label: "mining",
            skill: "mining",
            action: "mine",
            targetId: 440,
            sourceTaskId: 688,
        },
        {
            label: "cooking lobster",
            skill: "cooking",
            action: "cook",
            targetId: 379,
            sourceTaskId: 685,
        },
        {
            label: "woodcutting",
            skill: "woodcutting",
            action: "chop",
            targetId: 6332,
            sourceTaskId: 96,
        },
    ];

    for (const sample of matrixSamples) {
        const defOk =
            sample.action === "burn"
                ? !!getFiremakingLogDefinition(sample.targetId)
                : true;
        if (!defOk) {
            logFail(`${sample.label} targetId ${sample.targetId} missing skill definition`);
            continue;
        }

        const mvpTaskId = sourceIdToMvpTaskId(sample.sourceTaskId);
        if (mvpTaskId === undefined) {
            logFail(`${sample.label} CSV ${sample.sourceTaskId} missing mvpTaskId in manifest`);
            continue;
        }

        const indexed = index
            .getTasksForSkillingAction(sample.skill, sample.action, sample.targetId)
            .some((t) => t.taskId === mvpTaskId);
        if (indexed) {
            logOk(
                `${sample.label} ${sample.skill}/${sample.action}/${sample.targetId} → mvpTaskId ${mvpTaskId} (CSV ${sample.sourceTaskId})`,
            );
        } else {
            logFail(
                `${sample.label} index miss for CSV ${sample.sourceTaskId} mvpTaskId ${mvpTaskId}`,
            );
        }
    }

    // --- all batch 1 source ids have triggers ---
    const csvPath = path.resolve(__dirname, "../../../tasks.csv");
    const csvById = new Map(parseCsvFile(csvPath).map((r) => [r.id, r.name] as const));
    for (const sourceId of PHASE2C_BATCH1_SOURCE_IDS) {
        const trigger = getPhase2cSkillingTrigger(sourceId);
        if (trigger?.type === "skilling_action") {
            logOk(`phase2c trigger loaded for CSV ${sourceId} (${csvById.get(sourceId) ?? "?"})`);
        } else {
            logFail(`phase2c trigger missing for CSV ${sourceId}`);
        }
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase2c-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase2c-matrices] All matrix checks passed");
}

main();
