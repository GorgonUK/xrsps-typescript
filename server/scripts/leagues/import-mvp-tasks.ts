/**
 * MVP league task import: only "ready" tasks from the validation report.
 * Generates leagueTasks.data.ts, triggers, enum override, skipped-tasks.json, hook-roadmap.json
 */
import fs from "fs";
import path from "path";

import { ENUM_IDS } from "../../../src/shared/leagues/custom/CustomContentTypes";
import type { LeagueTaskRow } from "../../../src/shared/leagues/leagueTypes";
import { parseTaskTrigger } from "../../src/game/leagues/triggers/TriggerParser";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";

import { parseCsvFile } from "./lib/csv";
import { categorizeTask } from "./lib/categorize";
import {
    type HookRoadmapEntry,
    type HookRoadmapType,
    GENERIC_HOOK_IMPLEMENTATION_HINTS,
    buildHookRoadmap,
    type SkippedTaskEntry,
} from "./lib/hookRoadmap";
import { normalizeTaskNameForParser } from "./lib/normalize";
import { parseValidationReport } from "./lib/parseValidation";
import { buildRegistries } from "./lib/registries";
import type { TaskStatus, ValidationRow } from "./lib/types";
import { validateTask } from "./lib/validate";

const DIFFICULTY_TO_TIER: Record<string, number> = {
    Easy: 1,
    Medium: 2,
    Hard: 3,
    Elite: 4,
    Master: 5,
};

const STRUCT_ID_BASE = 90_000;

function parseArgs(argv: string[]): {
    input: string;
    validation: string;
    dryRun: boolean;
} {
    let input = "tasks.csv";
    let validation = "server/data/leagues/reports/validate-tasks-latest.csv";
    let dryRun = false;
    for (const arg of argv) {
        if (arg.startsWith("--input=")) input = arg.slice("--input=".length);
        else if (arg.startsWith("--validation=")) validation = arg.slice("--validation=".length);
        else if (arg === "--dry-run") dryRun = true;
    }
    return { input, validation, dryRun };
}

function buildTrigger(
    name: string,
    requirements: string,
    loaders: ReturnType<typeof buildRegistries>["loaders"],
    matchedContent: string,
): TaskTrigger | undefined {
    const normalized = normalizeTaskNameForParser(name);
    const parsed = parseTaskTrigger(normalized, requirements, loaders);
    if (parsed) return parsed;

    // Fallback: parse npc ids from validation matched_content for kill tasks
    const npcMatch = matchedContent.match(/npc:(\d+)/);
    if (npcMatch && /^(defeat|kill|slay)\b/i.test(name)) {
        return { type: "npc_kill", npcIds: [parseInt(npcMatch[1], 10)] };
    }
    const itemMatch = matchedContent.match(/item(?:_equip|_obtain|_craft)?:(\d+)/);
    if (itemMatch) {
        const id = parseInt(itemMatch[1], 10);
        if (/^(equip|wear)\b/i.test(name)) return { type: "item_equip", itemIds: [id] };
        if (/^(craft|smith|cook|fletch|make)\b/i.test(name)) {
            return { type: "item_craft", itemIds: [id] };
        }
        return { type: "item_obtain", itemIds: [id] };
    }
    return undefined;
}

function formatLeagueTasksTs(rows: LeagueTaskRow[]): string {
    const lines = rows.map((row) => `  ${JSON.stringify(row)}`);
    return (
        `import type { LeagueTaskRow } from "./leagueTypes";\n\n` +
        `// MVP custom league tasks (${rows.length} ready tasks). Source: tasks.csv + validation.\n` +
        `// Full OSRS cache export backed up under server/data/leagues/archive/\n` +
        `export const LEAGUE_TASKS: LeagueTaskRow[] = [\n${lines.join(",\n")}\n];\n`
    );
}

function formatTriggersTs(triggers: Record<number, TaskTrigger>): string {
    return (
        `import type { TaskTrigger } from "../../../server/src/game/leagues/triggers/TriggerTypes";\n\n` +
        `/** MVP task triggers keyed by mvp taskId (0..n-1). Generated — do not edit. */\n` +
        `export const LEAGUE_TASK_TRIGGER_BY_ID: Record<number, TaskTrigger> = ${JSON.stringify(triggers, null, 2)};\n`
    );
}

function formatEnumOverrideTs(structIds: number[]): string {
    return (
        `import { ENUM_IDS } from "./custom/CustomContentTypes";\n\n` +
        `/** Full enum ${ENUM_IDS.L5_TASKS} replacement for MVP task list. Generated — do not edit. */\n` +
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

function formatManifest(manifest: unknown): string {
    return JSON.stringify(manifest, null, 2) + "\n";
}

function toSkippedEntry(csv: CsvTaskRow, v: ValidationRow): SkippedTaskEntry {
    return {
        task_id: csv.id,
        task_name: csv.name,
        area: csv.area,
        difficulty: csv.difficulty,
        points: csv.points,
        batch: categorizeTask(csv),
        matched_content: v.matched_content,
        matched_hook: v.matched_hook,
        missing_requirement: v.missing_requirement,
        suggested_fix: v.suggested_fix,
    };
}

type CsvTaskRow = import("./lib/types").CsvTaskRow;

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const { input, validation, dryRun } = parseArgs(process.argv.slice(2));
    const inputPath = path.isAbsolute(input) ? input : path.join(repoRoot, input);
    const validationPath = path.isAbsolute(validation) ? validation : path.join(repoRoot, validation);

    const csvTasks = parseCsvFile(inputPath);
    const validationRows = parseValidationReport(validationPath);
    const validationById = new Map(validationRows.map((v) => [v.task_id, v]));
    const csvById = new Map(csvTasks.map((t) => [t.id, t]));

    const reg = buildRegistries(repoRoot);

    // Re-validate ready set (safety gate)
    const readySource: Array<{ csv: CsvTaskRow; validation: ValidationRow }> = [];
    for (const v of validationRows) {
        if (v.status !== "ready") continue;
        const csv = csvById.get(v.task_id);
        if (!csv) {
            console.error(`[import-mvp] Missing csv row for ready task ${v.task_id}`);
            continue;
        }
        const recheck = validateTask(reg, csv);
        if (recheck.status !== "ready") {
            console.warn(
                `[import-mvp] SKIP task ${v.task_id} marked ready in report but recheck=${recheck.status}`,
            );
            continue;
        }
        readySource.push({ csv, validation: { ...recheck, batch: categorizeTask(csv) } });
    }

    readySource.sort((a, b) => a.csv.id - b.csv.id);

    const mvpTasks: LeagueTaskRow[] = [];
    const triggers: Record<number, TaskTrigger> = {};
    const structIds: number[] = [];
    const manifestTasks: Array<{
        mvpTaskId: number;
        sourceTaskId: number;
        name: string;
        area: string;
        difficulty: string;
        points: number;
        tier: number;
        structId: number;
        trigger: TaskTrigger;
    }> = [];

    for (let mvpId = 0; mvpId < readySource.length; mvpId++) {
        const { csv, validation } = readySource[mvpId];
        const structId = STRUCT_ID_BASE + mvpId;
        const trigger = buildTrigger(csv.name, csv.requirements, reg.loaders, validation.matched_content);
        if (!trigger) {
            console.error(`[import-mvp] No trigger for ready task ${csv.id} "${csv.name}" — skipping`);
            continue;
        }

        const tier = DIFFICULTY_TO_TIER[csv.difficulty] ?? 1;
        mvpTasks.push({
            taskId: mvpId,
            name: csv.name,
            description: csv.requirements || undefined,
            tier,
            points: csv.points,
            category: 0,
            area: 0,
            skill: 0,
            structId,
        });
        triggers[mvpId] = trigger;
        structIds.push(structId);
        manifestTasks.push({
            mvpTaskId: mvpId,
            sourceTaskId: csv.id,
            name: csv.name,
            area: csv.area,
            difficulty: csv.difficulty,
            points: csv.points,
            tier,
            structId,
            trigger,
        });
    }

    // Skipped tasks grouped by status
    const skipped: Record<TaskStatus, SkippedTaskEntry[]> = {
        ready: [],
        missing_content: [],
        need_hook: [],
        ambiguous: [],
        duplicate: [],
    };
    const needHookForRoadmap: Array<{ csv: CsvTaskRow; validation: ValidationRow }> = [];

    for (const v of validationRows) {
        if (v.status === "ready") continue;
        const csv = csvById.get(v.task_id);
        if (!csv) continue;
        const enriched: ValidationRow = { ...v, batch: categorizeTask(csv) };
        skipped[v.status].push(toSkippedEntry(csv, enriched));
        if (v.status === "need_hook") {
            needHookForRoadmap.push({ csv, validation: enriched });
        }
    }

    for (const key of Object.keys(skipped) as TaskStatus[]) {
        skipped[key].sort((a, b) => a.task_id - b.task_id);
    }

    const { byHookType, counts } = buildHookRoadmap(needHookForRoadmap);

    const hookTypeOrder = Object.entries(counts).sort((a, b) => b[1] - a[1]) as Array<
        [HookRoadmapType, number]
    >;
    const topGenericHooks = hookTypeOrder.slice(0, 5).map(([hook, unlocks]) => ({
        hook,
        unlocks,
        implementation: GENERIC_HOOK_IMPLEMENTATION_HINTS[hook],
    }));

    const hookRoadmap = {
        generatedAt: new Date().toISOString(),
        totalNeedHook: needHookForRoadmap.length,
        countsByHookType: counts,
        topGenericHooks,
        byHookType,
    };

    const skippedTasks = {
        generatedAt: new Date().toISOString(),
        totalSkipped:
            skipped.missing_content.length +
            skipped.need_hook.length +
            skipped.ambiguous.length +
            skipped.duplicate.length,
        missing_content: skipped.missing_content,
        need_hook: skipped.need_hook,
        ambiguous: skipped.ambiguous,
        duplicate: skipped.duplicate,
    };

    const mvpManifest = {
        generatedAt: new Date().toISOString(),
        mvpTaskCount: mvpTasks.length,
        enumId: ENUM_IDS.L5_TASKS,
        structIdRange: { start: STRUCT_ID_BASE, end: STRUCT_ID_BASE + mvpTasks.length - 1 },
        tasks: manifestTasks,
    };

    const dataDir = path.join(repoRoot, "server/data/leagues");
    const sharedDir = path.join(repoRoot, "src/shared/leagues");
    const archiveDir = path.join(dataDir, "archive");
    const fullDataPath = path.join(sharedDir, "leagueTasks.data.ts");

    console.log(`[import-mvp] Ready tasks to import: ${mvpTasks.length}`);
    console.log(`[import-mvp] Skipped: ${skippedTasks.totalSkipped}`);
    console.log(`[import-mvp] Hook roadmap entries: ${needHookForRoadmap.length}`);

    if (dryRun) {
        console.log("[import-mvp] Dry run — no files written");
        console.log("[import-mvp] Top hooks:", topGenericHooks);
        return;
    }

    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(archiveDir, { recursive: true });

    if (fs.existsSync(fullDataPath) && !fs.existsSync(path.join(archiveDir, "leagueTasks.data.full.ts"))) {
        fs.copyFileSync(fullDataPath, path.join(archiveDir, "leagueTasks.data.full.ts"));
        console.log(`[import-mvp] Backed up full task list to ${archiveDir}/leagueTasks.data.full.ts`);
    }

    fs.writeFileSync(path.join(dataDir, "skipped-tasks.json"), formatManifest(skippedTasks), "utf8");
    fs.writeFileSync(path.join(dataDir, "hook-roadmap.json"), formatManifest(hookRoadmap), "utf8");
    fs.writeFileSync(path.join(dataDir, "mvp-manifest.json"), formatManifest(mvpManifest), "utf8");

    fs.writeFileSync(fullDataPath, formatLeagueTasksTs(mvpTasks), "utf8");
    fs.writeFileSync(path.join(sharedDir, "leagueTaskTriggers.data.ts"), formatTriggersTs(triggers), "utf8");
    fs.writeFileSync(
        path.join(sharedDir, "leagueTasksEnumOverride.ts"),
        formatEnumOverrideTs(structIds),
        "utf8",
    );

    console.log(`[import-mvp] Wrote ${mvpTasks.length} tasks to src/shared/leagues/leagueTasks.data.ts`);
    console.log(`[import-mvp] Wrote skipped-tasks.json and hook-roadmap.json`);
}

main();
