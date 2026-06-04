/**
 * Phase 7A-2 Slice 4a: append 73 registry-only Tier B collection tasks.
 *
 * Usage: npx tsx server/scripts/leagues/import-phase7a-slice4a-tasks.ts
 */
import fs from "fs";
import path from "path";

import { ENUM_IDS } from "../../../src/shared/leagues/custom/CustomContentTypes";
import type { LeagueTaskRow } from "../../../src/shared/leagues/leagueTypes";
import type { TaskTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";

import { parseCsvFile } from "./lib/csv";
import { resetPhase7aCollectionTriggerCache } from "./lib/phase7aCollectionTriggers";

const SLICE4A_SOURCE_IDS = [
    1558, 1561, 1565, 1566, 1567, 1568, 1571, 1613, 1622, 1625, 1626, 1630, 1636, 1637, 1638, 1648,
    1652, 1653, 1654, 1655, 1656, 1657, 1658, 1659, 1660, 1661, 1662, 1663, 1664, 1665, 1666, 1667,
    1668, 1669, 1670, 1671, 1672, 1673, 1674, 1675, 1676, 1677, 1678, 1679, 1680, 1682, 1687, 1688,
    1689, 1692, 1693, 1694, 1695, 1696, 1701, 1702, 1703, 1704, 1705, 1706, 1707, 1708, 1710, 1711,
    1713, 1714, 1715, 1716, 1717, 1730, 1732, 1733, 1735,
] as const;

const DIFFICULTY_TO_TIER: Record<string, number> = {
    Easy: 1,
    Medium: 2,
    Hard: 3,
    Elite: 4,
    Master: 5,
};

const STRUCT_ID_BASE = 90_000;

type Phase7aFile = {
    description: string;
    tasks: Array<{
        sourceTaskId: number;
        tier?: string;
        chosenItemId?: number;
        mvpTaskId?: number;
        trigger: TaskTrigger;
    }>;
};

function formatLeagueTasksTs(rows: LeagueTaskRow[]): string {
    const lines = rows.map((row) => `  ${JSON.stringify(row)}`);
    return (
        `import type { LeagueTaskRow } from "./leagueTypes";\n\n` +
        `// Live league tasks (${rows.length}: MVP + phases through 7A-2 Slice 4a). Source: tasks.csv + validation.\n` +
        `// Full OSRS cache export backed up under server/data/leagues/archive/\n` +
        `export const LEAGUE_TASKS: LeagueTaskRow[] = [\n${lines.join(",\n")}\n];\n`
    );
}

function formatTriggersTs(triggers: Record<number, TaskTrigger>): string {
    return (
        `import type { TaskTrigger } from "../../../server/src/game/leagues/triggers/TriggerTypes";\n\n` +
        `/** Live task triggers keyed by taskId (0..n-1). Generated — do not edit. */\n` +
        `export const LEAGUE_TASK_TRIGGER_BY_ID: Record<number, TaskTrigger> = ${JSON.stringify(triggers, null, 2)};\n`
    );
}

function formatEnumOverrideTs(structIds: number[]): string {
    return (
        `import { ENUM_IDS } from "./custom/CustomContentTypes";\n\n` +
        `/** Full enum ${ENUM_IDS.L5_TASKS} replacement for live task list. Generated — do not edit. */\n` +
        `const MVP_TASK_ENUM_STRUCT_IDS: number[] = ${JSON.stringify(structIds)};\n\n` +
        `export function getMvpLeagueTaskEnumCountOverride(enumId: number): number | undefined {\n` +
        `    if ((enumId | 0) !== ENUM_IDS.L5_TASKS) return undefined;\n` +
        `    return MVP_TASK_ENUM_STRUCT_IDS.length;\n` +
        `}\n\n` +
        `export function getMvpLeagueTaskEnumValueOverride(enumId: number, key: number): number | undefined {\n` +
        `    if ((enumId | 0) !== ENUM_IDS.L5_TASKS) return undefined;\n` +
        `    const idx = key | 0;\n` +
        `    if (idx < 0 || idx >= MVP_TASK_ENUM_STRUCT_IDS.length) return -1;\n` +
        `    return MVP_TASK_ENUM_STRUCT_IDS[idx] | 0;\n` +
        `}\n`
    );
}

function collectLiveSourceIds(csvByName: Map<string, number>): Set<number> {
    const liveSourceIds = new Set<number>();
    for (const task of LEAGUE_TASKS) {
        const csvId = csvByName.get(task.name.trim());
        if (csvId !== undefined) liveSourceIds.add(csvId);
    }
    return liveSourceIds;
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const csvByName = new Map(csvRows.map((r) => [r.name.trim(), r.id] as const));
    const manifestPath = path.join(repoRoot, "server/data/leagues/phase7a-collection-disambiguation.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Phase7aFile;

    const slice = manifest.tasks.filter(
        (t) => t.tier === "B-4a" && SLICE4A_SOURCE_IDS.includes(t.sourceTaskId as (typeof SLICE4A_SOURCE_IDS)[number]),
    );
    if (slice.length !== SLICE4A_SOURCE_IDS.length) {
        console.error(
            `[phase7a-slice4a] Run verify-phase7a2-slice4a-candidates.ts first (have ${slice.length}, need ${SLICE4A_SOURCE_IDS.length})`,
        );
        process.exit(1);
    }

    const liveSourceIds = collectLiveSourceIds(csvByName);
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));
    for (const sourceId of SLICE4A_SOURCE_IDS) {
        if (liveSourceIds.has(sourceId)) {
            console.error(`[phase7a-slice4a] sourceTaskId ${sourceId} already live`);
            process.exit(1);
        }
        const csv = csvById.get(sourceId);
        if (!csv) {
            console.error(`[phase7a-slice4a] Missing CSV row ${sourceId}`);
            process.exit(1);
        }
        if (liveNames.has(csv.name.trim())) {
            console.error(`[phase7a-slice4a] live name collision: "${csv.name.trim()}" (CSV ${sourceId})`);
            process.exit(1);
        }
        const entry = manifest.tasks.find((t) => t.sourceTaskId === sourceId);
        const trig = entry?.trigger;
        if (!trig || trig.type !== "item_equip" || trig.itemIds.length !== 1) {
            console.error(`[phase7a-slice4a] Invalid single item_equip trigger for ${sourceId}`);
            process.exit(1);
        }
    }

    console.log(`[phase7a-slice4a] Pre-import sanity: ${SLICE4A_SOURCE_IDS.length} tasks, 0 live duplicates`);

    const existingTriggers = { ...LEAGUE_TASK_TRIGGER_BY_ID };
    const rows: LeagueTaskRow[] = [...LEAGUE_TASKS];
    const assignedTaskIds = new Set(rows.map((r) => r.taskId));
    let nextId = rows.length;
    const importedSourceIds: number[] = [];

    for (const sourceId of SLICE4A_SOURCE_IDS) {
        const entry = manifest.tasks.find((t) => t.sourceTaskId === sourceId)!;
        if (entry.mvpTaskId !== undefined) continue;

        const csv = csvById.get(sourceId)!;
        const mvpTaskId = nextId++;
        if (assignedTaskIds.has(mvpTaskId)) {
            console.error(`[phase7a-slice4a] taskId collision: ${mvpTaskId}`);
            process.exit(1);
        }
        assignedTaskIds.add(mvpTaskId);

        const structId = STRUCT_ID_BASE + mvpTaskId;
        const tier = DIFFICULTY_TO_TIER[csv.difficulty] ?? 1;
        rows.push({
            taskId: mvpTaskId,
            name: csv.name,
            description: csv.requirements || undefined,
            tier,
            points: csv.points,
            category: 0,
            area: 0,
            skill: 0,
            structId,
        });
        existingTriggers[mvpTaskId] = entry.trigger;
        entry.mvpTaskId = mvpTaskId;
        importedSourceIds.push(sourceId);
    }

    if (importedSourceIds.length === 0) {
        console.log("[phase7a-slice4a] Nothing to import (all tasks already have mvpTaskId)");
        process.exit(0);
    }

    const structIds = rows.map((r) => r.structId ?? STRUCT_ID_BASE + r.taskId);
    const sharedDir = path.join(repoRoot, "src/shared/leagues");
    fs.writeFileSync(path.join(sharedDir, "leagueTasks.data.ts"), formatLeagueTasksTs(rows), "utf8");
    fs.writeFileSync(path.join(sharedDir, "leagueTaskTriggers.data.ts"), formatTriggersTs(existingTriggers), "utf8");
    fs.writeFileSync(path.join(sharedDir, "leagueTasksEnumOverride.ts"), formatEnumOverrideTs(structIds), "utf8");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    resetPhase7aCollectionTriggerCache();

    console.log(
        `[phase7a-slice4a] Imported ${importedSourceIds.length} tasks (taskId ${LEAGUE_TASKS.length}..${rows.length - 1}, total ${rows.length})`,
    );
    console.log(`[phase7a-slice4a] CSV source ids: ${importedSourceIds.join(", ")}`);
}

main();
