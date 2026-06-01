import fs from "fs";
import path from "path";

import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

type Phase2b1PickpocketFile = {
    tasks: Array<{
        sourceTaskId: number;
        mvpTaskId?: number;
        trigger: TaskTrigger;
    }>;
};

let cachedBySourceId: Map<number, TaskTrigger> | undefined;

function loadPhase2b1BySourceId(): Map<number, TaskTrigger> {
    if (cachedBySourceId) {
        return cachedBySourceId;
    }
    const repoRoot = path.resolve(__dirname, "../../../..");
    const filePath = path.join(repoRoot, "server/data/leagues/phase2b1-pickpocket-tasks.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Phase2b1PickpocketFile;
    cachedBySourceId = new Map();
    for (const entry of parsed.tasks) {
        cachedBySourceId.set(entry.sourceTaskId | 0, entry.trigger);
    }
    return cachedBySourceId;
}

/** Explicit Phase 2C-B1 pickpocket skilling_action trigger for a CSV task id, if defined. */
export function getPhase2b1PickpocketTrigger(sourceTaskId: number): TaskTrigger | undefined {
    return loadPhase2b1BySourceId().get(sourceTaskId | 0);
}

/** Clear cached manifest (for tests after import rewrites JSON). */
export function resetPhase2b1PickpocketTriggerCache(): void {
    cachedBySourceId = undefined;
}
