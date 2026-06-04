/**
 * Report live tasks that are likely not naturally completable.
 *
 * Usage: npx tsx server/scripts/leagues/report-live-task-unreachable.ts
 */
import fs from "fs";
import path from "path";

import {
    buildLiveTaskGameplayAudit,
    writeLiveTaskGameplayAudit,
    type LiveTaskAuditEntry,
} from "./lib/liveTaskGameplayAudit";

const FLAGGED = new Set([
    "likely_unreachable",
    "missing_emit",
    "missing_content",
    "admin_sim_only",
]);

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const report = buildLiveTaskGameplayAudit(repoRoot);
    writeLiveTaskGameplayAudit(repoRoot, report);

    const flagged = report.entries.filter((e) => FLAGGED.has(e.classification));
    const manual = report.entries.filter((e) => e.classification === "needs_manual_test");

    console.log(`[report-live-task-unreachable] Live: ${report.liveTaskCount}`);
    console.log(`[report-live-task-unreachable] Flagged unreachable/missing: ${flagged.length}`);
    console.log(`[report-live-task-unreachable] Needs manual test: ${manual.length}\n`);

    const print = (label: string, rows: LiveTaskAuditEntry[]) => {
        if (rows.length === 0) return;
        console.log(`=== ${label} (${rows.length}) ===`);
        for (const e of rows) {
            console.log(
                `  taskId ${e.taskId} | CSV ${e.sourceCsvId ?? "?"} | ${e.classification} | ${e.name}`,
            );
            if (e.issue) console.log(`    issue: ${e.issue}`);
            if (e.recommendedFix) console.log(`    fix: ${e.recommendedFix}`);
        }
        console.log();
    };

    print("LIKELY UNREACHABLE / MISSING", flagged);
    print("NEEDS MANUAL TEST (sample: first 25)", manual.slice(0, 25));

    const outPath = path.join(
        repoRoot,
        "server/data/leagues/reports/live-task-unreachable-summary.json",
    );
    fs.writeFileSync(
        outPath,
        JSON.stringify(
            {
                generatedAt: report.generatedAt,
                flagged,
                needsManualTestCount: manual.length,
                summary: report.summary,
            },
            null,
            2,
        ) + "\n",
        "utf8",
    );
    console.log(`Wrote ${outPath}`);
}

main();
