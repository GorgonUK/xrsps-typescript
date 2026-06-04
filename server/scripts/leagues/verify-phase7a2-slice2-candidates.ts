/**
 * Pre-import gate for Phase 7A-2 Slice 2 (allowlist-backed Tier B collection tasks).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7a2-slice2-candidates.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { parseCsvFile } from "./lib/csv";
import {
    getLeagueObtainAllowlistEntry,
    loadLeagueObtainAllowlistFile,
    resetLeagueObtainAllowlistCache,
} from "./lib/leagueObtainAllowlist";
import { parseValidationReport } from "./lib/parseValidation";
import { buildRegistries } from "./lib/registries";

const SLICE2_SOURCE_IDS = [1503, 1504, 1505, 1579, 1580, 1581, 1589, 1590, 1591, 1596] as const;

type Candidate = {
    sourceTaskId: number;
    name: string;
    tier: "B-2";
    chosenItemId: number;
    candidateItemIds: number[];
    alternateCandidateCount: number;
    trigger: TaskTrigger;
    note: string;
};

function parseItemCandidates(content: string): Array<{ id: number; name: string }> {
    const m = content.match(/item candidates:\s*(.+)/i);
    if (!m) return [];
    const out: Array<{ id: number; name: string }> = [];
    for (const seg of m[1].split(";")) {
        const p = seg.trim().match(/^(\d+):(.+)$/);
        if (p) out.push({ id: parseInt(p[1], 10), name: p[2].trim() });
    }
    return out;
}

function main(): void {
    resetLeagueObtainAllowlistCache();
    const repoRoot = path.resolve(__dirname, "../../..");
    const reportPath = path.join(repoRoot, "server/data/leagues/reports/validate-tasks-latest.csv");
    const validationRows = parseValidationReport(reportPath);
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));
    const reg = buildRegistries(repoRoot);
    const allowlist = loadLeagueObtainAllowlistFile();

    console.log(
        `[verify-phase7a2-slice2-candidates] Phase 7A-2 Slice 2 gate (${SLICE2_SOURCE_IDS.length} tasks)\n`,
    );

    const byId = new Map(validationRows.map((r) => [r.task_id, r]));
    const accepted: Candidate[] = [];
    const rejected: string[] = [];

    for (const sourceId of SLICE2_SOURCE_IDS) {
        const csv = csvById.get(sourceId);
        if (!csv) {
            rejected.push(`CSV ${sourceId}: missing CSV row`);
            continue;
        }
        if (liveNames.has(csv.name.trim())) {
            rejected.push(`CSV ${sourceId}: already live (${csv.name})`);
            continue;
        }

        const row = byId.get(sourceId);
        if (!row) {
            rejected.push(`CSV ${sourceId}: missing validation row`);
            continue;
        }
        if (row.status !== "ambiguous" || !row.matched_content.includes("item candidates")) {
            rejected.push(`CSV ${sourceId}: expected ambiguous item candidates, got ${row.status}`);
            continue;
        }
        if (!row.matched_hook.includes("onItemEquip")) {
            rejected.push(`CSV ${sourceId}: expected onItemEquip, got ${row.matched_hook}`);
            continue;
        }

        const allow = getLeagueObtainAllowlistEntry(sourceId);
        if (!allow) {
            rejected.push(`CSV ${sourceId}: missing obtain allowlist entry`);
            continue;
        }
        if (allow.trigger.type !== "item_equip" || allow.trigger.itemIds?.length !== 1) {
            rejected.push(`CSV ${sourceId}: allowlist trigger must be single item_equip`);
            continue;
        }
        if ((allow.trigger.itemIds?.[0] ?? -1) !== allow.itemId) {
            rejected.push(`CSV ${sourceId}: allowlist trigger item mismatch`);
            continue;
        }

        const candidates = parseItemCandidates(row.matched_content);
        if (candidates.length < 2) {
            rejected.push(`CSV ${sourceId}: expected 2+ candidates, got ${candidates.length}`);
            continue;
        }
        const candidateItemIds = candidates.map((c) => c.id);
        if (!candidateItemIds.includes(allow.itemId)) {
            rejected.push(`CSV ${sourceId}: allowlist itemId ${allow.itemId} not in candidate list`);
            continue;
        }

        if (!reg.leagueObtainAllowlistItemIds.has(allow.itemId)) {
            rejected.push(`CSV ${sourceId}: allowlist itemId ${allow.itemId} not loaded in registries`);
            continue;
        }
        if (reg.collectionLogItemIds.has(allow.itemId)) {
            rejected.push(`CSV ${sourceId}: itemId ${allow.itemId} unexpectedly in collection log`);
            continue;
        }

        if (!reg.cacheAvailable) {
            rejected.push(`CSV ${sourceId}: cache unavailable`);
            continue;
        }
        const itemName = reg.getItemName(allow.itemId);
        if (!itemName || itemName === "null") {
            rejected.push(`CSV ${sourceId}: itemId ${allow.itemId} not in cache`);
            continue;
        }

        const alternateCandidateCount = candidateItemIds.length - 1;
        console.log(
            `  OK CSV ${sourceId} | itemId ${allow.itemId} | alternates ${alternateCandidateCount} | ${csv.name.trim()}`,
        );

        accepted.push({
            sourceTaskId: sourceId,
            name: csv.name,
            tier: "B-2",
            chosenItemId: allow.itemId,
            candidateItemIds,
            alternateCandidateCount,
            trigger: allow.trigger,
            note: allow.note ?? "allowlist-backed canonical id",
        });
    }

    if (rejected.length > 0) {
        console.error("\n[verify-phase7a2-slice2-candidates] FAIL:");
        for (const r of rejected) console.error(`  ${r}`);
        process.exit(1);
    }

    if (allowlist.entries.length < 29) {
        console.error(
            `[verify-phase7a2-slice2-candidates] FAIL: allowlist has ${allowlist.entries.length}, expected at least 29 after adding slice 2`,
        );
        process.exit(1);
    }

    const manifestPath = path.join(repoRoot, "server/data/leagues/phase7a-collection-disambiguation.json");
    let existing = { description: "", tier: "A", tasks: [] as Array<Record<string, unknown>> };
    if (fs.existsSync(manifestPath)) {
        existing = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as typeof existing;
    }

    const existingLiveIds = new Set(
        existing.tasks
            .filter((t) => typeof t.sourceTaskId === "number" && t.mvpTaskId !== undefined)
            .map((t) => t.sourceTaskId as number),
    );
    for (const sourceId of SLICE2_SOURCE_IDS) {
        if (existingLiveIds.has(sourceId)) {
            console.error(
                `[verify-phase7a2-slice2-candidates] FAIL: CSV ${sourceId} already has mvpTaskId in manifest`,
            );
            process.exit(1);
        }
    }

    const preserved = existing.tasks.filter((t) => t.mvpTaskId !== undefined);
    const otherPending = existing.tasks.filter(
        (t) => t.mvpTaskId === undefined && !SLICE2_SOURCE_IDS.includes((t.sourceTaskId ?? -1) as never),
    );
    const manifest = {
        description:
            "Phase 7A: collection ambiguous disambiguation (Slice 1 Tier A + Slice 1b allowlist + Slice 2 Tier B-1 + Slice 2 Tier B-2).",
        tier: existing.tier ?? "A",
        tasks: [
            ...preserved,
            ...otherPending,
            ...accepted.map((t) => ({
                sourceTaskId: t.sourceTaskId,
                tier: t.tier,
                chosenItemId: t.chosenItemId,
                candidateItemIds: t.candidateItemIds,
                trigger: t.trigger,
                note: t.note,
            })),
        ],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

    const auditPath = path.join(repoRoot, "server/data/leagues/reports/phase7a2-slice2-alternate-candidates.json");
    const audit = {
        generatedAt: new Date().toISOString(),
        description: "Phase 7A-2 Slice 2 alternate candidate audit trail.",
        entries: accepted.map((t) => ({
            sourceTaskId: t.sourceTaskId,
            taskName: t.name,
            chosenItemId: t.chosenItemId,
            alternateCandidateCount: t.alternateCandidateCount,
            candidateItemIds: t.candidateItemIds,
        })),
    };
    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + "\n", "utf8");

    console.log(`\n[verify-phase7a2-slice2-candidates] Wrote ${manifestPath} (+${accepted.length} slice-2 rows)`);
    console.log(`[verify-phase7a2-slice2-candidates] Wrote alternate-candidate audit: ${auditPath}`);
    console.log(`[verify-phase7a2-slice2-candidates] PASS: ${accepted.length} tasks for import`);
    console.log(`[verify-phase7a2-slice2-candidates] Expected live after import: ${LEAGUE_TASKS.length + accepted.length}`);
}

main();
