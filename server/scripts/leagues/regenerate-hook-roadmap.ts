/**
 * Regenerate hook-roadmap.json and skipped-tasks.json from latest validation report.
 * Does not touch live leagueTasks.data.ts.
 */
import fs from "fs";
import path from "path";

import { parseCsvFile } from "./lib/csv";
import { categorizeTask } from "./lib/categorize";
import {
    buildHookRoadmap,
    GENERIC_HOOK_IMPLEMENTATION_HINTS,
    type HookRoadmapType,
    type SkippedTaskEntry,
} from "./lib/hookRoadmap";
import { parseValidationReport } from "./lib/parseValidation";
import type { CsvTaskRow, TaskStatus, ValidationRow } from "./lib/types";

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

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const csvTasks = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const validationRows = parseValidationReport(
        path.join(repoRoot, "server/data/leagues/reports/validate-tasks-latest.csv"),
    );
    const csvById = new Map(csvTasks.map((t) => [t.id, t]));

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

    const dataDir = path.join(repoRoot, "server/data/leagues");
    fs.writeFileSync(path.join(dataDir, "hook-roadmap.json"), JSON.stringify(hookRoadmap, null, 2) + "\n");
    fs.writeFileSync(path.join(dataDir, "skipped-tasks.json"), JSON.stringify(skippedTasks, null, 2) + "\n");

    const totals = {
        ready: validationRows.filter((r) => r.status === "ready").length,
        need_hook: validationRows.filter((r) => r.status === "need_hook").length,
        missing_content: validationRows.filter((r) => r.status === "missing_content").length,
        ambiguous: validationRows.filter((r) => r.status === "ambiguous").length,
        duplicate: validationRows.filter((r) => r.status === "duplicate").length,
    };

    console.log("[regenerate-hook-roadmap] Totals:", totals);
    console.log("[regenerate-hook-roadmap] countsByHookType:", counts);
}

main();
