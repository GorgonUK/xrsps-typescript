/**
 * Check collection-log canonical hits for crystal/ballista ambiguous tasks.
 *
 * Usage: npx tsx server/scripts/leagues/_check-collection-edge-candidates.ts
 */
import { parseValidationReport } from "./lib/parseValidation";
import { buildRegistries } from "./lib/registries";
import path from "path";

const TARGET_IDS = [1575, 1576, 1583, 1584] as const;

function parseItemCandidates(content: string): number[] {
    const m = content.match(/item candidates:\s*(.+)/i);
    if (!m) return [];
    return m[1]
        .split(";")
        .map((seg) => parseInt(seg.trim().match(/^(\d+):/)?.[1] ?? "", 10))
        .filter(Number.isFinite);
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const reg = buildRegistries(repoRoot);
    const validationRows = parseValidationReport(
        path.join(repoRoot, "server/data/leagues/reports/validate-tasks-latest.csv"),
    );
    const byId = new Map(validationRows.map((r) => [r.task_id, r]));

    console.log("[collection-edge] Checking canonical collection-log hits\n");

    for (const sourceId of TARGET_IDS) {
        const row = byId.get(sourceId);
        if (!row) {
            console.log(`CSV ${sourceId}: missing validation row`);
            continue;
        }
        const candidates = parseItemCandidates(row.matched_content);
        const logHits = candidates.filter((id) => reg.collectionLogItemIds.has(id));
        const allowlistHits = candidates.filter((id) => reg.leagueObtainAllowlistItemIds.has(id));
        console.log(`CSV ${sourceId} | ${row.task_name.trim()}`);
        console.log(`  candidates: ${candidates.join(", ")}`);
        console.log(`  names: ${candidates.map((id) => `${id}:${reg.getItemName(id)}`).join("; ")}`);
        console.log(`  collectionLog hits (${logHits.length}): ${logHits.join(", ") || "none"}`);
        console.log(`  allowlist hits (${allowlistHits.length}): ${allowlistHits.join(", ") || "none"}`);
        console.log(`  importable: ${logHits.length === 1 ? `YES → ${logHits[0]}` : "NO"}`);
        console.log();
    }
}

main();
