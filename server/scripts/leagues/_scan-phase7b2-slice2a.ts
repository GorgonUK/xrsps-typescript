/**
 * Phase 7B-2 Slice 2A: sub-chamber / plane-specific NPC disambiguation scan.
 * Read-only unless --write flag passed.
 */
import fs from "fs";
import path from "path";

import { parseCsvFile } from "./lib/csv";
import { parseValidationReport } from "./lib/parseValidation";
import { categorizeTask } from "./lib/categorize";
import { PHASE7B2_SLICE1_SOURCE_IDS } from "./lib/phase7b2Slice1Approved";

type Bounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    plane?: number;
    label: string;
};

type Spawn = { id: number; x: number; y: number; level: number };

const BOSS_EXCLUDE = new Set([588, 608, 610]);
const RAID_EXCLUDE = new Set([621, 622, 623, 624, 626, 627, 629, 630, 631]);
const IMPORTED = new Set<number>(PHASE7B2_SLICE1_SOURCE_IDS);

/** Task-specific sub-chamber bounds (task-justified from spawn clustering). */
const TASK_BOUNDS: Record<number, Bounds> = {
    // Brimhaven — metal dragon chamber (red dragons only, plane 0)
    756: { minX: 2695, minY: 9495, maxX: 2728, maxY: 9555, plane: 0, label: "Brimhaven metal dragon chamber" },
    // Brimhaven — black demon room (west metal dragon area black demons)
    755: { minX: 2695, minY: 9475, maxX: 2715, maxY: 9495, plane: 0, label: "Brimhaven black demon room" },
    // Brimhaven — fire giant vine area plane 2 only (2078)
    753: { minX: 2624, minY: 9540, maxX: 2640, maxY: 9590, plane: 2, label: "Brimhaven fire giant plane 2 vine" },
    // Taverley — blue dragon room (265 only cluster)
    811: { minX: 2895, minY: 9770, maxX: 2925, maxY: 9810, plane: 0, label: "Taverley blue dragon room" },
    // Taverley — lesser demon room
    814: { minX: 2924, minY: 9790, maxX: 2940, maxY: 9815, plane: 0, label: "Taverley lesser demon room" },
    // Taverley — black dragon (if any spawn - probe)
    812: { minX: 2880, minY: 9728, maxX: 2943, maxY: 9855, plane: 0, label: "Taverley Dungeon full" },
    // Fremennik slayer — kurask room (410 only at 2694,9995)
    903: { minX: 2690, minY: 9990, maxX: 2705, maxY: 10005, plane: 0, label: "Fremennik kurask room" },
    // Fremennik slayer — turoth room east (429 dominant cluster)
    902: { minX: 2715, minY: 9990, maxX: 2730, maxY: 10015, plane: 0, label: "Fremennik turoth east room" },
    // Slayer Tower — bloodveld floor 1 only (484+485) - still multi, try floor 3 (486 only room?)
    1116: { minX: 3400, minY: 9930, maxX: 3425, maxY: 9950, plane: 3, label: "Slayer Tower bloodveld floor 3" },
    // Slayer Tower — gargoyle floor 2 (412 only)
    1118: { minX: 3425, minY: 3535, maxX: 3440, maxY: 3555, plane: 2, label: "Slayer Tower gargoyle floor 2" },
    // Slayer Tower — aberrant spectre floor 1 west room
    1117: { minX: 3405, minY: 3530, maxX: 3425, maxY: 3555, plane: 1, label: "Slayer Tower spectre floor 1 west" },
    // Black Knights Fortress — 4331 only spawn at 3016,3516
    809: { minX: 3014, minY: 3514, maxX: 3018, maxY: 3518, plane: 0, label: "Black Knights Fortress elite spawn" },
    // Wilderness — green dragon west lair (260 cluster)
    1268: { minX: 3330, minY: 3670, maxX: 3355, maxY: 3710, plane: 0, label: "Wilderness green dragon west" },
    // Wilderness — greater demon chaos temple (2026-2029 each 1 spawn - multi still)
    1269: { minX: 3280, minY: 3870, maxX: 3310, maxY: 3898, plane: 0, label: "Wilderness greater demon ruins" },
    // Wilderness — ice giant plateau west
    1272: { minX: 2944, minY: 3880, maxX: 2960, maxY: 3920, plane: 0, label: "Wilderness ice giant west plateau" },
    // Wilderness — dark warrior fortress (531 vs 6606 - multi)
    1282: { minX: 3016, minY: 3624, maxX: 3035, maxY: 3645, plane: 0, label: "Dark Warriors Fortress" },
    // Wilderness — skeleton forgotten cemetery - multi
    1266: { minX: 3000, minY: 3584, maxX: 3035, maxY: 3615, plane: 0, label: "Forgotten Cemetery" },
    // Desert bandit camp - multi all variants
    1047: { minX: 3152, minY: 2976, maxX: 3175, maxY: 2995, plane: 0, label: "Desert Bandit Camp" },
    // Desert lizard second cluster (460 only at 3386,3065)
    1046: { minX: 3384, minY: 3060, maxX: 3390, maxY: 3070, plane: 0, label: "Desert lizard east cluster" },
    // Moss giant varrock sewers - try tight room
    663: { minX: 3154, minY: 9895, maxX: 3168, maxY: 9910, plane: 0, label: "Varrock Sewers moss giant room" },
    // Kurask slayer tower vs morytania - 411 only at 2694,9999 in fremennik (903)
    // Pyrefiend slayer tower
    1125: { minX: 3392, minY: 3520, maxX: 3455, maxY: 3583, plane: 1, label: "Slayer Tower floor 1" },
    // Jelly slayer tower floor 1
    1126: { minX: 3392, minY: 3520, maxX: 3455, maxY: 3583, plane: 1, label: "Slayer Tower floor 1" },
    // Asgarnia black knight (809 already)
    // Kandarin poison spider yanille
    982: { minX: 2576, minY: 3104, maxX: 2591, maxY: 3119, plane: 0, label: "Yanille poison spider dungeon" },
    // Kandarin ogre - already 977 imported; 977 was gnome village
    // Lizardman canyon - multi
    1361: { minX: 1472, minY: 3712, maxX: 1535, maxY: 3775, plane: 0, label: "Lizardman Canyon" },
};

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

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const spawns = JSON.parse(
        fs.readFileSync(path.join(repoRoot, "server/data/npc-spawns.json"), "utf8"),
    ) as Array<{ id: number; x: number; y: number; level?: number }>;
    const spawnList: Spawn[] = spawns.map((s) => ({
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
        spawnProof: string;
        confidence: "high" | "medium-high";
    }> = [];
    const failed: Array<{ sourceTaskId: number; name: string; reason: string; detail?: unknown }> = [];

    for (const row of validationRows) {
        if (row.status !== "ambiguous" || !row.matched_content.includes("npc candidates")) continue;
        const csv = csvById.get(row.task_id);
        if (!csv) continue;
        const batch = categorizeTask(csv);
        if (batch !== "combat" && batch !== "bosses") continue;
        if (IMPORTED.has(row.task_id)) continue;
        if (BOSS_EXCLUDE.has(row.task_id) || RAID_EXCLUDE.has(row.task_id)) continue;

        const candidateIds = parseNpcCandidates(row.matched_content);
        const bounds = TASK_BOUNDS[row.task_id];
        if (!bounds) {
            failed.push({ sourceTaskId: row.task_id, name: csv.name, reason: "no slice2a bounds defined" });
            continue;
        }

        const spawnedIn: Array<{ id: number; count: number; sample: string }> = [];
        for (const id of candidateIds) {
            const pts = spawnList.filter((s) => s.id === id && inBounds(s, bounds));
            if (pts.length > 0) {
                spawnedIn.push({
                    id,
                    count: pts.length,
                    sample: pts
                        .slice(0, 3)
                        .map((p) => `${p.x},${p.y},${p.level}`)
                        .join(" | "),
                });
            }
        }

        if (spawnedIn.length === 0) {
            failed.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                reason: "zero-spawn in sub-chamber",
                detail: { bounds: bounds.label, candidateIds },
            });
            continue;
        }
        if (spawnedIn.length > 1) {
            failed.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                reason: "multi-spawn in sub-chamber",
                detail: { bounds: bounds.label, spawnedIn },
            });
            continue;
        }

        tierA.push({
            sourceTaskId: row.task_id,
            name: csv.name,
            candidateNpcIds: candidateIds,
            chosenNpcId: spawnedIn[0].id,
            bounds,
            spawnProof: spawnedIn[0].sample,
            confidence: bounds.plane !== undefined ? "high" : "medium-high",
        });
    }

    tierA.sort((a, b) => a.sourceTaskId - b.sourceTaskId);

    const outPath = path.join(repoRoot, "server/data/leagues/reports/phase7b2-slice2a-scan.json");
    fs.writeFileSync(
        outPath,
        JSON.stringify({ tierA, failed, generatedAt: new Date().toISOString() }, null, 2) + "\n",
        "utf8",
    );

    console.log(`Tier A: ${tierA.length}`);
    for (const t of tierA) {
        console.log(`  ${t.sourceTaskId} | ${t.chosenNpcId} | ${t.bounds.label} | ${t.name}`);
    }
    console.log(`Failed/not mapped: ${failed.length}`);
    console.log(`Wrote ${outPath}`);
}

main();
