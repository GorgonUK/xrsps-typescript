/**
 * Phase 2C-A Batch 1: append 19 verified skilling_action tasks to live league task list.
 */
import fs from "fs";
import path from "path";

import { ENUM_IDS } from "../../../src/shared/leagues/custom/CustomContentTypes";
import type { LeagueTaskRow } from "../../../src/shared/leagues/leagueTypes";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";

import { parseCsvFile } from "./lib/csv";
import { resetPhase2cSkillingTriggerCache } from "./lib/phase2cSkillingTriggers";

const DIFFICULTY_TO_TIER: Record<string, number> = {
    Easy: 1,
    Medium: 2,
    Hard: 3,
    Elite: 4,
    Master: 5,
};

const STRUCT_ID_BASE = 90_000;

type Phase2cManifest = {
    description: string;
    tasks: Array<{
        sourceTaskId: number;
        mvpTaskId?: number;
        trigger: TaskTrigger;
    }>;
};

function formatLeagueTasksTs(rows: LeagueTaskRow[]): string {
    const lines = rows.map((row) => `  ${JSON.stringify(row)}`);
    return (
        `import type { LeagueTaskRow } from "./leagueTypes";\n\n` +
        `// Live league tasks (${rows.length}: MVP + Phase 2/2B + Phase 3 + Phase 3C + Phase 4A1–4A3 + Phase 4B-Core + Phase 6B + Phase 2C-A). Source: tasks.csv + validation.\n` +
        `// Full OSRS cache export backed up under server/data/leagues/archive/\n` +
        `export const LEAGUE_TASKS: LeagueTaskRow[] = [\n${lines.join(",\n")}\n];\n`
    );
}

function formatTriggersTs(triggers: Record<number, TaskTrigger>): string {
    return (
        `import type { TaskTrigger } from "../../../server/src/game/leagues/triggers/TriggerTypes";\n\n` +
        `/** Live task triggers keyed by taskId (0..n-1). Generated — do not edit. */\n` +
        `export const LEAGUE_TASK_TRIGGER_BY_ID: Record<number, TaskTrigger> = ${JSON.stringify(triggers, null, 2)};\n`
    );
}

function formatEnumOverrideTs(structIds: number[]): string {
    return (
        `import { ENUM_IDS } from "./custom/CustomContentTypes";\n\n` +
        `/** Full enum ${ENUM_IDS.L5_TASKS} replacement for live task list. Generated — do not edit. */\n` +
        `const MVP_TASK_ENUM_STRUCT_IDS: number[] = ${JSON.stringify(structIds)};\n\n` +
        `export function getMvpLeagueTaskEnumCountOverride(enumId: number): number | undefined {\n` +
        `    if ((enumId | 0) !== ENUM_IDS.L5_TASKS) return undefined;\n` +
        `    return MVP_TASK_ENUM_STRUCT_IDS.length;\n` +
        `}\n\n` +
        `export function getMvpLeagueTaskEnumValueOverride(enumId: number, key: number): number | undefined {\n` +
        `    if ((enumId | 0) !== ENUM_IDS.L5_TASKS) return undefined;\n` +
        `    const idx = key | 0;\n` +
        `    if (idx < 0 || idx >= MVP_TASK_ENUM_STRUCT_IDS.length) return -1;\n` +
        `    return MVP_TASK_ENUM_STRUCT_IDS[idx] | 0;\n` +
        `}\n`
    );
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const csvById = new Map(parseCsvFile(path.join(repoRoot, "tasks.csv")).map((r) => [r.id, r]));
    const phase2cPath = path.join(repoRoot, "server/data/leagues/phase2c-skilling-tasks.json");
    const manifest = JSON.parse(fs.readFileSync(phase2cPath, "utf8")) as Phase2cManifest;

    const existingTriggers = { ...LEAGUE_TASK_TRIGGER_BY_ID };
    const rows: LeagueTaskRow[] = [...LEAGUE_TASKS];
    let nextId = rows.length;

    const importedSourceIds: number[] = [];

    for (const entry of manifest.tasks) {
        const csv = csvById.get(entry.sourceTaskId);
        if (!csv) {
            console.error(`[phase2c] Missing CSV row ${entry.sourceTaskId}`);
            process.exit(1);
        }
        const mvpTaskId = nextId++;
        const structId = STRUCT_ID_BASE + mvpTaskId;
        const tier = DIFFICULTY_TO_TIER[csv.difficulty] ?? 1;
        const trigger = entry.trigger;

        rows.push({
            taskId: mvpTaskId,
            name: csv.name,
            description: csv.requirements || undefined,
            tier,
            points: csv.points,
            category: 0,
            area: 0,
            skill: 0,
            structId,
        });
        existingTriggers[mvpTaskId] = trigger;
        entry.mvpTaskId = mvpTaskId;
        importedSourceIds.push(entry.sourceTaskId);
    }

    const structIds = rows.map((r) => r.structId ?? STRUCT_ID_BASE + r.taskId);
    const sharedDir = path.join(repoRoot, "src/shared/leagues");

    fs.writeFileSync(path.join(sharedDir, "leagueTasks.data.ts"), formatLeagueTasksTs(rows), "utf8");
    fs.writeFileSync(
        path.join(sharedDir, "leagueTaskTriggers.data.ts"),
        formatTriggersTs(existingTriggers),
        "utf8",
    );
    fs.writeFileSync(
        path.join(sharedDir, "leagueTasksEnumOverride.ts"),
        formatEnumOverrideTs(structIds),
        "utf8",
    );
    fs.writeFileSync(phase2cPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    resetPhase2cSkillingTriggerCache();

    console.log(
        `[phase2c] Imported ${manifest.tasks.length} tasks (taskId ${LEAGUE_TASKS.length}..${rows.length - 1}, total ${rows.length})`,
    );
    console.log(`[phase2c] CSV source ids: ${importedSourceIds.join(", ")}`);
}

main();
