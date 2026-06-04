/**
 * Generate live-task gameplay completion audit JSON.
 *
 * Usage: npx tsx server/scripts/leagues/audit-live-task-gameplay-completion.ts
 */
import path from "path";

import {
    buildLiveTaskGameplayAudit,
    writeLiveTaskGameplayAudit,
} from "./lib/liveTaskGameplayAudit";

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const report = buildLiveTaskGameplayAudit(repoRoot);
    const outPath = writeLiveTaskGameplayAudit(repoRoot, report);

    console.log(`[audit-live-task-gameplay] Wrote ${outPath}`);
    console.log(`[audit-live-task-gameplay] Live tasks: ${report.liveTaskCount}`);
    console.log("[audit-live-task-gameplay] Summary:");
    for (const [k, v] of Object.entries(report.summary)) {
        if (v > 0) console.log(`  ${k}: ${v}`);
    }
}

main();
