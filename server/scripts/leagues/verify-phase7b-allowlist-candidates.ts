/**
 * Pre-import gate for Phase 7B-allowlist (instance/dynamic/farming boss npc_kill tasks).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7b-allowlist-candidates.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { parseCsvFile } from "./lib/csv";
import {
    getLeagueNpcKillAllowlistEntry,
    isValidLeagueNpcKillProofType,
    loadLeagueNpcKillAllowlistFile,
    resetLeagueNpcKillAllowlistCache,
} from "./lib/leagueNpcKillAllowlist";
import { parseValidationReport } from "./lib/parseValidation";
import { buildRegistries } from "./lib/registries";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";

const ALLOWLIST_SOURCE_IDS = [596, 638, 601] as const;

const EXCLUDED_BLOCKLIST = new Set([
    588, 608, 610, 644,
    621, 622, 623, 624, 626, 627, 629, 630, 631,
]);

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

function triggersMatch(a: TaskTrigger, b: TaskTrigger): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function main(): void {
    resetLeagueNpcKillAllowlistCache();
    const repoRoot = path.resolve(__dirname, "../../..");
    const allowlist = loadLeagueNpcKillAllowlistFile();
    const reportPath = path.join(repoRoot, "server/data/leagues/reports/validate-tasks-latest.csv");
    const validationRows = parseValidationReport(reportPath);
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));
    const reg = buildRegistries(repoRoot);
    const byId = new Map(validationRows.map((r) => [r.task_id, r]));

    console.log(
        `[verify-phase7b-allowlist-candidates] Phase 7B-allowlist gate (${ALLOWLIST_SOURCE_IDS.length} tasks)\n`,
    );

    if (allowlist.entries.length !== ALLOWLIST_SOURCE_IDS.length) {
        console.error(
            `[verify-phase7b-allowlist-candidates] FAIL: allowlist has ${allowlist.entries.length} entries, expected ${ALLOWLIST_SOURCE_IDS.length}`,
        );
        process.exit(1);
    }

    const rejected: string[] = [];
    const manifestTasks: Array<{
        sourceTaskId: number;
        slice: string;
        tier: string;
        chosenNpcId: number;
        candidateNpcIds: number[];
        note: string;
        trigger: TaskTrigger;
    }> = [];

    for (const sourceId of ALLOWLIST_SOURCE_IDS) {
        if (EXCLUDED_BLOCKLIST.has(sourceId)) {
            rejected.push(`CSV ${sourceId}: explicit blocklist`);
            continue;
        }

        const entry = getLeagueNpcKillAllowlistEntry(sourceId);
        if (!entry) {
            rejected.push(`CSV ${sourceId}: missing allowlist entry`);
            continue;
        }
        if (!isValidLeagueNpcKillProofType(entry.proofType)) {
            rejected.push(`CSV ${sourceId}: invalid proofType "${entry.proofType}"`);
            continue;
        }
        if (!reg.leagueNpcKillAllowlistSourceIds.has(sourceId)) {
            rejected.push(`CSV ${sourceId}: not loaded in allowlist source-id set`);
            continue;
        }
        if (entry.trigger.type !== "npc_kill" || entry.trigger.npcIds.length !== 1) {
            rejected.push(`CSV ${sourceId}: allowlist trigger must be single npc_kill`);
            continue;
        }
        if (entry.trigger.npcIds[0] !== entry.npcId) {
            rejected.push(`CSV ${sourceId}: trigger npcIds[0] !== npcId`);
            continue;
        }

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
        if (row.status !== "ambiguous" || !row.matched_content.includes("npc candidates")) {
            rejected.push(`CSV ${sourceId}: expected ambiguous npc candidates, got ${row.status}`);
            continue;
        }

        const candidates = parseNpcCandidates(row.matched_content);
        if (candidates.length < 2) {
            rejected.push(`CSV ${sourceId}: expected 2+ candidates, got ${candidates.length}`);
            continue;
        }
        const candidateIds = candidates.map((c) => c.id);
        if (!candidateIds.includes(entry.npcId)) {
            rejected.push(`CSV ${sourceId}: npcId ${entry.npcId} not among candidates`);
            continue;
        }
        if (candidateIds.some((id) => reg.spawnedNpcIds.has(id))) {
            rejected.push(`CSV ${sourceId}: candidate spawned — use spawn path, not allowlist`);
            continue;
        }
        if (reg.spawnedNpcIds.has(entry.npcId)) {
            rejected.push(`CSV ${sourceId}: chosen npcId ${entry.npcId} is spawned`);
            continue;
        }

        if (!reg.cacheAvailable) {
            rejected.push(`CSV ${sourceId}: cache unavailable`);
            continue;
        }
        const npcName = reg.getNpcName(entry.npcId);
        if (!npcName || npcName === "null") {
            rejected.push(`CSV ${sourceId}: npcId ${entry.npcId} not in cache`);
            continue;
        }

        console.log(
            `  OK CSV ${sourceId} | ${entry.proofType} | npcId ${entry.npcId} | ${csv.name.trim()}`,
        );
        manifestTasks.push({
            sourceTaskId: sourceId,
            slice: "7B-allowlist",
            tier: "A",
            chosenNpcId: entry.npcId,
            candidateNpcIds: candidateIds,
            note: `allowlist (${entry.proofType}) — ${entry.note ?? ""}`.trim(),
            trigger: entry.trigger,
        });
    }

    if (rejected.length > 0) {
        console.error("\n[verify-phase7b-allowlist-candidates] FAIL:");
        for (const r of rejected) console.error(`  ${r}`);
        process.exit(1);
    }

    for (const task of manifestTasks) {
        const allow = getLeagueNpcKillAllowlistEntry(task.sourceTaskId)!;
        if (!triggersMatch(task.trigger, allow.trigger)) {
            console.error(
                `[verify-phase7b-allowlist-candidates] FAIL: manifest/allowlist trigger mismatch for ${task.sourceTaskId}`,
            );
            process.exit(1);
        }
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
    for (const sourceId of ALLOWLIST_SOURCE_IDS) {
        if (liveSourceIds.has(sourceId)) {
            console.error(
                `[verify-phase7b-allowlist-candidates] FAIL: CSV ${sourceId} already has mvpTaskId in manifest`,
            );
            process.exit(1);
        }
        const pending = existingTasks.find((t) => t.sourceTaskId === sourceId);
        if (pending && pending.slice === "7B-allowlist") {
            console.error(
                `[verify-phase7b-allowlist-candidates] FAIL: CSV ${sourceId} already pending in manifest`,
            );
            process.exit(1);
        }
    }

    const preserved = existingTasks.filter((t) => t.mvpTaskId !== undefined);
    const otherPending = existingTasks.filter(
        (t) =>
            t.mvpTaskId === undefined &&
            !ALLOWLIST_SOURCE_IDS.includes(t.sourceTaskId as (typeof ALLOWLIST_SOURCE_IDS)[number]),
    );

    const manifest = {
        description:
            "Phase 7B: NPC kill disambiguation (manifest overrides cache name lookup for validate + import).",
        tasks: [...preserved, ...otherPending, ...manifestTasks],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

    console.log(`\n[verify-phase7b-allowlist-candidates] Wrote ${manifestPath} (+${manifestTasks.length} allowlist)`);
    console.log(`[verify-phase7b-allowlist-candidates] Preserved ${preserved.length} imported manifest entries`);
    console.log(
        `[verify-phase7b-allowlist-candidates] PASS: ${manifestTasks.length} tasks for import (expected live ${LEAGUE_TASKS.length + manifestTasks.length})`,
    );
}

main();
