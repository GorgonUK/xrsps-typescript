import fs from "fs";
import path from "path";

import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

type Phase6bCollectionFile = {
    tasks: Array<{
        sourceTaskId: number;
        trigger: TaskTrigger;
    }>;
};

let cachedBySourceId: Map<number, TaskTrigger> | undefined;

function loadPhase6bBySourceId(): Map<number, TaskTrigger> {
    if (cachedBySourceId) {
        return cachedBySourceId;
    }
    const repoRoot = path.resolve(__dirname, "../../../..");
    const filePath = path.join(repoRoot, "server/data/leagues/phase6b-collection-tasks.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Phase6bCollectionFile;
    cachedBySourceId = new Map();
    for (const entry of parsed.tasks) {
        cachedBySourceId.set(entry.sourceTaskId | 0, entry.trigger);
    }
    return cachedBySourceId;
}

/** Phase 6B collection_log trigger for a CSV task id, if defined. */
export function getPhase6bCollectionTrigger(sourceTaskId: number): TaskTrigger | undefined {
    return loadPhase6bBySourceId().get(sourceTaskId | 0);
}

/** CSV ids imported in Phase 6B (547 deferred). */
export function getPhase6bCollectionSourceTaskIds(): number[] {
    return [...loadPhase6bBySourceId().keys()].sort((a, b) => a - b);
}
