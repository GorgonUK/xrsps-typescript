/**
 * Pre-import gate for Phase 7A-1 (Strict Tier A collection ambiguous only).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7a1-candidates.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { parseCsvFile } from "./lib/csv";
import { parseValidationReport } from "./lib/parseValidation";
import { categorizeTask } from "./lib/categorize";
import { buildRegistries } from "./lib/registries";

const TIER_C_SOURCE_IDS = new Set([
    519, 1534, 1559, 1582, 1639, 1751, 1752, 1753, 1754, 1755, 1756, 1757, 1758,
]);

type Candidate = {
    sourceTaskId: number;
    name: string;
    tier: "A" | "B" | "C";
    itemId: number;
    candidateIds: number[];
    trigger: TaskTrigger;
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

function hasPlaceholderBand(ids: number[]): boolean {
    return ids.some((id) => id >= 14_000 && id < 20_000);
}

function recommendItemId(candidates: Array<{ id: number; name: string }>): number {
    const ids = candidates.map((c) => c.id);
    const low = ids.filter((id) => id < 14_000).sort((a, b) => a - b);
    if (low.length > 0) return low[0];
    const mid = ids.filter((id) => id < 14_000 || id >= 20_000).sort((a, b) => a - b);
    if (mid.length > 0) return mid[0];
    return [...ids].sort((a, b) => a - b)[0];
}

function classifyTier(name: string, candidates: Array<{ id: number; name: string }>): "A" | "B" | "C" {
    const uniqNames = new Set(candidates.map((c) => c.name.toLowerCase()));
    if (uniqNames.size > 1) return "C";
    if (/clue scroll/i.test(name)) return "C";
    if (/ornament kit/i.test(name)) return "C";
    if (candidates.length === 2) return "A";
    if (candidates.length === 3 && !hasPlaceholderBand(candidates.map((c) => c.id))) return "A";
    if (candidates.length === 3) return "B";
    if (candidates.length <= 5) return "B";
    return "B";
}

function buildTrigger(hook: string, itemId: number): TaskTrigger | undefined {
    if (hook.includes("onItemEquip")) {
        return { type: "item_equip", itemIds: [itemId] };
    }
    if (hook.includes("onItemObtain")) {
        return { type: "item_obtain", itemIds: [itemId] };
    }
    return undefined;
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const reportPath = path.join(repoRoot, "server/data/leagues/reports/validate-tasks-latest.csv");
    const validationRows = parseValidationReport(reportPath);
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));

    const collectionAmbiguous = validationRows.filter((r) => {
        const csv = csvById.get(r.task_id);
        if (!csv) return false;
        return (
            categorizeTask(csv) === "collection" &&
            r.status === "ambiguous" &&
            r.matched_content.includes("item candidates")
        );
    });

    console.log(`[verify-phase7a1-candidates] Collection ambiguous with item candidates: ${collectionAmbiguous.length}\n`);

    const reg = buildRegistries(repoRoot);
    const tierA: Candidate[] = [];
    const rejected: Array<{ sourceTaskId: number; name: string; reason: string }> = [];

    for (const row of collectionAmbiguous) {
        const csv = csvById.get(row.task_id);
        if (!csv) {
            rejected.push({ sourceTaskId: row.task_id, name: row.task_name, reason: "missing CSV row" });
            continue;
        }
        if (TIER_C_SOURCE_IDS.has(row.task_id)) {
            rejected.push({ sourceTaskId: row.task_id, name: csv.name, reason: "Tier C blocklist" });
            continue;
        }

        const candidates = parseItemCandidates(row.matched_content);
        if (candidates.length === 0) {
            rejected.push({ sourceTaskId: row.task_id, name: csv.name, reason: "no item candidates parsed" });
            continue;
        }

        const tier = classifyTier(csv.name, candidates);
        if (tier !== "A") {
            rejected.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                reason: `not strict Tier A (${tier}, ${candidates.length} candidates)`,
            });
            continue;
        }

        const itemId = recommendItemId(candidates);
        const trigger = buildTrigger(row.matched_hook, itemId);
        if (!trigger) {
            rejected.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                reason: `unsupported hook: ${row.matched_hook}`,
            });
            continue;
        }

        if (!reg.cacheAvailable) {
            rejected.push({ sourceTaskId: row.task_id, name: csv.name, reason: "cache unavailable" });
            continue;
        }
        const itemName = reg.getItemName(itemId);
        if (!itemName || itemName === "null") {
            rejected.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                reason: `itemId ${itemId} not in cache`,
            });
            continue;
        }

        const inLog = reg.collectionLogItemIds.has(itemId);
        const inManual = reg.manualDropItemNames.has(reg.npcName(itemName));
        const inAllowlist = reg.leagueObtainAllowlistItemIds.has(itemId);
        if (!inLog && !inManual && !inAllowlist) {
            rejected.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                reason: `itemId ${itemId} not obtainable (not in collection log, manual drops, or allowlist)`,
            });
            continue;
        }

        if (liveNames.has(csv.name.trim())) {
            rejected.push({ sourceTaskId: row.task_id, name: csv.name, reason: "live name collision" });
            continue;
        }

        tierA.push({
            sourceTaskId: row.task_id,
            name: csv.name,
            tier: "A",
            itemId,
            candidateIds: candidates.map((c) => c.id),
            trigger,
        });
    }

    const dupIds = tierA.map((t) => t.sourceTaskId).filter((id, i, arr) => arr.indexOf(id) !== i);
    if (dupIds.length > 0) {
        console.error(`[verify-phase7a1-candidates] FAIL: duplicate CSV ids in Tier A batch`);
        process.exit(1);
    }

    const dupNames = tierA.map((t) => t.name.trim()).filter((n, i, arr) => arr.indexOf(n) !== i);
    if (dupNames.length > 0) {
        console.error(`[verify-phase7a1-candidates] FAIL: duplicate names in Tier A batch`);
        process.exit(1);
    }

    console.log(`=== Tier A strict (import-ready): ${tierA.length} ===`);
    for (const t of tierA.sort((a, b) => a.sourceTaskId - b.sourceTaskId)) {
        console.log(
            `  CSV ${t.sourceTaskId} | ${t.trigger.type} | itemId ${t.itemId} | ${t.name}`,
        );
    }

    console.log(`\n=== Rejected: ${rejected.length} ===`);
    const rejectedFromA = rejected.filter((r) => !r.reason.startsWith("not strict"));
    const notTierA = rejected.filter((r) => r.reason.startsWith("not strict"));
    console.log(`  Tier B/C/skipped naming: ${notTierA.length}`);
    console.log(`  Tier A candidates rejected: ${rejectedFromA.length}`);
    for (const r of rejectedFromA.slice(0, 30)) {
        console.log(`  CSV ${r.sourceTaskId}: ${r.reason}`);
    }
    if (rejectedFromA.length > 30) {
        console.log(`  ... and ${rejectedFromA.length - 30} more`);
    }

    const manifestPath = path.join(repoRoot, "server/data/leagues/phase7a-collection-disambiguation.json");
    let existingTasks: Array<{ sourceTaskId: number; mvpTaskId?: number }> = [];
    if (fs.existsSync(manifestPath)) {
        const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
            tasks?: Array<{ sourceTaskId: number; mvpTaskId?: number }>;
        };
        existingTasks = parsed.tasks ?? [];
    }
    const importedIds = new Set(existingTasks.filter((t) => t.mvpTaskId !== undefined).map((t) => t.sourceTaskId));
    const newTasks = tierA.filter((t) => !importedIds.has(t.sourceTaskId));
    const preserved = existingTasks.filter((t) => t.mvpTaskId !== undefined);
    const pending = existingTasks.filter((t) => t.mvpTaskId === undefined && !importedIds.has(t.sourceTaskId));

    const manifest = {
        description: "Phase 7A: collection ambiguous disambiguation (Slice 1 Tier A + Slice 1b allowlist).",
        tier: "A",
        tasks: [
            ...preserved,
            ...pending,
            ...newTasks.map((t) => ({
                sourceTaskId: t.sourceTaskId,
                tier: t.tier,
                chosenItemId: t.itemId,
                candidateItemIds: t.candidateIds,
                trigger: t.trigger,
            })),
        ],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`\n[verify-phase7a1-candidates] Wrote ${manifestPath} (${manifest.tasks.length} tasks, +${newTasks.length} new)`);

    if (tierA.length === 0) {
        console.error("[verify-phase7a1-candidates] FAIL: no Tier A tasks to import");
        process.exit(1);
    }

    console.log(`\n[verify-phase7a1-candidates] PASS: ${tierA.length} tasks cleared for Phase 7A-1 import`);
    console.log(`[verify-phase7a1-candidates] Expected live after import: ${323 + tierA.length}`);
}

main();
