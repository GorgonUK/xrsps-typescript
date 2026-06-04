/**
 * Pre-import gate for Phase 7B-1a (generic NPC kill Tier A).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7b1a-candidates.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { parseCsvFile } from "./lib/csv";
import { parseValidationReport } from "./lib/parseValidation";
import { categorizeTask } from "./lib/categorize";
import { buildRegistries } from "./lib/registries";

const SLICE1A_SOURCE_IDS: number[] = [];
for (let id = 554; id <= 579; id++) {
    SLICE1A_SOURCE_IDS.push(id);
}
SLICE1A_SOURCE_IDS.push(750);

/** No spawned variant among cache name matches — defer to 7B-2 / spawn work. */
const SLICE1A_DEFERRED = new Set([570]);

type Candidate = {
    sourceTaskId: number;
    name: string;
    slice: "1a";
    tier: "A";
    chosenNpcId: number;
    candidateNpcIds: number[];
    trigger: TaskTrigger;
    note: string;
};

function parseNpcCandidates(content: string): Array<{ id: number; name: string }> {
    const m = content.match(/npc candidates:\s*(.+)/i);
    if (!m) return [];
    const out: Array<{ id: number; name: string }> = [];
    for (const seg of m[1].split(";")) {
        const p = seg.trim().match(/^(\d+):(.+)$/);
        if (p) out.push({ id: parseInt(p[1], 10), name: p[2].trim() });
    }
    return out;
}

function isRegionalTaskName(name: string): boolean {
    return /\s(in|near|on)\s+/i.test(name);
}

function recommendSpawnedNpcId(
    candidateIds: number[],
    spawnedNpcIds: Set<number>,
): { npcId: number; note: string } | undefined {
    const spawned = candidateIds.filter((id) => spawnedNpcIds.has(id));
    if (spawned.length === 0) return undefined;
    const preferReal = spawned.filter((id) => id < 14_000).sort((a, b) => a - b);
    if (preferReal.length > 0) {
        return { npcId: preferReal[0], note: "lowest spawned variant (id < 14000)" };
    }
    const sorted = [...spawned].sort((a, b) => a - b);
    return { npcId: sorted[0], note: "lowest spawned variant" };
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const reportPath = path.join(repoRoot, "server/data/leagues/reports/validate-tasks-latest.csv");
    const validationRows = parseValidationReport(reportPath);
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));
    const reg = buildRegistries(repoRoot);

    const byId = new Map(validationRows.map((r) => [r.task_id, r]));
    const tierA: Candidate[] = [];
    const rejected: Array<{ sourceTaskId: number; name: string; reason: string }> = [];

    console.log(`[verify-phase7b1a-candidates] Phase 7B-1a generic NPC kill gate (${SLICE1A_SOURCE_IDS.length} CSV ids)\n`);

    for (const sourceTaskId of SLICE1A_SOURCE_IDS) {
        if (SLICE1A_DEFERRED.has(sourceTaskId)) {
            rejected.push({
                sourceTaskId,
                name: csvById.get(sourceTaskId)?.name ?? "?",
                reason: "deferred: no spawned Troll variant (7B-2)",
            });
            continue;
        }
        const csv = csvById.get(sourceTaskId);
        if (!csv) {
            rejected.push({ sourceTaskId, name: "?", reason: "missing CSV row" });
            continue;
        }
        const batch = categorizeTask(csv);
        if (batch === "bosses") {
            rejected.push({ sourceTaskId, name: csv.name, reason: "bosses batch excluded from 7B-1a" });
            continue;
        }
        if (isRegionalTaskName(csv.name)) {
            rejected.push({ sourceTaskId, name: csv.name, reason: "regional task excluded from 7B-1a" });
            continue;
        }

        const row = byId.get(sourceTaskId);
        if (!row) {
            rejected.push({ sourceTaskId, name: csv.name, reason: "missing validation row" });
            continue;
        }
        if (row.status !== "ambiguous" || !row.matched_content.includes("npc candidates")) {
            rejected.push({
                sourceTaskId,
                name: csv.name,
                reason: `expected ambiguous npc candidates, got ${row.status}`,
            });
            continue;
        }

        const candidates = parseNpcCandidates(row.matched_content);
        if (candidates.length === 0) {
            rejected.push({ sourceTaskId, name: csv.name, reason: "no npc candidates parsed" });
            continue;
        }

        const candidateIds = candidates.map((c) => c.id);
        const pick = recommendSpawnedNpcId(candidateIds, reg.spawnedNpcIds);
        if (!pick) {
            rejected.push({
                sourceTaskId,
                name: csv.name,
                reason: `no spawned candidate among ${candidateIds.join(", ")}`,
            });
            continue;
        }

        if (!reg.cacheAvailable) {
            rejected.push({ sourceTaskId, name: csv.name, reason: "cache unavailable" });
            continue;
        }
        const npcName = reg.getNpcName(pick.npcId);
        if (!npcName || npcName === "null") {
            rejected.push({
                sourceTaskId,
                name: csv.name,
                reason: `npcId ${pick.npcId} not in cache`,
            });
            continue;
        }

        if (liveNames.has(csv.name.trim())) {
            rejected.push({ sourceTaskId, name: csv.name, reason: "live name collision" });
            continue;
        }

        tierA.push({
            sourceTaskId,
            name: csv.name,
            slice: "1a",
            tier: "A",
            chosenNpcId: pick.npcId,
            candidateNpcIds: candidateIds,
            note: pick.note,
            trigger: { type: "npc_kill", npcIds: [pick.npcId] },
        });
    }

    console.log(`=== Tier A (import-ready): ${tierA.length} ===`);
    for (const t of tierA) {
        console.log(`  CSV ${t.sourceTaskId} | npcId ${t.chosenNpcId} | ${t.name}`);
    }

    console.log(`\n=== Rejected: ${rejected.length} ===`);
    for (const r of rejected) {
        console.log(`  CSV ${r.sourceTaskId}: ${r.reason}`);
    }

    const requiredCount = SLICE1A_SOURCE_IDS.length - SLICE1A_DEFERRED.size;
    if (tierA.length !== requiredCount) {
        console.error(
            `\n[verify-phase7b1a-candidates] FAIL: expected ${requiredCount} tasks, got ${tierA.length}`,
        );
        process.exit(1);
    }

    const manifestPath = path.join(repoRoot, "server/data/leagues/phase7b-npc-disambiguation.json");
    let existingTasks: Array<{ sourceTaskId: number; mvpTaskId?: number; slice?: string }> = [];
    if (fs.existsSync(manifestPath)) {
        const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
            tasks?: Array<{ sourceTaskId: number; mvpTaskId?: number; slice?: string }>;
        };
        existingTasks = parsed.tasks ?? [];
    }
    const importedIds = new Set(
        existingTasks.filter((t) => t.mvpTaskId !== undefined).map((t) => t.sourceTaskId),
    );
    const preserved = existingTasks.filter((t) => t.mvpTaskId !== undefined);
    const otherPending = existingTasks.filter(
        (t) => t.mvpTaskId === undefined && t.slice !== "1a",
    );
    const newTasks = tierA.filter((t) => !importedIds.has(t.sourceTaskId));

    const manifest = {
        description:
            "Phase 7B: NPC kill disambiguation (manifest overrides cache name lookup for validate + import).",
        tasks: [
            ...preserved,
            ...otherPending,
            ...newTasks.map((t) => ({
                sourceTaskId: t.sourceTaskId,
                slice: t.slice,
                tier: t.tier,
                chosenNpcId: t.chosenNpcId,
                candidateNpcIds: t.candidateNpcIds,
                note: t.note,
                trigger: t.trigger,
            })),
        ],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`\n[verify-phase7b1a-candidates] Wrote ${manifestPath} (+${newTasks.length} new slice 1a)`);
    console.log(`[verify-phase7b1a-candidates] PASS: ${tierA.length} tasks for import`);
    console.log(`[verify-phase7b1a-candidates] Expected live after import: ${LEAGUE_TASKS.length + newTasks.length}`);
}

main();
