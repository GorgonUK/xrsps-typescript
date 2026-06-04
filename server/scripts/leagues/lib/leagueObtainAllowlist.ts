import fs from "fs";
import path from "path";

import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

export type LeagueObtainAllowlistEntry = {
    sourceTaskId: number;
    itemId: number;
    note?: string;
    trigger: TaskTrigger;
};

export type LeagueObtainAllowlistFile = {
    description: string;
    entries: LeagueObtainAllowlistEntry[];
};

let cachedFile: LeagueObtainAllowlistFile | undefined;

export function loadLeagueObtainAllowlistFile(): LeagueObtainAllowlistFile {
    if (cachedFile) {
        return cachedFile;
    }
    const repoRoot = path.resolve(__dirname, "../../../..");
    const filePath = path.join(repoRoot, "server/data/leagues/league-obtain-allowlist.json");
    cachedFile = JSON.parse(fs.readFileSync(filePath, "utf8")) as LeagueObtainAllowlistFile;
    return cachedFile;
}

export function loadLeagueObtainAllowlistItemIds(): Set<number> {
    const ids = new Set<number>();
    for (const entry of loadLeagueObtainAllowlistFile().entries) {
        ids.add(entry.itemId | 0);
        for (const id of entry.trigger.type === "item_equip" || entry.trigger.type === "item_obtain"
            ? (entry.trigger.itemIds ?? [])
            : []) {
            ids.add(id | 0);
        }
    }
    return ids;
}

export function getLeagueObtainAllowlistEntry(sourceTaskId: number): LeagueObtainAllowlistEntry | undefined {
    return loadLeagueObtainAllowlistFile().entries.find((e) => e.sourceTaskId === (sourceTaskId | 0));
}

export function resetLeagueObtainAllowlistCache(): void {
    cachedFile = undefined;
}
