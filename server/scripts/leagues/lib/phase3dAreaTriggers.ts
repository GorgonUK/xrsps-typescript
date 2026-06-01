import fs from "fs";
import path from "path";

import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

type Phase3dAreaFile = {
    tasks: Array<{
        sourceTaskId: number;
        mvpTaskId?: number;
        trigger: TaskTrigger;
    }>;
};

let cachedBySourceId: Map<number, TaskTrigger> | undefined;

function loadPhase3dBySourceId(): Map<number, TaskTrigger> {
    if (cachedBySourceId) {
        return cachedBySourceId;
    }
    const repoRoot = path.resolve(__dirname, "../../../..");
    const filePath = path.join(repoRoot, "server/data/leagues/phase3d-area-tasks.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Phase3dAreaFile;
    cachedBySourceId = new Map();
    for (const entry of parsed.tasks) {
        cachedBySourceId.set(entry.sourceTaskId | 0, entry.trigger);
    }
    return cachedBySourceId;
}

/** Explicit Phase 3D area_enter trigger for a CSV task id, if defined. */
export function getPhase3dAreaTrigger(sourceTaskId: number): TaskTrigger | undefined {
    return loadPhase3dBySourceId().get(sourceTaskId | 0);
}

/** Clear cached manifest (for tests after import rewrites JSON). */
export function resetPhase3dAreaTriggerCache(): void {
    cachedBySourceId = undefined;
}
