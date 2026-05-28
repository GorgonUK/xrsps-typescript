/**
 * Validates custom league tasks from tasks.csv without importing them.
 *
 * Usage:
 *   npx tsx server/scripts/leagues/validate-tasks.ts
 *   npx tsx server/scripts/leagues/validate-tasks.ts --batch=skills
 *   npx tsx server/scripts/leagues/validate-tasks.ts --input=tasks.csv --out=server/data/leagues/reports
 */
import fs from "fs";
import path from "path";

import { parseCsvFile, writeReport } from "./lib/csv";
import type { BatchSummary, TaskBatch, ValidationRow } from "./lib/types";
import { categorizeTask } from "./lib/categorize";
import { buildRegistries } from "./lib/registries";
import { applyDuplicateStatus, findDuplicates, validateTask } from "./lib/validate";

const ALL_BATCHES: TaskBatch[] = [
    "skills",
    "combat",
    "bosses",
    "minigames",
    "collection",
    "quests",
    "misc",
];

function parseArgs(argv: string[]): {
    input: string;
    outDir: string;
    batch: TaskBatch | "all";
} {
    let input = "tasks.csv";
    let outDir = "server/data/leagues/reports";
    let batch: TaskBatch | "all" = "all";
    for (const arg of argv) {
        if (arg.startsWith("--input=")) input = arg.slice("--input=".length);
        else if (arg.startsWith("--out=")) outDir = arg.slice("--out=".length);
        else if (arg.startsWith("--batch=")) {
            const v = arg.slice("--batch=".length) as TaskBatch | "all";
            batch = v;
        }
    }
    return { input, outDir, batch };
}

function toOutputRow(r: ValidationRow): Record<string, string | number> {
    return {
        task_id: r.task_id,
        task_name: r.task_name,
        status: r.status,
        matched_content: r.matched_content,
        matched_hook: r.matched_hook,
        missing_requirement: r.missing_requirement,
        suggested_fix: r.suggested_fix,
    };
}

function summarize(batch: TaskBatch, rows: ValidationRow[]): BatchSummary {
    const filtered = rows.filter((r) => r.batch === batch);
    const summary: BatchSummary = {
        batch,
        total: filtered.length,
        ready: 0,
        missing_content: 0,
        need_hook: 0,
        ambiguous: 0,
        duplicate: 0,
    };
    for (const r of filtered) {
        summary[r.status]++;
    }
    return summary;
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const { input, outDir, batch } = parseArgs(process.argv.slice(2));
    const inputPath = path.isAbsolute(input) ? input : path.join(repoRoot, input);
    const reportDir = path.isAbsolute(outDir) ? outDir : path.join(repoRoot, outDir);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const runDir = path.join(reportDir, stamp);

    if (!fs.existsSync(inputPath)) {
        console.error(`[validate-tasks] Input not found: ${inputPath}`);
        process.exit(1);
    }

    console.log(`[validate-tasks] Loading ${inputPath}`);
    const tasks = parseCsvFile(inputPath);
    console.log(`[validate-tasks] ${tasks.length} tasks loaded`);

    const pointsIssues = tasks.filter((t) => t.difficulty === "Medium" && t.points !== 30);
    if (pointsIssues.length > 0) {
        console.log(
            `[validate-tasks] WARN: ${pointsIssues.length} Medium tasks do not have 30 points`,
        );
    }

    console.log("[validate-tasks] Building registries (cache + server data)...");
    const reg = buildRegistries(repoRoot);
    console.log(
        `[validate-tasks] cache=${reg.cacheAvailable} spawns=${reg.spawnedNpcIds.size} collectionItems=${reg.collectionLogItemIds.size} pickpocketNpcs=${reg.pickpocketNpcIds.size}`,
    );

    let results: ValidationRow[] = tasks.map((t) => validateTask(reg, t));
    const duplicateOf = findDuplicates(tasks);
    results = applyDuplicateStatus(results, duplicateOf);

    if (batch !== "all") {
        results = results.filter((r) => r.batch === batch);
    }

    fs.mkdirSync(runDir, { recursive: true });

    const allOutput = results.map(toOutputRow);
    writeReport(runDir, "validate-tasks.csv", allOutput);

    const summaries: BatchSummary[] = [];
    for (const b of ALL_BATCHES) {
        const batchRows = results.filter((r) => r.batch === b);
        if (batchRows.length === 0) continue;
        writeReport(
            runDir,
            `validate-${b}.csv`,
            batchRows.map(toOutputRow),
        );
        summaries.push(summarize(b, results));
    }

    const totals = {
        total: results.length,
        ready: results.filter((r) => r.status === "ready").length,
        missing_content: results.filter((r) => r.status === "missing_content").length,
        need_hook: results.filter((r) => r.status === "need_hook").length,
        ambiguous: results.filter((r) => r.status === "ambiguous").length,
        duplicate: results.filter((r) => r.status === "duplicate").length,
        medium_points_invalid: pointsIssues.length,
        cache_available: reg.cacheAvailable,
    };

    fs.writeFileSync(
        path.join(runDir, "summary.json"),
        JSON.stringify({ generatedAt: new Date().toISOString(), totals, batches: summaries }, null, 2),
        "utf8",
    );

    // Also write latest symlink-style copy
    fs.mkdirSync(reportDir, { recursive: true });
    writeReport(reportDir, "validate-tasks-latest.csv", allOutput);
    fs.writeFileSync(
        path.join(reportDir, "validate-summary-latest.json"),
        JSON.stringify({ generatedAt: new Date().toISOString(), totals, batches: summaries }, null, 2),
        "utf8",
    );

    console.log(`[validate-tasks] Reports written to ${runDir}`);
    console.log(`[validate-tasks] Latest: ${path.join(reportDir, "validate-tasks-latest.csv")}`);
    console.log("[validate-tasks] Totals:", totals);
    for (const s of summaries) {
        console.log(
            `  ${s.batch}: ${s.total} (ready=${s.ready} missing=${s.missing_content} hook=${s.need_hook} ambiguous=${s.ambiguous} dup=${s.duplicate})`,
        );
    }
}

main();
