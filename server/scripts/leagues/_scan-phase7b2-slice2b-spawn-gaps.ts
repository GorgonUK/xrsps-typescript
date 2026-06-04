/**
 * Phase 7B-2 Slice 2B: spawn-gap report for remaining combat ambiguous NPC tasks.
 *
 * Usage: npx tsx server/scripts/leagues/_scan-phase7b2-slice2b-spawn-gaps.ts
 */
import fs from "fs";
import path from "path";

import { parseCsvFile } from "./lib/csv";
import { parseValidationReport } from "./lib/parseValidation";
import { categorizeTask } from "./lib/categorize";
import { buildRegistries } from "./lib/registries";
import { PHASE7B2_SLICE1_SOURCE_IDS } from "./lib/phase7b2Slice1Approved";
import { PHASE7B2_SLICE2A_SOURCE_IDS } from "./lib/phase7b2Slice2aApproved";

type Spawn = { id: number; x: number; y: number; level: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number; plane?: number };

const IMPORTED = new Set<number>([...PHASE7B2_SLICE1_SOURCE_IDS, ...PHASE7B2_SLICE2A_SOURCE_IDS]);
const BOSS_EXCLUDE = new Set([588, 608, 610]);
const RAID_EXCLUDE = new Set([621, 622, 623, 624, 626, 627, 629, 630, 631, 644]);

function parseNpcCandidates(content: string): number[] {
    const m = content.match(/npc candidates:\s*(.+)/i);
    if (!m) return [];
    return m[1]
        .split(";")
        .map((seg) => parseInt(seg.trim().match(/^(\d+):/)?.[1] ?? "", 10))
        .filter(Number.isFinite);
}

function inBounds(s: Spawn, b: Bounds): boolean {
    if (b.plane !== undefined && s.level !== b.plane) return false;
    return s.x >= b.minX && s.x <= b.maxX && s.y >= b.minY && s.y <= b.maxY;
}

function parentBoundsForTask(name: string, area: string): Bounds | null {
    const n = name.toLowerCase();
    if (n.includes("brimhaven dungeon")) return { minX: 2624, minY: 9344, maxX: 2751, maxY: 9599 };
    if (n.includes("taverley dungeon")) return { minX: 2880, minY: 9728, maxX: 2943, maxY: 9855 };
    if (n.includes("fremennik")) return { minX: 2688, minY: 9984, maxX: 2815, maxY: 10111 };
    if (n.includes("morytania") && !n.includes("cave horror")) return { minX: 3392, minY: 3520, maxX: 3455, maxY: 9949 };
    if (n.includes("wilderness")) return { minX: 2944, minY: 3520, maxX: 3391, maxY: 3966 };
    if (n.includes("varrock sewers")) return { minX: 3150, minY: 9850, maxX: 3300, maxY: 9920 };
    if (n.includes("edgeville dungeon")) return { minX: 3072, minY: 9856, maxX: 3135, maxY: 9919 };
    if (n.includes("desert")) return { minX: 3136, minY: 2688, maxX: 3391, maxY: 3135 };
    if (n.includes("kandarin")) return { minX: 2432, minY: 3136, maxX: 2815, maxY: 3519 };
    if (n.includes("asgarnia") || area === "Asgarnia") return { minX: 2880, minY: 3264, maxX: 3071, maxY: 3520 };
    if (n.includes("kourend")) return { minX: 1280, minY: 3456, maxX: 1791, maxY: 4031 };
    if (n.includes("tirannwn")) return { minX: 2112, minY: 3008, maxX: 2431, maxY: 3391 };
    if (n.includes("karamja")) return { minX: 2688, minY: 2688, maxX: 2943, maxY: 3200 };
    if (n.includes("varlamore")) return { minX: 1280, minY: 3072, maxX: 1791, maxY: 3455 };
    if (n.includes("lumbridge")) return { minX: 3200, minY: 3200, maxX: 3231, maxY: 3231 };
    if (n.includes("near lumbridge")) return { minX: 3200, minY: 3200, maxX: 3263, maxY: 3263 };
    return null;
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const spawns = JSON.parse(
        fs.readFileSync(path.join(repoRoot, "server/data/npc-spawns.json"), "utf8"),
    ) as Array<{ id: number; x: number; y: number; level?: number }>;
    const allSpawns: Spawn[] = spawns.map((s) => ({
        id: s.id,
        x: s.x,
        y: s.y,
        level: s.level ?? 0,
    }));

    const validationRows = parseValidationReport(
        path.join(repoRoot, "server/data/leagues/reports/validate-tasks-latest.csv"),
    );
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const reg = buildRegistries(repoRoot);

    type GapEntry = {
        sourceTaskId: number;
        name: string;
        candidateNpcIds: number[];
        parentBounds: string | null;
        spawnedInParent: Array<{ id: number; count: number; name: string }>;
        gapType: "zero_spawn" | "multi_spawn" | "no_parent_bounds";
    };

    const gaps: GapEntry[] = [];

    for (const row of validationRows) {
        if (row.status !== "ambiguous" || !row.matched_content.includes("npc candidates")) continue;
        const csv = csvById.get(row.task_id);
        if (!csv) continue;
        if (categorizeTask(csv) !== "combat") continue;
        if (IMPORTED.has(row.task_id)) continue;
        if (BOSS_EXCLUDE.has(row.task_id) || RAID_EXCLUDE.has(row.task_id)) continue;

        const candidateIds = parseNpcCandidates(row.matched_content);
        const parent = parentBoundsForTask(csv.name, csv.area);

        if (!parent) {
            gaps.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                candidateNpcIds: candidateIds,
                parentBounds: null,
                spawnedInParent: [],
                gapType: "no_parent_bounds",
            });
            continue;
        }

        const spawnedInParent: Array<{ id: number; count: number; name: string }> = [];
        for (const id of candidateIds) {
            const count = allSpawns.filter((s) => s.id === id && inBounds(s, parent)).length;
            if (count > 0) spawnedInParent.push({ id, count, name: reg.getNpcName(id) });
        }

        gaps.push({
            sourceTaskId: row.task_id,
            name: csv.name,
            candidateNpcIds: candidateIds,
            parentBounds: `${parent.minX}-${parent.maxX} x ${parent.minY}-${parent.maxY}`,
            spawnedInParent,
            gapType:
                spawnedInParent.length === 0
                    ? "zero_spawn"
                    : spawnedInParent.length > 1
                      ? "multi_spawn"
                      : "multi_spawn",
        });
    }

    const zeroSpawn = gaps.filter((g) => g.gapType === "zero_spawn");
    const multiSpawn = gaps.filter((g) => g.gapType === "multi_spawn");
    const noBounds = gaps.filter((g) => g.gapType === "no_parent_bounds");

    console.log(`[slice2b-spawn-gaps] Remaining combat ambiguous: ${gaps.length}`);
    console.log(`  zero_spawn: ${zeroSpawn.length}`);
    console.log(`  multi_spawn: ${multiSpawn.length}`);
    console.log(`  no_parent_bounds: ${noBounds.length}\n`);

    console.log("=== ZERO SPAWN (spawn proof gap) ===");
    for (const g of zeroSpawn.sort((a, b) => a.sourceTaskId - b.sourceTaskId)) {
        console.log(`  CSV ${g.sourceTaskId} | ${g.name} | bounds ${g.parentBounds}`);
    }

    console.log("\n=== MULTI SPAWN (sub-chamber unresolved) ===");
    for (const g of multiSpawn.sort((a, b) => a.sourceTaskId - b.sourceTaskId)) {
        const sp = g.spawnedInParent.map((s) => `${s.id}(${s.count})`).join(", ");
        console.log(`  CSV ${g.sourceTaskId} | ${g.name} | ${sp}`);
    }

    const outPath = path.join(repoRoot, "server/data/leagues/reports/phase7b2-slice2b-spawn-gaps.json");
    fs.writeFileSync(
        outPath,
        JSON.stringify({ zeroSpawn, multiSpawn, noBounds, generatedAt: new Date().toISOString() }, null, 2) + "\n",
        "utf8",
    );
    console.log(`\nWrote ${outPath}`);
}

main();
