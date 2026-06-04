/**
 * One-shot rebuild of phase7a manifest from live leagueTasks + triggers.
 * Usage: npx tsx server/scripts/leagues/restore-phase7a-manifest.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";
import { parseCsvFile } from "./lib/csv";
import { getLeagueObtainAllowlistEntry } from "./lib/leagueObtainAllowlist";
import { resetPhase7aCollectionTriggerCache } from "./lib/phase7aCollectionTriggers";

const SLICE1B = new Set([
    321, 1531, 1532, 1542, 1543, 1552, 1586, 1587, 1598, 1599, 1602, 1603, 1604, 1620, 1760, 1762,
    1763, 1764, 1765,
]);

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const csvByName = new Map(parseCsvFile(path.join(repoRoot, "tasks.csv")).map((r) => [r.name.trim(), r.id]));

    const tasks = [];
    for (let mvpTaskId = 323; mvpTaskId <= 380; mvpTaskId++) {
        const row = LEAGUE_TASKS[mvpTaskId];
        if (!row) {
            throw new Error(`Missing live task ${mvpTaskId}`);
        }
        const sourceTaskId = csvByName.get(row.name.trim());
        if (sourceTaskId === undefined) {
            throw new Error(`No CSV for live task ${mvpTaskId} ${row.name}`);
        }
        const trigger = LEAGUE_TASK_TRIGGER_BY_ID[mvpTaskId];
        if (!trigger) {
            throw new Error(`No trigger for mvpTaskId ${mvpTaskId}`);
        }
        const itemId =
            trigger.type === "item_equip" || trigger.type === "item_obtain"
                ? trigger.itemIds?.[0]
                : undefined;
        const entry: Record<string, unknown> = {
            sourceTaskId,
            tier: SLICE1B.has(sourceTaskId) ? "A-1b" : "A",
            chosenItemId: itemId,
            trigger,
            mvpTaskId,
        };
        if (SLICE1B.has(sourceTaskId)) {
            entry.allowlistNote = getLeagueObtainAllowlistEntry(sourceTaskId)?.note ?? "";
        }
        tasks.push(entry);
    }

    const manifest = {
        description: "Phase 7A: collection ambiguous disambiguation (Slice 1 Tier A + Slice 1b allowlist).",
        tier: "A",
        tasks,
    };

    const outPath = path.join(repoRoot, "server/data/leagues/phase7a-collection-disambiguation.json");
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    resetPhase7aCollectionTriggerCache();
    console.log(`[restore-phase7a-manifest] Restored ${tasks.length} entries to ${outPath}`);
}

main();
