/**
 * Phase 7B-2 Slice 2B follow-up: re-run sub-chamber scan with monster-route hints
 * on remaining combat ambiguous tasks.
 *
 * Usage: npx tsx server/scripts/leagues/_scan-phase7b2-slice2b-exhaustive.ts
 */
import fs from "fs";
import path from "path";

import { parseCsvFile } from "./lib/csv";
import { parseValidationReport } from "./lib/parseValidation";
import { categorizeTask } from "./lib/categorize";
import { PHASE7B2_SLICE1_SOURCE_IDS } from "./lib/phase7b2Slice1Approved";
import { PHASE7B2_SLICE2A_SOURCE_IDS } from "./lib/phase7b2Slice2aApproved";

type Spawn = { id: number; x: number; y: number; level: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number; plane?: number; note?: string };

const IMPORTED = new Set<number>([...PHASE7B2_SLICE1_SOURCE_IDS, ...PHASE7B2_SLICE2A_SOURCE_IDS]);
const BOSS_EXCLUDE = new Set([588, 608, 610]);
const RAID_EXCLUDE = new Set([621, 622, 623, 624, 626, 627, 629, 630, 631, 644]);

const SUBLOCS: Record<string, Bounds> = {
    "Waterbirth Island Dungeon": { minX: 2432, minY: 10112, maxX: 2559, maxY: 10239, note: "Waterbirth Island Dungeon" },
    "Taverley Dungeon": { minX: 2880, minY: 9728, maxX: 2943, maxY: 9855, note: "Taverley Dungeon" },
    "Karamja Volcano": { minX: 2832, minY: 9552, maxX: 2879, maxY: 9599, note: "Karamja Volcano dungeon" },
    "Rellekka Ice Trolls": { minX: 2688, minY: 3712, maxX: 2751, maxY: 3775, note: "Rellekka ice troll peninsula" },
    "Canifis": { minX: 3456, minY: 3456, maxX: 3519, maxY: 3519, note: "Canifis werewolf area" },
    "Shades Mortton": { minX: 3456, minY: 3264, maxX: 3519, maxY: 3327, note: "Shades of Mort'ton" },
    "Mos LeHarmless Cave": { minX: 3776, minY: 9376, maxX: 3839, maxY: 9471, note: "Mos LeHarmless cave horrors" },
    "Slayer Tower": { minX: 3392, minY: 3520, maxX: 3455, maxY: 9949, note: "Slayer Tower all floors" },
    "Iorwerth Dungeon": { minX: 3200, minY: 12160, maxX: 3327, maxY: 12287, note: "Iorwerth Dungeon" },
    "Lletya": { minX: 2312, minY: 3168, maxX: 2343, maxY: 3199, note: "Lletya mourners" },
    "Hosidius Coast": { minX: 1710, minY: 3460, maxX: 1780, maxY: 3520, note: "Hosidius sand crab coast" },
    "Catacombs of Kourend": { minX: 1600, minY: 9984, maxX: 1727, maxY: 10111, note: "Catacombs of Kourend" },
    "Ardougne Guard": { minX: 2656, minY: 3280, maxX: 2679, maxY: 3319, note: "East Ardougne guards" },
    "Yanille Poison Spider": { minX: 2576, minY: 3104, maxX: 2591, maxY: 3119, note: "Yanille poison spider dungeon" },
    "Pollnivneach Menaphites": { minX: 3344, minY: 2952, maxX: 3367, maxY: 2975, note: "Pollnivneach Menaphite thugs" },
    "Sophanem Scarabs": { minX: 3296, minY: 2784, maxX: 3327, maxY: 2815, note: "Sophanem scarab mages" },
    "Smoke Dungeon": { minX: 3200, minY: 9344, maxX: 3327, maxY: 9471, note: "Smoke Dungeon" },
    "Kalphite Lair": { minX: 3456, minY: 9472, maxX: 3519, maxY: 9535, note: "Kalphite Lair" },
    "Pollnivneach Slayer Dungeon": { minX: 3328, minY: 9408, maxX: 3391, maxY: 9535, note: "Pollnivneach Slayer Dungeon" },
    "Edgeville Goblins": { minX: 2944, minY: 3480, maxX: 2975, maxY: 3515, note: "Edgeville goblin cluster" },
    "Graveyard of Shadows": { minX: 3168, minY: 3664, maxX: 3199, maxY: 3695, note: "Graveyard zombies" },
    "Chaos Temple Wilderness": { minX: 2944, minY: 3824, maxX: 2967, maxY: 3847, note: "Chaos Temple greater demons" },
    "Varlamore Nagua": { minX: 1376, minY: 3264, maxX: 1471, maxY: 3359, note: "Varlamore nagua region" },
};

const MONSTER_REGION_HINTS: Array<{ pattern: RegExp; boundsKey: string }> = [
    { pattern: /cave horror in morytania/i, boundsKey: "Mos LeHarmless Cave" },
    { pattern: /werewolf in morytania/i, boundsKey: "Canifis" },
    { pattern: /shade in morytania/i, boundsKey: "Shades Mortton" },
    { pattern: /pyrefiend in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /jelly in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /basilisk in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /kurask in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /flesh crawler in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /vyrewatch sentinel in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /kalphite guardian in the desert/i, boundsKey: "Kalphite Lair" },
    { pattern: /smoke devil in the desert/i, boundsKey: "Smoke Dungeon" },
    { pattern: /locust rider in the desert/i, boundsKey: "Pollnivneach Slayer Dungeon" },
    { pattern: /skeleton in the desert/i, boundsKey: "Pollnivneach Slayer Dungeon" },
    { pattern: /zombie in the desert/i, boundsKey: "Pollnivneach Slayer Dungeon" },
    { pattern: /locust in the desert/i, boundsKey: "Pollnivneach Slayer Dungeon" },
    { pattern: /sand crab in kourend/i, boundsKey: "Hosidius Coast" },
    { pattern: /drake in kourend/i, boundsKey: "Catacombs of Kourend" },
    { pattern: /greater demon in kourend/i, boundsKey: "Catacombs of Kourend" },
    { pattern: /fire giant in kourend/i, boundsKey: "Catacombs of Kourend" },
    { pattern: /dagannoth in fremennik/i, boundsKey: "Waterbirth Island Dungeon" },
    { pattern: /ice troll in fremennik/i, boundsKey: "Rellekka Ice Trolls" },
    { pattern: /lesser demon in karamja volcano/i, boundsKey: "Karamja Volcano" },
    { pattern: /black dragon in taverley dungeon/i, boundsKey: "Taverley Dungeon" },
    { pattern: /hellhound in taverley dungeon/i, boundsKey: "Taverley Dungeon" },
    { pattern: /greater demon in taverley dungeon/i, boundsKey: "Taverley Dungeon" },
    { pattern: /goblin near lumbridge/i, boundsKey: "Edgeville Goblins" },
    { pattern: /guard in kandarin/i, boundsKey: "Ardougne Guard" },
    { pattern: /blue dragon in kandarin/i, boundsKey: "Taverley Dungeon" },
    { pattern: /black demon in kandarin/i, boundsKey: "Taverley Dungeon" },
    { pattern: /fire giant in kandarin/i, boundsKey: "Taverley Dungeon" },
    { pattern: /poison spider in kandarin/i, boundsKey: "Yanille Poison Spider" },
    { pattern: /menaphite thug in the desert/i, boundsKey: "Pollnivneach Menaphites" },
    { pattern: /scarab mage in the desert/i, boundsKey: "Sophanem Scarabs" },
    { pattern: /zombie in the wilderness/i, boundsKey: "Graveyard of Shadows" },
    { pattern: /black demon in the wilderness/i, boundsKey: "Chaos Temple Wilderness" },
    { pattern: /bandit in the wilderness/i, boundsKey: "Chaos Temple Wilderness" },
    { pattern: /moss giant in tirannwn/i, boundsKey: "Iorwerth Dungeon" },
    { pattern: /fire giant in tirannwn/i, boundsKey: "Iorwerth Dungeon" },
    { pattern: /greater demon in tirannwn/i, boundsKey: "Iorwerth Dungeon" },
    { pattern: /mourner in tirannwn/i, boundsKey: "Lletya" },
    { pattern: /kurask in tirannwn/i, boundsKey: "Iorwerth Dungeon" },
    { pattern: /frost nagua in varlamore/i, boundsKey: "Varlamore Nagua" },
    { pattern: /sulphur nagua in varlamore/i, boundsKey: "Varlamore Nagua" },
];

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

function resolveParent(csv: { name: string; area: string }): Bounds | null {
    for (const hint of MONSTER_REGION_HINTS) {
        if (hint.pattern.test(csv.name)) return SUBLOCS[hint.boundsKey] ?? null;
    }
    return null;
}

function countInBounds(spawns: Spawn[], ids: number[], b: Bounds): Map<number, number> {
    const counts = new Map<number, number>();
    for (const id of ids) {
        const c = spawns.filter((s) => s.id === id && inBounds(s, b)).length;
        if (c > 0) counts.set(id, c);
    }
    return counts;
}

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
                const [chosenId] = [...counts.keys()];
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
        chosenNpcId: number;
        candidateNpcIds: number[];
        boundsProof: string;
        spawnProof: string;
        parentNote: string;
    }> = [];

    for (const row of validationRows) {
        if (row.status !== "ambiguous" || !row.matched_content.includes("npc candidates")) continue;
        const csv = csvById.get(row.task_id);
        if (!csv || categorizeTask(csv) !== "combat") continue;
        if (IMPORTED.has(row.task_id)) continue;
        if (BOSS_EXCLUDE.has(row.task_id) || RAID_EXCLUDE.has(row.task_id)) continue;

        const candidateIds = parseNpcCandidates(row.matched_content);
        const parent = resolveParent(csv);
        if (!parent) continue;

        const relevantSpawns = allSpawns.filter((s) => candidateIds.includes(s.id) && inBounds(s, parent));
        if (relevantSpawns.length === 0) continue;

        // If exactly one candidate in parent, that's tier A without sub-chamber
        const parentCounts = countInBounds(allSpawns, candidateIds, parent);
        if (parentCounts.size === 1) {
            const [chosenId, count] = [...parentCounts.entries()][0];
            tierA.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                chosenNpcId: chosenId,
                candidateNpcIds: candidateIds,
                boundsProof: `${parent.minX}-${parent.maxX} x ${parent.minY}-${parent.maxY}`,
                spawnProof: `${count} spawns in parent`,
                parentNote: parent.note ?? "",
            });
            continue;
        }

        let best: ReturnType<typeof findUniqueBoundsAroundSeed> = null;
        for (const seed of relevantSpawns) {
            const found = findUniqueBoundsAroundSeed(allSpawns, candidateIds, seed, 24);
            if (!found) continue;
            const b = found.bounds;
            if (b.minX < parent.minX || b.minY < parent.minY || b.maxX > parent.maxX || b.maxY > parent.maxY) {
                continue;
            }
            if (
                !best ||
                b.maxX - b.minX + (b.maxY - b.minY) < best.bounds.maxX - best.bounds.minX + (best.bounds.maxY - best.bounds.minY)
            ) {
                best = found;
            }
        }

        if (best) {
            const planeStr = best.bounds.plane !== undefined ? ` plane=${best.bounds.plane}` : "";
            tierA.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                chosenNpcId: best.chosenId,
                candidateNpcIds: candidateIds,
                boundsProof: `${best.bounds.minX}-${best.bounds.maxX} x ${best.bounds.minY}-${best.bounds.maxY}${planeStr}`,
                spawnProof: best.spawnProof,
                parentNote: parent.note ?? "",
            });
        }
    }

    tierA.sort((a, b) => a.sourceTaskId - b.sourceTaskId);
    console.log(`[slice2b-exhaustive] Found ${tierA.length} additional resolutions:`);
    for (const t of tierA) {
        console.log(`  CSV ${t.sourceTaskId} | npcId ${t.chosenNpcId} | ${t.boundsProof} | ${t.name}`);
    }

    fs.writeFileSync(
        path.join(repoRoot, "server/data/leagues/reports/phase7b2-slice2b-exhaustive.json"),
        JSON.stringify(tierA, null, 2) + "\n",
        "utf8",
    );
}

main();
