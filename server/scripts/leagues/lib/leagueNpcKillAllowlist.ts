import fs from "fs";
import path from "path";

import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

export type LeagueNpcKillProofType = "instance_boss" | "dynamic_spawn" | "farming_boss";

export type LeagueNpcKillAllowlistEntry = {
    sourceTaskId: number;
    npcId: number;
    proofType: LeagueNpcKillProofType;
    note?: string;
    proof?: string;
    trigger: TaskTrigger;
};

export type LeagueNpcKillAllowlistFile = {
    description: string;
    entries: LeagueNpcKillAllowlistEntry[];
};

const PROOF_TYPES = new Set<LeagueNpcKillProofType>([
    "instance_boss",
    "dynamic_spawn",
    "farming_boss",
]);

let cachedFile: LeagueNpcKillAllowlistFile | undefined;

export function loadLeagueNpcKillAllowlistFile(): LeagueNpcKillAllowlistFile {
    if (cachedFile) {
        return cachedFile;
    }
    const repoRoot = path.resolve(__dirname, "../../../..");
    const filePath = path.join(repoRoot, "server/data/leagues/league-npc-kill-allowlist.json");
    cachedFile = JSON.parse(fs.readFileSync(filePath, "utf8")) as LeagueNpcKillAllowlistFile;
    return cachedFile;
}

export function loadLeagueNpcKillAllowlistSourceIds(): Set<number> {
    const ids = new Set<number>();
    for (const entry of loadLeagueNpcKillAllowlistFile().entries) {
        ids.add(entry.sourceTaskId | 0);
    }
    return ids;
}

export function getLeagueNpcKillAllowlistEntry(
    sourceTaskId: number,
): LeagueNpcKillAllowlistEntry | undefined {
    return loadLeagueNpcKillAllowlistFile().entries.find(
        (e) => e.sourceTaskId === (sourceTaskId | 0),
    );
}

export function isValidLeagueNpcKillProofType(value: string): value is LeagueNpcKillProofType {
    return PROOF_TYPES.has(value as LeagueNpcKillProofType);
}

export function resetLeagueNpcKillAllowlistCache(): void {
    cachedFile = undefined;
}
