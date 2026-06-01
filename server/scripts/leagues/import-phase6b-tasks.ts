/**
 * Phase 6B: append collection_log tasks to live league task list.
 */
import fs from "fs";
import path from "path";

import type { LeagueTaskRow } from "../../../src/shared/leagues/leagueTypes";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";

import { parseCsvFile } from "./lib/csv";

const DIFFICULTY_TO_TIER: Record<string, number> = {
    Easy: 1,
    Medium: 2,
    Hard: 3,
    Elite: 4,
    Master: 5,
};

const STRUCT_ID_BASE = 90_000;

type Phase6bFile = {
    tasks: Array<{
        sourceTaskId: number;
        trigger: TaskTrigger;
    }>;
};

function formatLeagueTasksTs(rows: LeagueTaskRow[]): string {
    const lines = rows.map((row) => `  ${JSON.stringify(row)}`);
    return (
        `import type { LeagueTaskRow } from "./leagueTypes";\n\n` +
        `// Live league tasks (${rows.length}: MVP + Phase 2/2B + Phase 3 + Phase 3C + Phase 4A1–4A3 + Phase 4B-Core + Phase 6B). Source: tasks.csv + validation.\n` +
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
        `/** Full enum 5728 replacement for live task list. Generated — do not edit. */\n` +
        `const MVP_TASK_ENUM_STRUCT_IDS: number[] = ${JSON.stringify(structIds)};\n\n` +
        `export function getMvpLeagueTaskEnumCountOverride(enumId: number): number | undefined {\n` +
        `    if ((enumId | 0) !== ENUM_IDS.L5_TASKS) return undefined;\n` +
        `    return MVP_TASK_ENUM_STRUCT_IDS.length;\n` +
        `}\n\n` +
        `export function getMvpLeagueTaskEnumValueOverride(enumId: number, key: number): number | undefined {\n` +
        `    if ((enumId | 0) !== ENUM_IDS.L5_TASKS) return undefined;\n` +
        `    const idx = key | 0;\n` +
        `    if (idx < 0 || idx >= MVP_TASK_ENUM_STRUCT_IDS.length) return undefined;\n` +
        `    return MVP_TASK_ENUM_STRUCT_IDS[idx] | 0;\n` +
        `}\n`
    );
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const csvPath = path.join(repoRoot, "tasks.csv");
    const phasePath = path.join(repoRoot, "server/data/leagues/phase6b-collection-tasks.json");
    const phase6b = JSON.parse(fs.readFileSync(phasePath, "utf8")) as Phase6bFile;

    if (phase6b.tasks.length !== 10) {
        throw new Error(`Expected exactly 10 Phase 6B tasks, got ${phase6b.tasks.length}`);
    }

    const csvById = new Map(parseCsvFile(csvPath).map((row) => [row.id, row] as const));

    const tasks: LeagueTaskRow[] = [...LEAGUE_TASKS];
    const triggers: Record<number, TaskTrigger> = { ...LEAGUE_TASK_TRIGGER_BY_ID };
    let nextTaskId = tasks.length;
    let nextStructId = STRUCT_ID_BASE + nextTaskId;

    for (const entry of phase6b.tasks) {
        const sourceTaskId = entry.sourceTaskId | 0;
        const csvRow = csvById.get(sourceTaskId);
        if (!csvRow) {
            throw new Error(`Missing CSV row for sourceTaskId ${sourceTaskId}`);
        }
        if (entry.trigger.type !== "collection_log") {
            throw new Error(`Expected collection_log for sourceTaskId ${sourceTaskId}`);
        }

        const row: LeagueTaskRow = {
            taskId: nextTaskId,
            name: csvRow.name,
            description: csvRow.requirements || undefined,
            tier: DIFFICULTY_TO_TIER[csvRow.difficulty] ?? 1,
            points: csvRow.points,
            category: 0,
            area: 0,
            skill: 0,
            structId: nextStructId,
        };
        tasks.push(row);
        triggers[nextTaskId] = entry.trigger;
        nextTaskId++;
        nextStructId++;
    }

    const structIds = tasks.map((t) => t.structId ?? STRUCT_ID_BASE + t.taskId);

    fs.writeFileSync(
        path.join(repoRoot, "src/shared/leagues/leagueTasks.data.ts"),
        formatLeagueTasksTs(tasks),
    );
    fs.writeFileSync(
        path.join(repoRoot, "src/shared/leagues/leagueTaskTriggers.data.ts"),
        formatTriggersTs(triggers),
    );
    fs.writeFileSync(
        path.join(repoRoot, "src/shared/leagues/leagueTasksEnumOverride.ts"),
        formatEnumOverrideTs(structIds),
    );

    console.log(
        `Phase 6B import complete: ${tasks.length} live tasks (+${phase6b.tasks.length} collection_log).`,
    );
}

main();
