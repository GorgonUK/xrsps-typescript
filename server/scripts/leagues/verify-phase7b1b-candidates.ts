/**
 * Pre-import gate for Phase 7B-1b (2-id bosses + easy regional NPC kills).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7b1b-candidates.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { parseCsvFile } from "./lib/csv";
import { parseValidationReport } from "./lib/parseValidation";
import { buildRegistries } from "./lib/registries";

const SLICE1B_SOURCE_IDS = [
    587, 590, 602, 641, 642, 583, 817,
    1288, 1289, 1274, 1275, 1276,
    897, 899, 808, 810, 1280, 1056, 1119,
    1201, 1202, 1283, 1362, 1364, 1441,
] as const;

const RAID_BLOCKLIST = new Set([621, 622, 623, 624, 626, 627, 629, 630, 631]);

const FUTURE_REVIEW: Partial<Record<number, string>> = {
    1283: "regional-wilderness-filter",
};

type Candidate = {
    sourceTaskId: number;
    name: string;
    slice: "1b";
    tier: "A";
    chosenNpcId: number;
    candidateNpcIds: number[];
    trigger: TaskTrigger;
    note: string;
    futureReview?: string;
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

    console.log(`[verify-phase7b1b-candidates] Phase 7B-1b gate (${SLICE1B_SOURCE_IDS.length} CSV ids)\n`);

    for (const sourceTaskId of SLICE1B_SOURCE_IDS) {
        if (RAID_BLOCKLIST.has(sourceTaskId)) {
            rejected.push({ sourceTaskId, name: "?", reason: "raid boss blocklist" });
            continue;
        }

        const csv = csvById.get(sourceTaskId);
        if (!csv) {
            rejected.push({ sourceTaskId, name: "?", reason: "missing CSV row" });
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
        if (candidates.length !== 2) {
            rejected.push({
                sourceTaskId,
                name: csv.name,
                reason: `expected exactly 2 candidates, got ${candidates.length}`,
            });
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

        const futureReview = FUTURE_REVIEW[sourceTaskId];
        tierA.push({
            sourceTaskId,
            name: csv.name,
            slice: "1b",
            tier: "A",
            chosenNpcId: pick.npcId,
            candidateNpcIds: candidateIds,
            note: pick.note,
            futureReview,
            trigger: { type: "npc_kill", npcIds: [pick.npcId] },
        });
    }

    const dupIds = tierA.map((t) => t.sourceTaskId).filter((id, i, arr) => arr.indexOf(id) !== i);
    if (dupIds.length > 0) {
        console.error(`[verify-phase7b1b-candidates] FAIL: duplicate CSV ids in batch: ${dupIds.join(", ")}`);
        process.exit(1);
    }

    const dupNames = tierA.map((t) => t.name.trim()).filter((n, i, arr) => arr.indexOf(n) !== i);
    if (dupNames.length > 0) {
        console.error(`[verify-phase7b1b-candidates] FAIL: duplicate task names in batch: ${dupNames.join(", ")}`);
        process.exit(1);
    }

    console.log(`=== Tier A (import-ready): ${tierA.length} ===`);
    for (const t of tierA.sort((a, b) => a.sourceTaskId - b.sourceTaskId)) {
        const review = t.futureReview ? ` [futureReview: ${t.futureReview}]` : "";
        console.log(`  CSV ${t.sourceTaskId} | npcId ${t.chosenNpcId} | ${t.name}${review}`);
    }

    console.log(`\n=== Rejected: ${rejected.length} ===`);
    for (const r of rejected) {
        console.log(`  CSV ${r.sourceTaskId}: ${r.reason}`);
    }

    if (tierA.length !== SLICE1B_SOURCE_IDS.length) {
        console.error(
            `\n[verify-phase7b1b-candidates] FAIL: expected ${SLICE1B_SOURCE_IDS.length} tasks, got ${tierA.length}`,
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
    const liveSourceIds = new Set(
        existingTasks.filter((t) => t.mvpTaskId !== undefined).map((t) => t.sourceTaskId),
    );
    for (const sourceTaskId of SLICE1B_SOURCE_IDS) {
        if (liveSourceIds.has(sourceTaskId)) {
            console.error(
                `[verify-phase7b1b-candidates] FAIL: CSV ${sourceTaskId} already has mvpTaskId in manifest`,
            );
            process.exit(1);
        }
    }

    const preserved = existingTasks.filter((t) => t.mvpTaskId !== undefined);
    const otherPending = existingTasks.filter(
        (t) => t.mvpTaskId === undefined && t.slice !== "1b",
    );
    const newTasks = tierA;

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
                ...(t.futureReview ? { futureReview: t.futureReview } : {}),
                trigger: t.trigger,
            })),
        ],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`\n[verify-phase7b1b-candidates] Wrote ${manifestPath} (+${newTasks.length} new slice 1b)`);
    console.log(`[verify-phase7b1b-candidates] PASS: ${tierA.length} tasks for import`);
    console.log(`[verify-phase7b1b-candidates] Expected live after import: ${LEAGUE_TASKS.length + newTasks.length}`);
}

main();
