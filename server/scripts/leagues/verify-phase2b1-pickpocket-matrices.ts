/**
 * Static thieving/pickpocket matrix checks for Phase 2C-B1 (no server boot).
 */
import fs from "fs";
import path from "path";

import { LeagueTaskIndex } from "../../src/game/leagues/LeagueTaskIndex";
import { LeagueTaskManager } from "../../src/game/leagues/LeagueTaskManager";
import { LeagueTaskService } from "../../src/game/leagues/LeagueTaskService";
import type { LeagueTaskPlayer } from "../../src/game/leagues/LeagueTaskService";

import { getPhase2b1PickpocketTrigger } from "./lib/phase2b1PickpocketTriggers";
import { parseCsvFile } from "./lib/csv";

const BATCH1_SOURCE_IDS = [
    42, 46, 47, 48, 52, 53, 54, 41, 43, 44, 50, 51, 57, 682, 683, 967, 968, 1017, 1352, 1355,
];

type MatrixSample = {
    label: string;
    sourceTaskId: number;
    npcTypeId: number;
    wrongNpcTypeId?: number;
};

const MATRIX_SAMPLES: MatrixSample[] = [
    { label: "Farmer", sourceTaskId: 42, npcTypeId: 3114, wrongNpcTypeId: 3292 },
    { label: "Guard", sourceTaskId: 47, npcTypeId: 397, wrongNpcTypeId: 3114 },
    { label: "Master Farmer", sourceTaskId: 46, npcTypeId: 5730, wrongNpcTypeId: 397 },
    { label: "Hero", sourceTaskId: 54, npcTypeId: 3295, wrongNpcTypeId: 5730 },
    { label: "Menaphite Thug", sourceTaskId: 1017, npcTypeId: 3550, wrongNpcTypeId: 3295 },
];

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
    const manifestPath = path.resolve(__dirname, "../../data/leagues/phase2b1-pickpocket-tasks.json");
    if (!fs.existsSync(manifestPath)) {
        return undefined;
    }
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

    console.log("[verify-phase2b1-pickpocket-matrices] Phase 2C-B1 pickpocket matrix checks\n");

    const index = LeagueTaskIndex.build(undefined, undefined);

    for (const sample of MATRIX_SAMPLES) {
        const mvpTaskId = sourceIdToMvpTaskId(sample.sourceTaskId);
        if (mvpTaskId === undefined) {
            logFail(`${sample.label} CSV ${sample.sourceTaskId} missing mvpTaskId in manifest`);
            continue;
        }

        const trigger = getPhase2b1PickpocketTrigger(sample.sourceTaskId);
        if (trigger?.type !== "skilling_action" || !trigger.targetIds?.includes(sample.npcTypeId)) {
            logFail(
                `${sample.label} manifest missing npcTypeId ${sample.npcTypeId} (CSV ${sample.sourceTaskId})`,
            );
            continue;
        }

        const indexed = index
            .getTasksForSkillingAction("thieving", "pickpocket", sample.npcTypeId)
            .some((t) => t.taskId === mvpTaskId);
        if (indexed) {
            logOk(
                `${sample.label} index thieving/pickpocket/${sample.npcTypeId} → mvpTaskId ${mvpTaskId} (CSV ${sample.sourceTaskId})`,
            );
        } else {
            logFail(`${sample.label} index miss for CSV ${sample.sourceTaskId}`);
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

        manager.onSkillingAction(1, "thieving", "pickpocket", sample.npcTypeId, 1);
        if (LeagueTaskService.isTaskComplete(player, mvpTaskId)) {
            logOk(
                `${sample.label} onSkillingAction thieving/pickpocket/${sample.npcTypeId} completes mvpTaskId ${mvpTaskId}`,
            );
        } else {
            logFail(`${sample.label} onSkillingAction did not complete mvpTaskId ${mvpTaskId}`);
        }

        if (sample.wrongNpcTypeId !== undefined) {
            const wrongPlayer = createMockPlayer();
            const wrongServices = {
                getPlayer: (playerId: number) => (playerId === 1 ? wrongPlayer : undefined),
                queueVarp: (playerId: number, varpId: number, value: number) => {
                    if (playerId === 1) wrongPlayer.setVarpValue(varpId, value);
                },
                queueVarbit: (playerId: number, varbitId: number, value: number) => {
                    if (playerId === 1) wrongPlayer.setVarbitValue(varbitId, value);
                },
                queueNotification: () => {},
            };
            const wrongManager = LeagueTaskManager.create(undefined, undefined, wrongServices);
            wrongManager.onSkillingAction(1, "thieving", "pickpocket", sample.wrongNpcTypeId, 1);
            if (!LeagueTaskService.isTaskComplete(wrongPlayer, mvpTaskId)) {
                logOk(
                    `${sample.label} wrong npcTypeId ${sample.wrongNpcTypeId} does NOT complete mvpTaskId ${mvpTaskId}`,
                );
            } else {
                logFail(
                    `${sample.label} wrong npcTypeId ${sample.wrongNpcTypeId} incorrectly completed mvpTaskId ${mvpTaskId}`,
                );
            }
        }
    }

    const handlerPath = path.resolve(
        __dirname,
        "../../src/game/actions/handlers/SkillActionHandler.ts",
    );
    const handlerSrc = fs.readFileSync(handlerPath, "utf8");
    const methodStart = handlerSrc.indexOf("executeSkillPickpocketAction(");
    const failBranch = handlerSrc.indexOf("You fail to pick the", methodStart);
    const successEmit = handlerSrc.indexOf("emitLeagueSkillingAction", methodStart);
    if (successEmit > methodStart && failBranch > successEmit) {
        logOk("emitLeagueSkillingAction is only in success branch (before fail message)");
    } else {
        logFail("could not verify pickpocket emit is success-only");
    }

    const csvPath = path.resolve(__dirname, "../../../tasks.csv");
    const csvById = new Map(parseCsvFile(csvPath).map((r) => [r.id, r.name] as const));
    for (const sourceId of BATCH1_SOURCE_IDS) {
        const trigger = getPhase2b1PickpocketTrigger(sourceId);
        if (trigger?.type === "skilling_action") {
            logOk(`phase2b1 trigger loaded for CSV ${sourceId} (${csvById.get(sourceId) ?? "?"})`);
        } else {
            logFail(`phase2b1 trigger missing for CSV ${sourceId}`);
        }
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase2b1-pickpocket-matrices] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase2b1-pickpocket-matrices] All matrix checks passed");
}

main();
