/**
 * Pre-import gate for Phase 7A-1b (allowlist-backed Tier A collection tasks).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase7a1b-candidates.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { parseCsvFile } from "./lib/csv";
import { buildRegistries } from "./lib/registries";
import {
    getLeagueObtainAllowlistEntry,
    loadLeagueObtainAllowlistFile,
    resetLeagueObtainAllowlistCache,
} from "./lib/leagueObtainAllowlist";

const SLICE1B_SOURCE_IDS = [
    321, 1531, 1532, 1542, 1543, 1552, 1586, 1587, 1598, 1599, 1602, 1603, 1604, 1620, 1760, 1762,
    1763, 1764, 1765,
] as const;

function main(): void {
    resetLeagueObtainAllowlistCache();
    const repoRoot = path.resolve(__dirname, "../../..");
    const allowlist = loadLeagueObtainAllowlistFile();
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));
    const reg = buildRegistries(repoRoot);

    console.log(`[verify-phase7a1b-candidates] Phase 7A-1b allowlist import gate (${SLICE1B_SOURCE_IDS.length} tasks)\n`);

    if (allowlist.entries.length !== SLICE1B_SOURCE_IDS.length) {
        console.error(
            `[verify-phase7a1b-candidates] FAIL: allowlist has ${allowlist.entries.length} entries, expected ${SLICE1B_SOURCE_IDS.length}`,
        );
        process.exit(1);
    }

    const rejected: string[] = [];
    const manifestTasks: Array<{
        sourceTaskId: number;
        tier: string;
        chosenItemId: number;
        trigger: (typeof allowlist.entries)[0]["trigger"];
        allowlistNote: string;
    }> = [];

    for (const sourceId of SLICE1B_SOURCE_IDS) {
        const entry = getLeagueObtainAllowlistEntry(sourceId);
        if (!entry) {
            rejected.push(`CSV ${sourceId}: missing allowlist entry`);
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
        if (!reg.cacheAvailable) {
            rejected.push(`CSV ${sourceId}: cache unavailable`);
            continue;
        }
        const itemName = reg.getItemName(entry.itemId);
        if (!itemName || itemName === "null") {
            rejected.push(`CSV ${sourceId}: itemId ${entry.itemId} not in cache`);
            continue;
        }
        if (!reg.leagueObtainAllowlistItemIds.has(entry.itemId)) {
            rejected.push(`CSV ${sourceId}: itemId ${entry.itemId} not loaded in allowlist set`);
            continue;
        }
        if (entry.trigger.type !== "item_equip" && entry.trigger.type !== "item_obtain") {
            rejected.push(`CSV ${sourceId}: invalid trigger type`);
            continue;
        }
        if (!entry.trigger.itemIds?.includes(entry.itemId)) {
            rejected.push(`CSV ${sourceId}: trigger itemIds mismatch`);
            continue;
        }

        console.log(
            `  OK CSV ${sourceId} | ${entry.trigger.type} | itemId ${entry.itemId} | ${csv.name.trim()}`,
        );
        manifestTasks.push({
            sourceTaskId: sourceId,
            tier: "A-1b",
            chosenItemId: entry.itemId,
            trigger: entry.trigger,
            allowlistNote: entry.note ?? "",
        });
    }

    if (rejected.length > 0) {
        console.error("\n[verify-phase7a1b-candidates] FAIL:");
        for (const r of rejected) console.error(`  ${r}`);
        process.exit(1);
    }

    const manifestPath = path.join(repoRoot, "server/data/leagues/phase7a-collection-disambiguation.json");
    let existing = { description: "", tier: "A", tasks: [] as unknown[] };
    if (fs.existsSync(manifestPath)) {
        existing = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as typeof existing;
    }
    const existingIds = new Set(
        (existing.tasks as Array<{ sourceTaskId: number }>).map((t) => t.sourceTaskId),
    );
    for (const sourceId of SLICE1B_SOURCE_IDS) {
        if (existingIds.has(sourceId)) {
            console.error(`[verify-phase7a1b-candidates] FAIL: CSV ${sourceId} already in phase7a manifest`);
            process.exit(1);
        }
    }

    existing.description =
        "Phase 7A: collection ambiguous disambiguation (Slice 1 Tier A + Slice 1b allowlist).";
    existing.tasks = [...(existing.tasks as unknown[]), ...manifestTasks];

    fs.writeFileSync(manifestPath, JSON.stringify(existing, null, 2) + "\n", "utf8");

    console.log(`\n[verify-phase7a1b-candidates] PASS: ${manifestTasks.length} tasks appended to phase7a manifest`);
    console.log(`[verify-phase7a1b-candidates] Expected live after import: ${LEAGUE_TASKS.length + manifestTasks.length}`);
}

main();
