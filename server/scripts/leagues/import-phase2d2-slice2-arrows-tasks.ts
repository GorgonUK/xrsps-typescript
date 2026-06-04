/**
 * Phase 2D-2 Slice 2: append 7 fletch arrow skilling_action tasks.
 *
 * Usage: npx tsx server/scripts/leagues/import-phase2d2-slice2-arrows-tasks.ts
 */
import fs from "fs";
import path from "path";

import { ENUM_IDS } from "../../../src/shared/leagues/custom/CustomContentTypes";
import type { LeagueTaskRow } from "../../../src/shared/leagues/leagueTypes";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";

import { parseCsvFile } from "./lib/csv";
import { resetPhase2dSkillingTriggerCache } from "./lib/phase2dSkillingTriggers";

const DIFFICULTY_TO_TIER: Record<string, number> = {
    Easy: 1,
    Medium: 2,
    Hard: 3,
    Elite: 4,
    Master: 5,
};

const STRUCT_ID_BASE = 90_000;

const SLICE2_SOURCE_IDS = [108, 109, 110, 111, 112, 113, 114] as const;

type Phase2dFile = {
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
        `// Live league tasks (${rows.length}). Source: tasks.csv + validation.\n` +
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

function collectLiveSourceIds(csvByName: Map<string, number>): Set<number> {
    const liveSourceIds = new Set<number>();
    for (const task of LEAGUE_TASKS) {
        const csvId = csvByName.get(task.name.trim());
        if (csvId !== undefined) {
            liveSourceIds.add(csvId);
        }
    }
    return liveSourceIds;
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const csvByName = new Map(csvRows.map((r) => [r.name.trim(), r.id] as const));
    const phase2dPath = path.join(repoRoot, "server/data/leagues/phase2d-skilling-tasks.json");
    const manifest = JSON.parse(fs.readFileSync(phase2dPath, "utf8")) as Phase2dFile;

    const liveSourceIds = collectLiveSourceIds(csvByName);
    const manifestBySource = new Map(manifest.tasks.map((t) => [t.sourceTaskId | 0, t] as const));

    for (const sourceId of SLICE2_SOURCE_IDS) {
        if (liveSourceIds.has(sourceId)) {
            console.error(`[phase2d2-slice2-arrows] sourceTaskId ${sourceId} already live`);
            process.exit(1);
        }
        if (!csvById.has(sourceId)) {
            console.error(`[phase2d2-slice2-arrows] Missing CSV row ${sourceId}`);
            process.exit(1);
        }
        if (!manifestBySource.has(sourceId)) {
            console.error(`[phase2d2-slice2-arrows] Missing manifest entry for ${sourceId}`);
            process.exit(1);
        }
    }

    console.log(
        `[phase2d2-slice2-arrows] Pre-import sanity: ${SLICE2_SOURCE_IDS.length} unique CSV ids, 0 live duplicates`,
    );

    const existingTriggers = { ...LEAGUE_TASK_TRIGGER_BY_ID };
    const rows: LeagueTaskRow[] = [...LEAGUE_TASKS];
    let nextId = rows.length;
    const importedSourceIds: number[] = [];

    for (const sourceTaskId of SLICE2_SOURCE_IDS) {
        const entry = manifestBySource.get(sourceTaskId)!;
        const csv = csvById.get(sourceTaskId)!;
        const mvpTaskId = nextId++;
        const structId = STRUCT_ID_BASE + mvpTaskId;
        const tier = DIFFICULTY_TO_TIER[csv.difficulty] ?? 1;

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
        existingTriggers[mvpTaskId] = entry.trigger;
        entry.mvpTaskId = mvpTaskId;
        importedSourceIds.push(sourceTaskId);
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
    fs.writeFileSync(phase2dPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    resetPhase2dSkillingTriggerCache();

    console.log(
        `[phase2d2-slice2-arrows] Imported ${importedSourceIds.length} tasks (taskId ${LEAGUE_TASKS.length}..${rows.length - 1}, total ${rows.length})`,
    );
    console.log(`[phase2d2-slice2-arrows] CSV source ids: ${importedSourceIds.join(", ")}`);
}

main();
