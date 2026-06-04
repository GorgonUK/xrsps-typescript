/**
 * Exhaustive sub-chamber discovery: find tight bounds where exactly one candidate spawns.
 */
import fs from "fs";
import path from "path";

import { parseCsvFile } from "./lib/csv";
import { parseValidationReport } from "./lib/parseValidation";
import { categorizeTask } from "./lib/categorize";
import { PHASE7B2_SLICE1_SOURCE_IDS } from "./lib/phase7b2Slice1Approved";

type Spawn = { id: number; x: number; y: number; level: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number; plane?: number };

const IMPORTED = new Set<number>(PHASE7B2_SLICE1_SOURCE_IDS);
const BOSS_EXCLUDE = new Set([588, 608, 610]);
const RAID_EXCLUDE = new Set([621, 622, 623, 624, 626, 627, 629, 630, 631]);

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

function countInBounds(spawns: Spawn[], ids: number[], b: Bounds): Map<number, number> {
    const counts = new Map<number, number>();
    for (const id of ids) {
        const c = spawns.filter((s) => s.id === id && inBounds(s, b)).length;
        if (c > 0) counts.set(id, c);
    }
    return counts;
}

/** Expand bounds around a seed spawn until unique or max radius. */
function findUniqueBoundsAroundSeed(
    allSpawns: Spawn[],
    candidateIds: number[],
    seed: Spawn,
    maxRadius: number,
): { bounds: Bounds; chosenId: number; spawnProof: string } | null {
    for (let r = 2; r <= maxRadius; r += 2) {
        for (const plane of [seed.level, undefined] as Array<number | undefined>) {
            const b: Bounds = {
                minX: seed.x - r,
                minY: seed.y - r,
                maxX: seed.x + r,
                maxY: seed.y + r,
                ...(plane !== undefined ? { plane } : {}),
            };
            const counts = countInBounds(allSpawns, candidateIds, b);
            if (counts.size === 1) {
                const [chosenId, count] = [...counts.entries()][0];
                const pts = allSpawns.filter((s) => s.id === chosenId && inBounds(s, b));
                return {
                    bounds: b,
                    chosenId,
                    spawnProof: pts
                        .slice(0, 3)
                        .map((p) => `${p.x},${p.y},${p.level}`)
                        .join(" | "),
                };
            }
        }
    }
    return null;
}

/** Restrict search to dungeon-level parent bounds from task name hints. */
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

    const tierA: Array<{
        sourceTaskId: number;
        name: string;
        candidateNpcIds: number[];
        chosenNpcId: number;
        bounds: Bounds;
        boundsProof: string;
        spawnProof: string;
        confidence: "high";
    }> = [];

    for (const row of validationRows) {
        if (row.status !== "ambiguous" || !row.matched_content.includes("npc candidates")) continue;
        const csv = csvById.get(row.task_id)!;
        if (!csv) continue;
        const batch = categorizeTask(csv);
        if (batch !== "combat") continue;
        if (IMPORTED.has(row.task_id)) continue;
        if (BOSS_EXCLUDE.has(row.task_id) || RAID_EXCLUDE.has(row.task_id)) continue;

        const candidateIds = parseNpcCandidates(row.matched_content);
        const parent = parentBoundsForTask(csv.name, csv.area);
        if (!parent) continue;

        const relevantSpawns = allSpawns.filter(
            (s) =>
                candidateIds.includes(s.id) &&
                inBounds(s, parent) &&
                (parent.plane === undefined || s.level === parent.plane),
        );
        if (relevantSpawns.length === 0) continue;

        let best: ReturnType<typeof findUniqueBoundsAroundSeed> = null;
        for (const seed of relevantSpawns) {
            const found = findUniqueBoundsAroundSeed(allSpawns, candidateIds, seed, 24);
            if (!found) continue;
            // Require found bounds stay inside parent
            const b = found.bounds;
            if (
                b.minX < parent.minX ||
                b.minY < parent.minY ||
                b.maxX > parent.maxX ||
                b.maxY > parent.maxY
            ) {
                continue;
            }
            if (!best || b.maxX - b.minX + (b.maxY - b.minY) < best.bounds.maxX - best.bounds.minX + (best.bounds.maxY - best.bounds.minY)) {
                best = found;
            }
        }

        if (best) {
            const planeStr = best.bounds.plane !== undefined ? ` plane=${best.bounds.plane}` : "";
            tierA.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                candidateNpcIds: candidateIds,
                chosenNpcId: best.chosenId,
                bounds: best.bounds,
                boundsProof: `${best.bounds.minX}-${best.bounds.maxX} x ${best.bounds.minY}-${best.bounds.maxY}${planeStr}`,
                spawnProof: best.spawnProof,
                confidence: "high",
            });
        }
    }

    tierA.sort((a, b) => a.sourceTaskId - b.sourceTaskId);

    // Dedupe: if same task appears twice (shouldn't), keep smallest bounds
    const byId = new Map<number, (typeof tierA)[0]>();
    for (const t of tierA) {
        const existing = byId.get(t.sourceTaskId);
        if (!existing) byId.set(t.sourceTaskId, t);
    }
    const unique = [...byId.values()].sort((a, b) => a.sourceTaskId - b.sourceTaskId);

    console.log(`Discovered ${unique.length} unique sub-chamber resolutions:`);
    for (const t of unique) {
        console.log(`  ${t.sourceTaskId} | ${t.chosenNpcId} | ${t.boundsProof} | ${t.name}`);
    }

    fs.writeFileSync(
        path.join(repoRoot, "server/data/leagues/reports/phase7b2-slice2a-exhaustive.json"),
        JSON.stringify(unique, null, 2) + "\n",
        "utf8",
    );
}

main();
