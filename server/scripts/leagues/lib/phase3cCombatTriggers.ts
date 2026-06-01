import fs from "fs";
import path from "path";

import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

type Phase3cCombatFile = {
    tasks: Array<{
        sourceTaskId: number;
        trigger: TaskTrigger;
    }>;
};

let cachedBySourceId: Map<number, TaskTrigger> | undefined;

function loadPhase3cBySourceId(): Map<number, TaskTrigger> {
    if (cachedBySourceId) {
        return cachedBySourceId;
    }
    const repoRoot = path.resolve(__dirname, "../../../..");
    const filePath = path.join(repoRoot, "server/data/leagues/phase3c-combat-tasks.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Phase3cCombatFile;
    cachedBySourceId = new Map();
    for (const entry of parsed.tasks) {
        cachedBySourceId.set(entry.sourceTaskId | 0, entry.trigger);
    }
    return cachedBySourceId;
}

/** Phase 3C combat_level_reach trigger for a CSV task id, if defined. */
export function getPhase3cCombatTrigger(sourceTaskId: number): TaskTrigger | undefined {
    return loadPhase3cBySourceId().get(sourceTaskId | 0);
}
