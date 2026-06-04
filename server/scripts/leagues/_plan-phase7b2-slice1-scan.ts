/**
 * Phase 7B-2 comprehensive regional scan with monster→dungeon routing.
 * Read-only planning artifact.
 */
import fs from "fs";
import path from "path";

import { parseCsvFile } from "./lib/csv";
import { parseValidationReport } from "./lib/parseValidation";
import { categorizeTask } from "./lib/categorize";

type Bounds = { minX: number; minY: number; maxX: number; maxY: number; note: string };

const LEAGUE_AREAS: Record<string, Bounds> = {
    Misthalin: { minX: 3136, minY: 3200, maxX: 3327, maxY: 3520, note: "league surface Misthalin" },
    Karamja: { minX: 2688, minY: 2688, maxX: 2943, maxY: 3200, note: "league surface Karamja" },
    Asgarnia: { minX: 2880, minY: 3264, maxX: 3071, maxY: 3520, note: "league surface Asgarnia" },
    Kandarin: { minX: 2432, minY: 3136, maxX: 2815, maxY: 3519, note: "league surface Kandarin" },
    Fremennik: { minX: 2304, minY: 3584, maxX: 2815, maxY: 3967, note: "league surface Fremennik" },
    Desert: { minX: 3136, minY: 2688, maxX: 3391, maxY: 3135, note: "league surface Desert" },
    Morytania: { minX: 3392, minY: 3200, maxX: 3711, maxY: 3519, note: "league surface Morytania" },
    Tirannwn: { minX: 2112, minY: 3008, maxX: 2431, maxY: 3391, note: "league surface Tirannwn" },
    Wilderness: { minX: 2944, minY: 3520, maxX: 3391, maxY: 3966, note: "wilderness multi-combat rect" },
    Kourend: { minX: 1280, minY: 3456, maxX: 1791, maxY: 4031, note: "league surface Kourend" },
    Varlamore: { minX: 2048, minY: 3264, maxX: 2431, maxY: 3519, note: "league surface Varlamore" },
};

const SUBLOCS: Record<string, Bounds> = {
    "Edgeville Dungeon": { minX: 3072, minY: 9856, maxX: 3135, maxY: 9919, note: "Edgeville Dungeon" },
    "Varrock Sewers": { minX: 3150, minY: 9850, maxX: 3300, maxY: 9920, note: "Varrock Sewers" },
    "Brimhaven Dungeon": { minX: 2624, minY: 9344, maxX: 2751, maxY: 9599, note: "Brimhaven Dungeon" },
    "Fremennik Slayer Dungeon": { minX: 2688, minY: 9984, maxX: 2815, maxY: 10111, note: "Fremennik Slayer Dungeon" },
    "Waterbirth Island Dungeon": { minX: 2432, minY: 10112, maxX: 2559, maxY: 10239, note: "Waterbirth Island Dungeon" },
    "Taverley Dungeon": { minX: 2880, minY: 9728, maxX: 2943, maxY: 9855, note: "Taverley Dungeon" },
    "Slayer Tower": { minX: 3392, minY: 3520, maxX: 3455, maxY: 9949, note: "Slayer Tower all floors" },
    "Catacombs of Kourend": { minX: 1600, minY: 9984, maxX: 1727, maxY: 10111, note: "Catacombs of Kourend" },
    "Kalphite Lair": { minX: 3456, minY: 9472, maxX: 3519, maxY: 9535, note: "Kalphite Lair" },
    "Smoke Dungeon": { minX: 3200, minY: 9344, maxX: 3327, maxY: 9471, note: "Smoke Dungeon" },
    "Pollnivneach Slayer Dungeon": { minX: 3328, minY: 9408, maxX: 3391, maxY: 9535, note: "Pollnivneach Slayer Dungeon" },
    "Sophanem Slayer Dungeon": { minX: 3264, minY: 9280, maxX: 3327, maxY: 9343, note: "Sophanem Slayer Dungeon" },
    "Lumbridge": { minX: 3200, minY: 3200, maxX: 3230, maxY: 3230, note: "Lumbridge goblin cluster" },
    "Hosidius Coast": { minX: 1710, minY: 3460, maxX: 1780, maxY: 3520, note: "Hosidius sand crab coast" },
    "Lizardman Canyon": { minX: 1472, minY: 3712, maxX: 1535, maxY: 3775, note: "Lizardman Canyon" },
    "Rellekka Ice Trolls": { minX: 2688, minY: 3712, maxX: 2751, maxY: 3775, note: "Rellekka ice troll peninsula" },
    "Canifis": { minX: 3456, minY: 3456, maxX: 3519, maxY: 3519, note: "Canifis werewolf area" },
    "Mort Myre": { minX: 3392, minY: 3392, maxX: 3519, maxY: 3519, note: "Mort Myre Swamp shades" },
    "Shades Mortton": { minX: 3456, minY: 3264, maxX: 3519, maxY: 3327, note: "Shades of Mort'ton" },
    "Mos LeHarmless Cave": { minX: 3776, minY: 9376, maxX: 3839, maxY: 9471, note: "Mos LeHarmless cave horrors" },
    "Ardougne Zoo": { minX: 2600, minY: 3264, maxX: 2639, maxY: 3295, note: "Ardougne Zoo terrorbirds" },
    "Yanille Poison Spider": { minX: 2576, minY: 3104, maxX: 2591, maxY: 3119, note: "Yanille poison spider dungeon entrance" },
    "Yanille Ogre": { minX: 2552, minY: 3184, maxX: 2567, maxY: 3199, note: "Yanille ogre enclosure" },
    "Tree Gnome Stronghold": { minX: 2432, minY: 3424, maxX: 2495, maxY: 3487, note: "Gnome Stronghold wolves" },
    "Bandit Camp Desert": { minX: 3152, minY: 2976, maxX: 3175, maxY: 2995, note: "Desert Bandit Camp" },
    "Pollnivneach Menaphites": { minX: 3344, minY: 2952, maxX: 3367, maxY: 2975, note: "Pollnivneach Menaphite thugs" },
    "Sophanem Scarabs": { minX: 3296, minY: 2784, maxX: 3327, maxY: 2815, note: "Sophanem scarab mages" },
    "Nardah Crocodiles": { minX: 3264, minY: 2880, maxX: 3280, maxY: 2900, note: "Nardah crocodiles" },
    "Desert Lizards": { minX: 3380, minY: 3010, maxX: 3395, maxY: 3070, note: "Desert lizard cluster" },
    "Dark Warriors Fortress": { minX: 3016, minY: 3624, maxX: 3035, maxY: 3645, note: "Dark Warriors Fortress" },
    "Edgeville Goblins": { minX: 2944, minY: 3480, maxX: 2975, maxY: 3515, note: "Edgeville goblin cluster" },
    "Chaos Temple Wilderness": { minX: 2944, minY: 3824, maxX: 2967, maxY: 3847, note: "Chaos Temple greater demons" },
    "Lava Maze": { minX: 3192, minY: 3800, maxX: 3223, maxY: 3839, note: "Lava Maze Runite/Lava dragons" },
    "Forgotten Cemetery": { minX: 3000, minY: 3584, maxX: 3035, maxY: 3615, note: "Forgotten Cemetery skeletons" },
    "Graveyard of Shadows": { minX: 3168, minY: 3664, maxX: 3199, maxY: 3695, note: "Graveyard zombies" },
    "Green Dragon Wilderness": { minX: 3330, minY: 3670, maxX: 3355, maxY: 3710, note: "Wilderness green dragons west" },
    "Ice Plateau": { minX: 2944, minY: 3880, maxX: 2983, maxY: 3955, note: "Ice Plateau giants/warriors" },
    "Black Knights Fortress": { minX: 3016, minY: 3504, maxX: 3035, maxY: 3523, note: "Black Knights Fortress" },
    "Ardougne Guard": { minX: 2656, minY: 3280, maxX: 2679, maxY: 3319, note: "East Ardougne guards" },
    "Tree Gnome Village": { minX: 2528, minY: 3168, maxX: 2559, maxY: 3199, note: "Tree Gnome Village ogres" },
    "Iorwerth Dungeon": { minX: 3200, minY: 12160, maxX: 3327, maxY: 12287, note: "Iorwerth Dungeon" },
    "Lletya": { minX: 2312, minY: 3168, maxX: 2343, maxY: 3199, note: "Lletya mourners/rabbits" },
};

/** Route regional slayer/combat tasks to the tightest known spawn cluster. */
const MONSTER_REGION_HINTS: Array<{ pattern: RegExp; boundsKey: string }> = [
    { pattern: /bloodveld in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /aberrant spectre in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /gargoyle in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /abyssal demon in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /cave horror in morytania/i, boundsKey: "Mos LeHarmless Cave" },
    { pattern: /werewolf in morytania/i, boundsKey: "Canifis" },
    { pattern: /shade in morytania/i, boundsKey: "Shades Mortton" },
    { pattern: /pyrefiend in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /jelly in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /basilisk in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /kurask in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /flesh crawler in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /giant bat in morytania/i, boundsKey: "Slayer Tower" },
    { pattern: /kalphite worker in the desert/i, boundsKey: "Kalphite Lair" },
    { pattern: /kalphite soldier in the desert/i, boundsKey: "Kalphite Lair" },
    { pattern: /kalphite guardian in the desert/i, boundsKey: "Kalphite Lair" },
    { pattern: /dust devil in the desert/i, boundsKey: "Smoke Dungeon" },
    { pattern: /smoke devil in the desert/i, boundsKey: "Smoke Dungeon" },
    { pattern: /dust devil in kourend/i, boundsKey: "Catacombs of Kourend" },
    { pattern: /sand crab in kourend/i, boundsKey: "Hosidius Coast" },
    { pattern: /lizardman in kourend/i, boundsKey: "Lizardman Canyon" },
    { pattern: /drake in kourend/i, boundsKey: "Catacombs of Kourend" },
    { pattern: /dagannoth in fremennik/i, boundsKey: "Waterbirth Island Dungeon" },
    { pattern: /ice troll in fremennik/i, boundsKey: "Rellekka Ice Trolls" },
    { pattern: /basilisk in fremennik/i, boundsKey: "Fremennik Slayer Dungeon" },
    { pattern: /turoth in fremennik/i, boundsKey: "Fremennik Slayer Dungeon" },
    { pattern: /kurask in fremennik/i, boundsKey: "Fremennik Slayer Dungeon" },
    { pattern: /monkey on karamja/i, boundsKey: "Karamja" },
    { pattern: /goblin near lumbridge/i, boundsKey: "Edgeville Goblins" },
    { pattern: /skeleton in varrock sewers/i, boundsKey: "Varrock Sewers" },
    { pattern: /moss giant in varrock sewers/i, boundsKey: "Varrock Sewers" },
    { pattern: /guard in kandarin/i, boundsKey: "Ardougne Guard" },
    { pattern: /terrorbird in kandarin/i, boundsKey: "Ardougne Zoo" },
    { pattern: /ogre in kandarin/i, boundsKey: "Tree Gnome Village" },
    { pattern: /poison spider in kandarin/i, boundsKey: "Yanille Poison Spider" },
    { pattern: /wolf in kandarin/i, boundsKey: "Tree Gnome Stronghold" },
    { pattern: /desert lizard in the desert/i, boundsKey: "Desert Lizards" },
    { pattern: /bandit in the desert/i, boundsKey: "Bandit Camp Desert" },
    { pattern: /menaphite thug in the desert/i, boundsKey: "Pollnivneach Menaphites" },
    { pattern: /scarab mage in the desert/i, boundsKey: "Sophanem Scarabs" },
    { pattern: /crocodile in the desert/i, boundsKey: "Nardah Crocodiles" },
    { pattern: /dark warrior in the wilderness/i, boundsKey: "Dark Warriors Fortress" },
    { pattern: /skeleton in the wilderness/i, boundsKey: "Forgotten Cemetery" },
    { pattern: /zombie in the wilderness/i, boundsKey: "Graveyard of Shadows" },
    { pattern: /green dragon in the wilderness/i, boundsKey: "Green Dragon Wilderness" },
    { pattern: /ice giant in the wilderness/i, boundsKey: "Ice Plateau" },
    { pattern: /greater demon in the wilderness/i, boundsKey: "Chaos Temple Wilderness" },
    { pattern: /lava dragon in the wilderness/i, boundsKey: "Lava Maze" },
    { pattern: /black knight/i, boundsKey: "Black Knights Fortress" },
    { pattern: /rabbit in tirannwn/i, boundsKey: "Lletya" },
    { pattern: /mourner in tirannwn/i, boundsKey: "Lletya" },
    { pattern: /kurask in tirannwn/i, boundsKey: "Iorwerth Dungeon" },
];

const BOSS_INSTANCE_EXCLUDE = new Set([588, 608, 610]);
const RAID_BLOCK = new Set([621, 622, 623, 624, 626, 627, 629, 630, 631]);

function parseNpcCandidates(content: string): number[] {
    const m = content.match(/npc candidates:\s*(.+)/i);
    if (!m) return [];
    return m[1]
        .split(";")
        .map((seg) => parseInt(seg.trim().match(/^(\d+):/)?.[1] ?? "", 10))
        .filter((n) => Number.isFinite(n));
}

function inBounds(x: number, y: number, b: Bounds): boolean {
    return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

function resolveRegion(csv: { name: string; area: string }): { key: string; bounds: Bounds; kind: string } | null {
    for (const hint of MONSTER_REGION_HINTS) {
        if (hint.pattern.test(csv.name)) {
            const b = SUBLOCS[hint.boundsKey] ?? LEAGUE_AREAS[hint.boundsKey];
            if (b) return { key: hint.boundsKey, bounds: b, kind: "monster-route" };
        }
    }
    for (const [key, bounds] of Object.entries(SUBLOCS)) {
        if (csv.name.includes(key)) return { key, bounds, kind: "subloc-name" };
    }
    const m = csv.name.match(/\s(?:in|near|on)\s+(?:the\s+)?([^.,]+)/i);
    if (m) {
        const hint = m[1].trim();
        for (const [key, bounds] of Object.entries(SUBLOCS)) {
            if (hint.includes(key) || key.includes(hint)) return { key, bounds, kind: "subloc-hint" };
        }
        if (LEAGUE_AREAS[hint]) return { key: hint, bounds: LEAGUE_AREAS[hint], kind: "league-hint" };
        if (hint === "Desert" && LEAGUE_AREAS.Desert) return { key: "Desert", bounds: LEAGUE_AREAS.Desert, kind: "league-hint" };
        if (hint === "Wilderness" && LEAGUE_AREAS.Wilderness)
            return { key: "Wilderness", bounds: LEAGUE_AREAS.Wilderness, kind: "league-hint" };
    }
    const area = csv.area?.trim();
    if (area && LEAGUE_AREAS[area]) return { key: area, bounds: LEAGUE_AREAS[area], kind: "csv-area" };
    return null;
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const validationRows = parseValidationReport(
        path.join(repoRoot, "server/data/leagues/reports/validate-tasks-latest.csv"),
    );
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const phase7b = JSON.parse(
        fs.readFileSync(path.join(repoRoot, "server/data/leagues/phase7b-npc-disambiguation.json"), "utf8"),
    ) as { tasks?: Array<{ sourceTaskId: number; mvpTaskId?: number }> };
    const imported = new Set(
        (phase7b.tasks ?? []).filter((t) => t.mvpTaskId !== undefined).map((t) => t.sourceTaskId),
    );

    const spawns = JSON.parse(
        fs.readFileSync(path.join(repoRoot, "server/data/npc-spawns.json"), "utf8"),
    ) as Array<{ id: number; x: number; y: number; level?: number }>;
    const spawnsByNpc = new Map<number, Array<{ x: number; y: number; level: number }>>();
    for (const s of spawns) {
        const arr = spawnsByNpc.get(s.id) ?? [];
        arr.push({ x: s.x, y: s.y, level: s.level ?? 0 });
        spawnsByNpc.set(s.id, arr);
    }

    type TierA = {
        sourceTaskId: number;
        name: string;
        region: string;
        regionProof: string;
        regionKind: string;
        candidateNpcIds: number[];
        chosenNpcId: number;
        spawnCount: number;
        spawnProof: string;
        confidence: "high" | "medium-high" | "medium";
    };
    type Deferred = { sourceTaskId: number; name: string; reason: string; detail?: unknown };

    const tierA: TierA[] = [];
    const deferred: Deferred[] = [];

    for (const row of validationRows) {
        if (row.status !== "ambiguous" || !row.matched_content.includes("npc candidates")) continue;
        const csv = csvById.get(row.task_id);
        if (!csv) continue;
        const batch = categorizeTask(csv);
        if (batch !== "combat" && batch !== "bosses") continue;
        if (imported.has(row.task_id)) continue;
        if (BOSS_INSTANCE_EXCLUDE.has(row.task_id)) {
            deferred.push({ sourceTaskId: row.task_id, name: csv.name, reason: "boss instance excluded" });
            continue;
        }
        if (RAID_BLOCK.has(row.task_id)) {
            deferred.push({ sourceTaskId: row.task_id, name: csv.name, reason: "raid boss excluded" });
            continue;
        }

        const candidateIds = parseNpcCandidates(row.matched_content);
        const region = resolveRegion(csv);
        if (!region) {
            deferred.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                reason: "no region resolved",
                detail: { area: csv.area },
            });
            continue;
        }

        const spawnedIn: Array<{ id: number; count: number; sample: string }> = [];
        for (const id of candidateIds) {
            const pts = (spawnsByNpc.get(id) ?? []).filter((p) => inBounds(p.x, p.y, region.bounds));
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
            deferred.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                reason: "zero-spawn in region",
                detail: { region: region.key, candidateIds },
            });
            continue;
        }
        if (spawnedIn.length > 1) {
            deferred.push({
                sourceTaskId: row.task_id,
                name: csv.name,
                reason: "multi-spawn ambiguity",
                detail: { region: region.key, candidateIds, spawnedIn },
            });
            continue;
        }

        const chosen = spawnedIn[0];
        const confidence: TierA["confidence"] =
            region.kind === "monster-route" || region.kind.startsWith("subloc")
                ? "high"
                : region.kind === "league-hint"
                  ? "medium-high"
                  : "medium";

        tierA.push({
            sourceTaskId: row.task_id,
            name: csv.name,
            region: region.key,
            regionProof: region.bounds.note,
            regionKind: region.kind,
            candidateNpcIds: candidateIds,
            chosenNpcId: chosen.id,
            spawnCount: chosen.count,
            spawnProof: chosen.sample,
            confidence,
        });
    }

    tierA.sort((a, b) => a.sourceTaskId - b.sourceTaskId);

    const outPath = path.join(repoRoot, "server/data/leagues/reports/phase7b2-slice1-decision-scan.json");
    fs.writeFileSync(
        outPath,
        JSON.stringify({ tierA, deferred, generatedAt: new Date().toISOString() }, null, 2) + "\n",
        "utf8",
    );

    console.log(`Tier A: ${tierA.length}`);
    for (const t of tierA) {
        console.log(`  ${t.sourceTaskId} | ${t.chosenNpcId} | ${t.confidence} | ${t.name}`);
    }
    console.log(`Deferred: ${deferred.length}`);
}

main();
