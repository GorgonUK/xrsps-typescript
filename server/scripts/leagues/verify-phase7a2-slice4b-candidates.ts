/**
 * Pre-import gate for Phase 7A-2 Slice 4b (11 allowlist + 1 registry Tier B collection tasks).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7a2-slice4b-candidates.ts
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

const SLICE4B_SOURCE_IDS = [
    478, 479, 480, 1517, 1528, 1550, 1551, 1570, 1573, 1574, 1608, 1761,
] as const;
const REQUIRE_ALLOWLIST = new Set([
    478, 479, 480, 1517, 1528, 1550, 1570, 1573, 1574, 1608, 1761,
]);
const REQUIRE_REGISTRY = new Set([1551]);
const REGISTRY_CHOSEN_ITEM_ID = 3140;

type Candidate = {
    sourceTaskId: number;
    name: string;
    tier: "B-4b" | "B-4b-reg";
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
        `[verify-phase7a2-slice4b-candidates] Phase 7A-2 Slice 4b gate (${SLICE4B_SOURCE_IDS.length} tasks)\n`,
    );

    const byId = new Map(validationRows.map((r) => [r.task_id, r]));
    const accepted: Candidate[] = [];
    const rejected: string[] = [];

    for (const sourceId of SLICE4B_SOURCE_IDS) {
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

        const requiredAllow = REQUIRE_ALLOWLIST.has(sourceId);
        const requiredRegistry = REQUIRE_REGISTRY.has(sourceId);
        if (!requiredAllow && !requiredRegistry) {
            rejected.push(`CSV ${sourceId}: task not classified into allowlist/registry set`);
            continue;
        }

        const allow = getLeagueObtainAllowlistEntry(sourceId);
        if (requiredRegistry && allow) {
            rejected.push(`CSV ${sourceId}: registry-only task must not have allowlist entry`);
            continue;
        }
        if (requiredAllow && !allow) {
            rejected.push(`CSV ${sourceId}: required allowlist entry missing`);
            continue;
        }
        if (requiredAllow && allow!.trigger.type !== "item_equip") {
            rejected.push(`CSV ${sourceId}: allowlist trigger must be item_equip`);
            continue;
        }
        if (requiredAllow && (allow!.trigger.itemIds?.length ?? 0) !== 1) {
            rejected.push(`CSV ${sourceId}: allowlist trigger must be single item_equip`);
            continue;
        }
        if (requiredAllow && allow!.itemId !== allow!.trigger.itemIds![0]) {
            rejected.push(`CSV ${sourceId}: allowlist trigger item mismatch`);
            continue;
        }
        if (requiredAllow && !candidateItemIds.includes(allow!.itemId)) {
            rejected.push(`CSV ${sourceId}: allowlist itemId ${allow!.itemId} not in candidate list`);
            continue;
        }

        let chosenItemId = -1;
        let tier: "B-4b" | "B-4b-reg" = "B-4b";
        let note = "";

        if (requiredAllow) {
            chosenItemId = allow!.itemId;
            note = `allowlist canonical base (${allow!.note ?? "validation-only"})`;
        } else {
            const logHits = candidateItemIds.filter((id) => reg.collectionLogItemIds.has(id));
            if (logHits.length !== 1) {
                rejected.push(`CSV ${sourceId}: expected exactly one collection-log hit, got ${logHits.length}`);
                continue;
            }
            if (logHits[0] !== REGISTRY_CHOSEN_ITEM_ID) {
                rejected.push(
                    `CSV ${sourceId}: expected registry itemId ${REGISTRY_CHOSEN_ITEM_ID}, got ${logHits[0]}`,
                );
                continue;
            }
            chosenItemId = REGISTRY_CHOSEN_ITEM_ID;
            tier = "B-4b-reg";
            note = "registry-only canonical base (collectionLogItemIds)";
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
            `  OK CSV ${sourceId} | itemId ${chosenItemId} (${itemName}) | alternates ${alternateCandidateCount} | ${tier} | ${csv.name.trim()}`,
        );

        accepted.push({
            sourceTaskId: sourceId,
            name: csv.name,
            tier,
            chosenItemId,
            candidateItemIds,
            alternateCandidateCount,
            trigger: { type: "item_equip", itemIds: [chosenItemId] },
            note,
        });
    }

    if (rejected.length > 0) {
        console.error("\n[verify-phase7a2-slice4b-candidates] FAIL:");
        for (const r of rejected) console.error(`  ${r}`);
        process.exit(1);
    }

    if (allowlist.entries.length < 45) {
        console.error(
            `[verify-phase7a2-slice4b-candidates] FAIL: allowlist has ${allowlist.entries.length}, expected at least 45 after slice 4b additions`,
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
    for (const sourceId of SLICE4B_SOURCE_IDS) {
        if (existingLiveIds.has(sourceId)) {
            console.error(
                `[verify-phase7a2-slice4b-candidates] FAIL: CSV ${sourceId} already has mvpTaskId in manifest`,
            );
            process.exit(1);
        }
    }

    const preserved = existing.tasks.filter((t) => t.mvpTaskId !== undefined);
    const otherPending = existing.tasks.filter(
        (t) => t.mvpTaskId === undefined && !SLICE4B_SOURCE_IDS.includes((t.sourceTaskId ?? -1) as never),
    );
    const manifest = {
        description:
            "Phase 7A: collection ambiguous disambiguation (Slice 1 Tier A + Slice 1b allowlist + Slice 2 Tier B-1 + Slice 2 Tier B-2 + Slice 3 Tier B-3 + Slice 4 Tier B-4a + Slice 4 Tier B-4b).",
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

    const auditPath = path.join(repoRoot, "server/data/leagues/reports/phase7a2-slice4b-alternate-candidates.json");
    const audit = {
        generatedAt: new Date().toISOString(),
        description: "Phase 7A-2 Slice 4b alternate candidate audit trail.",
        entries: accepted.map((t) => ({
            sourceTaskId: t.sourceTaskId,
            taskName: t.name,
            chosenItemId: t.chosenItemId,
            alternateCandidateCount: t.alternateCandidateCount,
            candidateItemIds: t.candidateItemIds,
            tier: t.tier,
        })),
    };
    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + "\n", "utf8");

    console.log(`\n[verify-phase7a2-slice4b-candidates] Wrote ${manifestPath} (+${accepted.length} slice-4b rows)`);
    console.log(`[verify-phase7a2-slice4b-candidates] Wrote alternate-candidate audit: ${auditPath}`);
    console.log(`[verify-phase7a2-slice4b-candidates] PASS: ${accepted.length} tasks for import`);
    console.log(
        `[verify-phase7a2-slice4b-candidates] Expected live after import: ${LEAGUE_TASKS.length + accepted.length}`,
    );
}

main();
