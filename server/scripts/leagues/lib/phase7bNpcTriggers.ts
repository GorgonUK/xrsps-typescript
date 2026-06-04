import fs from "fs";
import path from "path";

import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

type Phase7bNpcFile = {
    description: string;
    tasks: Array<{
        sourceTaskId: number;
        slice?: string;
        tier?: string;
        chosenNpcId?: number;
        candidateNpcIds?: number[];
        mvpTaskId?: number;
        note?: string;
        trigger: TaskTrigger;
    }>;
};

let cachedBySourceId: Map<number, TaskTrigger> | undefined;

function loadPhase7bBySourceId(): Map<number, TaskTrigger> {
    if (cachedBySourceId) {
        return cachedBySourceId;
    }
    const repoRoot = path.resolve(__dirname, "../../../..");
    const filePath = path.join(repoRoot, "server/data/leagues/phase7b-npc-disambiguation.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Phase7bNpcFile;
    cachedBySourceId = new Map();
    for (const entry of parsed.tasks) {
        if (entry.trigger?.type === "npc_kill" && entry.trigger.npcIds.length > 0) {
            cachedBySourceId.set(entry.sourceTaskId | 0, entry.trigger);
        }
    }
    return cachedBySourceId;
}

/** Phase 7B NPC disambiguation trigger for a CSV task id, if defined in manifest. */
export function getPhase7bNpcTrigger(sourceTaskId: number): TaskTrigger | undefined {
    return loadPhase7bBySourceId().get(sourceTaskId | 0);
}

export function resetPhase7bNpcTriggerCache(): void {
    cachedBySourceId = undefined;
}
