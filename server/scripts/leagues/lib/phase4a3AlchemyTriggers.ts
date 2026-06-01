import fs from "fs";
import path from "path";

import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

type Phase4a3AlchemyFile = {
    tasks: Array<{
        sourceTaskId: number;
        trigger: TaskTrigger;
    }>;
};

let cachedBySourceId: Map<number, TaskTrigger> | undefined;

function loadPhase4a3BySourceId(): Map<number, TaskTrigger> {
    if (cachedBySourceId) {
        return cachedBySourceId;
    }
    const repoRoot = path.resolve(__dirname, "../../../..");
    const filePath = path.join(repoRoot, "server/data/leagues/phase4a3-alchemy-tasks.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Phase4a3AlchemyFile;
    cachedBySourceId = new Map();
    for (const entry of parsed.tasks) {
        cachedBySourceId.set(entry.sourceTaskId | 0, entry.trigger);
    }
    return cachedBySourceId;
}

/** Phase 4A3 spell_cast trigger for a CSV task id, if defined. */
export function getPhase4a3AlchemyTrigger(sourceTaskId: number): TaskTrigger | undefined {
    return loadPhase4a3BySourceId().get(sourceTaskId | 0);
}
