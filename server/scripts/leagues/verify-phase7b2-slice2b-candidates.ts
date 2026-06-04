/**
 * Pre-import gate for Phase 7B-2 Slice 2B (monster-route sub-chamber NPC kill disambiguation).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7b2-slice2b-candidates.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { parseCsvFile } from "./lib/csv";
import { parseValidationReport } from "./lib/parseValidation";
import { buildRegistries } from "./lib/registries";
import {
    PHASE7B2_SLICE2B_APPROVED,
    PHASE7B2_SLICE2B_REGION_BOUNDS,
    PHASE7B2_SLICE2B_SOURCE_IDS,
} from "./lib/phase7b2Slice2bApproved";
import type { Phase7b2Slice2aBounds } from "./lib/phase7b2Slice2aApproved";

type Candidate = {
    sourceTaskId: number;
    name: string;
    slice: "2b";
    tier: "A";
    chosenNpcId: number;
    candidateNpcIds: number[];
    trigger: TaskTrigger;
    note: string;
    confidence: string;
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

function spawnCountInBounds(
    repoRoot: string,
    npcId: number,
    bounds: Phase7b2Slice2aBounds,
): number {
    const spawns = JSON.parse(
        fs.readFileSync(path.join(repoRoot, "server/data/npc-spawns.json"), "utf8"),
    ) as Array<{ id: number; x: number; y: number; level?: number }>;
    return spawns.filter((s) => {
        if (s.id !== npcId) return false;
        const level = s.level ?? 0;
        if (bounds.plane !== undefined && level !== bounds.plane) return false;
        return (
            s.x >= bounds.minX &&
            s.x <= bounds.maxX &&
            s.y >= bounds.minY &&
            s.y <= bounds.maxY
        );
    }).length;
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const validationRows = parseValidationReport(
        path.join(repoRoot, "server/data/leagues/reports/validate-tasks-latest.csv"),
    );
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));
    const reg = buildRegistries(repoRoot);
    const byId = new Map(validationRows.map((r) => [r.task_id, r]));

    const tierA: Candidate[] = [];
    const rejected: Array<{ sourceTaskId: number; name: string; reason: string }> = [];

    console.log(
        `[verify-phase7b2-slice2b-candidates] Phase 7B-2 Slice 2B gate (${PHASE7B2_SLICE2B_SOURCE_IDS.length} CSV ids)\n`,
    );

    for (const approved of PHASE7B2_SLICE2B_APPROVED) {
        const sourceTaskId = approved.sourceTaskId;
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

        const parsed = parseNpcCandidates(row.matched_content);
        const parsedIds = parsed.map((c) => c.id).sort((a, b) => a - b);
        const expectedIds = [...approved.candidateNpcIds].sort((a, b) => a - b);
        if (parsedIds.join(",") !== expectedIds.join(",")) {
            rejected.push({
                sourceTaskId,
                name: csv.name,
                reason: `candidate mismatch: expected [${expectedIds.join(", ")}], got [${parsedIds.join(", ")}]`,
            });
            continue;
        }

        const bounds = PHASE7B2_SLICE2B_REGION_BOUNDS[sourceTaskId];
        if (!bounds) {
            rejected.push({ sourceTaskId, name: csv.name, reason: "missing region bounds" });
            continue;
        }

        const spawnedInRegion: Array<{ id: number; count: number }> = [];
        for (const id of approved.candidateNpcIds) {
            const count = spawnCountInBounds(repoRoot, id, bounds);
            if (count > 0) spawnedInRegion.push({ id, count });
        }
        if (spawnedInRegion.length !== 1 || spawnedInRegion[0].id !== approved.chosenNpcId) {
            rejected.push({
                sourceTaskId,
                name: csv.name,
                reason: `sub-chamber spawn proof failed: ${JSON.stringify(spawnedInRegion)}`,
            });
            continue;
        }

        if (!reg.cacheAvailable) {
            rejected.push({ sourceTaskId, name: csv.name, reason: "cache unavailable" });
            continue;
        }
        const npcName = reg.getNpcName(approved.chosenNpcId);
        if (!npcName || npcName === "null") {
            rejected.push({
                sourceTaskId,
                name: csv.name,
                reason: `npcId ${approved.chosenNpcId} not in cache`,
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
            slice: "2b",
            tier: "A",
            chosenNpcId: approved.chosenNpcId,
            candidateNpcIds: approved.candidateNpcIds,
            note: `monster-route sub-chamber: ${approved.boundsProof} (${approved.regionProof})`,
            confidence: approved.confidence,
            trigger: { type: "npc_kill", npcIds: [approved.chosenNpcId] },
        });
    }

    if (tierA.length !== PHASE7B2_SLICE2B_SOURCE_IDS.length) {
        console.log(`=== Tier A (import-ready): ${tierA.length} ===`);
        for (const t of tierA.sort((a, b) => a.sourceTaskId - b.sourceTaskId)) {
            console.log(`  CSV ${t.sourceTaskId} | npcId ${t.chosenNpcId} | ${t.name}`);
        }
        console.log(`\n=== Rejected: ${rejected.length} ===`);
        for (const r of rejected) {
            console.log(`  CSV ${r.sourceTaskId}: ${r.reason}`);
        }
        console.error(
            `\n[verify-phase7b2-slice2b-candidates] FAIL: expected ${PHASE7B2_SLICE2B_SOURCE_IDS.length}, got ${tierA.length}`,
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
    for (const sourceTaskId of PHASE7B2_SLICE2B_SOURCE_IDS) {
        const live = existingTasks.find((t) => t.sourceTaskId === sourceTaskId && t.mvpTaskId !== undefined);
        if (live) {
            console.error(
                `[verify-phase7b2-slice2b-candidates] FAIL: CSV ${sourceTaskId} already has mvpTaskId in manifest`,
            );
            process.exit(1);
        }
    }

    const preserved = existingTasks.filter((t) => t.mvpTaskId !== undefined);
    const otherPending = existingTasks.filter(
        (t) =>
            t.mvpTaskId === undefined &&
            t.slice !== "2b" &&
            !(PHASE7B2_SLICE2B_SOURCE_IDS as readonly number[]).includes(t.sourceTaskId),
    );
    const manifest = {
        description:
            "Phase 7B: NPC kill disambiguation (manifest overrides cache name lookup for validate + import).",
        tasks: [
            ...preserved,
            ...otherPending,
            ...tierA.map((t) => ({
                sourceTaskId: t.sourceTaskId,
                slice: t.slice,
                tier: t.tier,
                chosenNpcId: t.chosenNpcId,
                candidateNpcIds: t.candidateNpcIds,
                note: t.note,
                confidence: t.confidence,
                trigger: t.trigger,
            })),
        ],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

    console.log(`=== Tier A (import-ready): ${tierA.length} ===`);
    for (const t of tierA.sort((a, b) => a.sourceTaskId - b.sourceTaskId)) {
        console.log(`  CSV ${t.sourceTaskId} | npcId ${t.chosenNpcId} | ${t.name}`);
    }
    console.log(`\n[verify-phase7b2-slice2b-candidates] Wrote ${manifestPath} (+${tierA.length} slice 2b)`);
    console.log(`[verify-phase7b2-slice2b-candidates] PASS: ${tierA.length} tasks for import`);
    console.log(
        `[verify-phase7b2-slice2b-candidates] Expected live after import: ${LEAGUE_TASKS.length + tierA.length}`,
    );
}

main();
