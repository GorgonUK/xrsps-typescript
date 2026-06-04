/**
 * Pre-import gate for Phase 7A-2 Slice 4a (registry-only Tier B collection tasks).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7a2-slice4a-candidates.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { parseCsvFile } from "./lib/csv";
import { getLeagueObtainAllowlistEntry, resetLeagueObtainAllowlistCache } from "./lib/leagueObtainAllowlist";
import { parseValidationReport } from "./lib/parseValidation";
import { buildRegistries } from "./lib/registries";

const SLICE4A_SOURCE_IDS = [
    1558, 1561, 1565, 1566, 1567, 1568, 1571, 1613, 1622, 1625, 1626, 1630, 1636, 1637, 1638, 1648,
    1652, 1653, 1654, 1655, 1656, 1657, 1658, 1659, 1660, 1661, 1662, 1663, 1664, 1665, 1666, 1667,
    1668, 1669, 1670, 1671, 1672, 1673, 1674, 1675, 1676, 1677, 1678, 1679, 1680, 1682, 1687, 1688,
    1689, 1692, 1693, 1694, 1695, 1696, 1701, 1702, 1703, 1704, 1705, 1706, 1707, 1708, 1710, 1711,
    1713, 1714, 1715, 1716, 1717, 1730, 1732, 1733, 1735,
] as const;

type Candidate = {
    sourceTaskId: number;
    name: string;
    tier: "B-4a";
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

    console.log(
        `[verify-phase7a2-slice4a-candidates] Phase 7A-2 Slice 4a gate (${SLICE4A_SOURCE_IDS.length} tasks)\n`,
    );

    const byId = new Map(validationRows.map((r) => [r.task_id, r]));
    const accepted: Candidate[] = [];
    const rejected: string[] = [];

    for (const sourceId of SLICE4A_SOURCE_IDS) {
        const csv = csvById.get(sourceId);
        if (!csv) {
            rejected.push(`CSV ${sourceId}: missing CSV row`);
            continue;
        }
        if (liveNames.has(csv.name.trim())) {
            rejected.push(`CSV ${sourceId}: already live (${csv.name})`);
            continue;
        }
        if (getLeagueObtainAllowlistEntry(sourceId)) {
            rejected.push(`CSV ${sourceId}: unexpected allowlist entry (registry-only slice)`);
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

        const candidates = parseItemCandidates(row.matched_content);
        if (candidates.length < 2) {
            rejected.push(`CSV ${sourceId}: expected 2+ candidates, got ${candidates.length}`);
            continue;
        }
        const candidateItemIds = candidates.map((c) => c.id);
        const uniqueNames = new Set(candidates.map((c) => c.name.toLowerCase()));
        if (uniqueNames.size > 1) {
            rejected.push(`CSV ${sourceId}: wrong-family item candidates`);
            continue;
        }

        const logHits = candidateItemIds.filter((id) => reg.collectionLogItemIds.has(id));
        if (logHits.length !== 1) {
            rejected.push(`CSV ${sourceId}: expected exactly one collection-log hit, got ${logHits.length}`);
            continue;
        }
        const chosenItemId = logHits[0];
        if (reg.leagueObtainAllowlistItemIds.has(chosenItemId)) {
            rejected.push(`CSV ${sourceId}: chosen itemId ${chosenItemId} is allowlist-only, not registry`);
            continue;
        }

        if (!reg.cacheAvailable) {
            rejected.push(`CSV ${sourceId}: cache unavailable`);
            continue;
        }
        const itemName = reg.getItemName(chosenItemId);
        if (!itemName || itemName === "null") {
            rejected.push(`CSV ${sourceId}: itemId ${chosenItemId} not in cache item definitions`);
            continue;
        }

        const alternateCandidateCount = candidateItemIds.length - 1;
        console.log(
            `  OK CSV ${sourceId} | itemId ${chosenItemId} (${itemName}) | alternates ${alternateCandidateCount} | ${csv.name.trim()}`,
        );

        accepted.push({
            sourceTaskId: sourceId,
            name: csv.name,
            tier: "B-4a",
            chosenItemId,
            candidateItemIds,
            alternateCandidateCount,
            trigger: { type: "item_equip", itemIds: [chosenItemId] },
            note: "registry-only canonical base (collectionLogItemIds)",
        });
    }

    if (rejected.length > 0) {
        console.error("\n[verify-phase7a2-slice4a-candidates] FAIL:");
        for (const r of rejected) console.error(`  ${r}`);
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
    for (const sourceId of SLICE4A_SOURCE_IDS) {
        if (existingLiveIds.has(sourceId)) {
            console.error(
                `[verify-phase7a2-slice4a-candidates] FAIL: CSV ${sourceId} already has mvpTaskId in manifest`,
            );
            process.exit(1);
        }
    }

    const preserved = existing.tasks.filter((t) => t.mvpTaskId !== undefined);
    const otherPending = existing.tasks.filter(
        (t) => t.mvpTaskId === undefined && !SLICE4A_SOURCE_IDS.includes((t.sourceTaskId ?? -1) as never),
    );
    const manifest = {
        description:
            "Phase 7A: collection ambiguous disambiguation (Slice 1 Tier A + Slice 1b allowlist + Slice 2 Tier B-1 + Slice 2 Tier B-2 + Slice 3 Tier B-3 + Slice 4 Tier B-4a).",
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

    const auditPath = path.join(repoRoot, "server/data/leagues/reports/phase7a2-slice4a-alternate-candidates.json");
    const audit = {
        generatedAt: new Date().toISOString(),
        description: "Phase 7A-2 Slice 4a alternate candidate audit trail.",
        entries: accepted.map((t) => ({
            sourceTaskId: t.sourceTaskId,
            taskName: t.name,
            chosenItemId: t.chosenItemId,
            alternateCandidateCount: t.alternateCandidateCount,
            candidateItemIds: t.candidateItemIds,
        })),
    };
    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + "\n", "utf8");

    console.log(`\n[verify-phase7a2-slice4a-candidates] Wrote ${manifestPath} (+${accepted.length} slice-4a rows)`);
    console.log(`[verify-phase7a2-slice4a-candidates] Wrote alternate-candidate audit: ${auditPath}`);
    console.log(`[verify-phase7a2-slice4a-candidates] PASS: ${accepted.length} tasks for import`);
    console.log(
        `[verify-phase7a2-slice4a-candidates] Expected live after import: ${LEAGUE_TASKS.length + accepted.length}`,
    );
}

main();
