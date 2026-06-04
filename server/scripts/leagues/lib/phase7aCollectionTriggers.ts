import fs from "fs";
import path from "path";

import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

type Phase7aCollectionFile = {
    description: string;
    tier: string;
    tasks: Array<{
        sourceTaskId: number;
        tier?: string;
        chosenItemId?: number;
        candidateItemIds?: number[];
        mvpTaskId?: number;
        trigger: TaskTrigger;
    }>;
};

let cachedBySourceId: Map<number, TaskTrigger> | undefined;

function loadPhase7aBySourceId(): Map<number, TaskTrigger> {
    if (cachedBySourceId) {
        return cachedBySourceId;
    }
    const repoRoot = path.resolve(__dirname, "../../../..");
    const filePath = path.join(repoRoot, "server/data/leagues/phase7a-collection-disambiguation.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Phase7aCollectionFile;
    cachedBySourceId = new Map();
    for (const entry of parsed.tasks) {
        cachedBySourceId.set(entry.sourceTaskId | 0, entry.trigger);
    }
    return cachedBySourceId;
}

/** Phase 7A collection disambiguation trigger for a CSV task id, if defined. */
export function getPhase7aCollectionTrigger(sourceTaskId: number): TaskTrigger | undefined {
    return loadPhase7aBySourceId().get(sourceTaskId | 0);
}

export function resetPhase7aCollectionTriggerCache(): void {
    cachedBySourceId = undefined;
}
