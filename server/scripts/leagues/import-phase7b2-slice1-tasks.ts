/**
 * Phase 7B-2 Slice 1: append regional NPC kill disambiguation tasks (npc_kill).
 *
 * Usage: npx tsx server/scripts/leagues/import-phase7b2-slice1-tasks.ts
 */
import fs from "fs";
import path from "path";

import { ENUM_IDS } from "../../../src/shared/leagues/custom/CustomContentTypes";
import type { LeagueTaskRow } from "../../../src/shared/leagues/leagueTypes";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";

import { parseCsvFile } from "./lib/csv";
import { PHASE7B2_SLICE1_SOURCE_IDS } from "./lib/phase7b2Slice1Approved";
import { resetPhase7bNpcTriggerCache } from "./lib/phase7bNpcTriggers";

const DIFFICULTY_TO_TIER: Record<string, number> = {
    Easy: 1,
    Medium: 2,
    Hard: 3,
    Elite: 4,
    Master: 5,
};

const STRUCT_ID_BASE = 90_000;

type Phase7bFile = {
    description: string;
    tasks: Array<{
        sourceTaskId: number;
        slice?: string;
        chosenNpcId?: number;
        mvpTaskId?: number;
        trigger: TaskTrigger;
    }>;
};

function formatLeagueTasksTs(rows: LeagueTaskRow[]): string {
    const lines = rows.map((row) => `  ${JSON.stringify(row)}`);
    return (
        `import type { LeagueTaskRow } from "./leagueTypes";\n\n` +
        `// Live league tasks (${rows.length}: MVP + phases through 7B-2 Slice 1). Source: tasks.csv + validation.\n` +
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
    const manifestPath = path.join(repoRoot, "server/data/leagues/phase7b-npc-disambiguation.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Phase7bFile;

    const slice2 = manifest.tasks.filter(
        (t) =>
            t.slice === "2" &&
            PHASE7B2_SLICE1_SOURCE_IDS.includes(t.sourceTaskId as (typeof PHASE7B2_SLICE1_SOURCE_IDS)[number]),
    );
    if (slice2.length !== PHASE7B2_SLICE1_SOURCE_IDS.length) {
        console.error(
            `[phase7b2-slice1] Run verify-phase7b2-slice1-candidates.ts first (have ${slice2.length}, need ${PHASE7B2_SLICE1_SOURCE_IDS.length})`,
        );
        process.exit(1);
    }

    const liveSourceIds = collectLiveSourceIds(csvByName);
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));

    for (const sourceId of PHASE7B2_SLICE1_SOURCE_IDS) {
        if (liveSourceIds.has(sourceId)) {
            console.error(`[phase7b2-slice1] sourceTaskId ${sourceId} already live`);
            process.exit(1);
        }
        const csv = csvById.get(sourceId);
        if (!csv) {
            console.error(`[phase7b2-slice1] Missing CSV row ${sourceId}`);
            process.exit(1);
        }
        if (liveNames.has(csv.name.trim())) {
            console.error(`[phase7b2-slice1] live name collision: "${csv.name.trim()}" (CSV ${sourceId})`);
            process.exit(1);
        }
        const entry = manifest.tasks.find((t) => t.sourceTaskId === sourceId);
        const trig = entry?.trigger;
        if (!trig || trig.type !== "npc_kill" || trig.npcIds.length !== 1) {
            console.error(`[phase7b2-slice1] Invalid single npc_kill trigger for ${sourceId}`);
            process.exit(1);
        }
    }

    const existingTriggers = { ...LEAGUE_TASK_TRIGGER_BY_ID };
    const rows: LeagueTaskRow[] = [...LEAGUE_TASKS];
    const assignedMvpIds = new Set(rows.map((r) => r.taskId));
    let nextId = rows.length;
    const importedSourceIds: number[] = [];

    for (const sourceId of PHASE7B2_SLICE1_SOURCE_IDS) {
        const entry = manifest.tasks.find((t) => t.sourceTaskId === sourceId)!;
        if (entry.mvpTaskId !== undefined) {
            continue;
        }
        const csv = csvById.get(sourceId)!;
        const mvpTaskId = nextId++;
        if (assignedMvpIds.has(mvpTaskId)) {
            console.error(`[phase7b2-slice1] mvpTaskId collision: ${mvpTaskId}`);
            process.exit(1);
        }
        assignedMvpIds.add(mvpTaskId);

        rows.push({
            taskId: mvpTaskId,
            name: csv.name,
            description: csv.requirements || undefined,
            tier: DIFFICULTY_TO_TIER[csv.difficulty] ?? 1,
            points: csv.points,
            category: 0,
            area: 0,
            skill: 0,
            structId: STRUCT_ID_BASE + mvpTaskId,
        });
        existingTriggers[mvpTaskId] = entry.trigger;
        entry.mvpTaskId = mvpTaskId;
        importedSourceIds.push(sourceId);
    }

    if (importedSourceIds.length === 0) {
        console.log("[phase7b2-slice1] Nothing to import (all slice 2 tasks already have mvpTaskId)");
        process.exit(0);
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
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    resetPhase7bNpcTriggerCache();

    console.log(
        `[phase7b2-slice1] Imported ${importedSourceIds.length} tasks (taskId ${LEAGUE_TASKS.length}..${rows.length - 1}, total ${rows.length})`,
    );
    console.log(`[phase7b2-slice1] CSV source ids: ${importedSourceIds.join(", ")}`);
}

main();
