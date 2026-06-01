import fs from "fs";
import path from "path";

import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

type Phase2dSkillingFile = {
    tasks: Array<{
        sourceTaskId: number;
        mvpTaskId?: number;
        trigger: TaskTrigger;
    }>;
};

let cachedBySourceId: Map<number, TaskTrigger> | undefined;

function loadPhase2dBySourceId(): Map<number, TaskTrigger> {
    if (cachedBySourceId) {
        return cachedBySourceId;
    }
    const repoRoot = path.resolve(__dirname, "../../../..");
    const filePath = path.join(repoRoot, "server/data/leagues/phase2d-skilling-tasks.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Phase2dSkillingFile;
    cachedBySourceId = new Map();
    for (const entry of parsed.tasks) {
        cachedBySourceId.set(entry.sourceTaskId | 0, entry.trigger);
    }
    return cachedBySourceId;
}

/** Explicit Phase 2D skilling_action trigger for a CSV task id, if defined. */
export function getPhase2dSkillingTrigger(sourceTaskId: number): TaskTrigger | undefined {
    return loadPhase2dBySourceId().get(sourceTaskId | 0);
}

/** Clear cached manifest (for tests after import rewrites JSON). */
export function resetPhase2dSkillingTriggerCache(): void {
    cachedBySourceId = undefined;
}
