/**
 * Shared audit logic: classify live league tasks by real gameplay completability.
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASKS } from "../../../../src/shared/leagues/leagueTasks.data";
import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../../src/shared/leagues/leagueTaskTriggers.data";
import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";
import { getWoodcuttingTreeById } from "../../../src/game/skills/woodcutting";
import { parseCsvFile } from "./csv";
import { buildRegistries } from "./registries";
import { skillingActionIndexKey } from "../../../src/game/leagues/skillingAction";

export type GameplayClassification =
    | "natural_gameplay_confirmed"
    | "admin_sim_only"
    | "likely_unreachable"
    | "missing_emit"
    | "missing_content"
    | "needs_manual_test"
    | "duplicate_shared_trigger";

export type LiveTaskAuditEntry = {
    taskId: number;
    sourceCsvId: number | null;
    name: string;
    triggerType: string;
    targetIds: number[];
    triggerDetail: string;
    expectedGameplaySource: string;
    emitFile: string;
    emitFunction: string;
    classification: GameplayClassification;
    confidence: "high" | "medium" | "low";
    issue: string | null;
    recommendedFix: string | null;
    sharedTriggerKey: string;
    sharedWithTaskIds: number[];
};

export type LiveTaskAuditReport = {
    generatedAt: string;
    liveTaskCount: number;
    summary: Record<GameplayClassification, number>;
    byTriggerType: Record<string, number>;
    entries: LiveTaskAuditEntry[];
};

/** Tree *object* ids mistakenly used as item_obtain targets in MVP import. */
const WOODCUT_OBJECT_TO_LOG: Record<number, number> = {
    8173: 1511,
    8175: 1521,
    8176: 1519,
    8177: 1517,
    8178: 1515,
    8179: 1513,
};

const EMIT_WIRING: Record<
    string,
    { file: string; fn: string; gameplay: string; wired: boolean }
> = {
    skilling_action: {
        file: "server/src/game/actions/handlers/SkillActionHandler.ts + scripts/modules/skills/hunter.ts",
        fn: "emitLeagueSkillingAction / onLeagueSkillingAction → wsServer.onSkillingAction",
        gameplay: "Successful skill action (mine/catch/chop/cook/burn/fletch/smith/spin/pickpocket/hunter trap catch)",
        wired: true,
    },
    item_equip: {
        file: "server/src/network/wsServer.ts",
        fn: "equipItem → leagueTaskManager.onItemEquip",
        gameplay: "Equip item from inventory",
        wired: true,
    },
    item_obtain: {
        file: "server/src/network/wsServer.ts",
        fn: "addItemToInventory → leagueTaskManager.onItemObtain",
        gameplay: "Item added to inventory (loot, gather reward, receive)",
        wired: true,
    },
    item_craft: {
        file: "server/src/game/actions/handlers/SkillActionHandler.ts",
        fn: "onItemCraft callback → leagueTaskManager.onItemCraft",
        gameplay: "Cook/smith/fletch/spin success paths that call onItemCraft",
        wired: true,
    },
    npc_kill: {
        file: "server/src/network/wsServer.ts",
        fn: "handleNpcDeath → leagueTaskManager.onNpcKill",
        gameplay: "NPC death with kill credit",
        wired: true,
    },
    spell_cast: {
        file: "server/src/network/wsServer.ts + spellbookWidgets.ts",
        fn: "queueSpellResult / onLeagueSpellCast → leagueTaskManager.onSpellCast",
        gameplay: "Successful spell cast or spellbook teleport",
        wired: true,
    },
    area_enter: {
        file: "server/src/network/wsServer.ts",
        fn: "resolveEnteredLeagueAreas → leagueTaskManager.onAreaEnter",
        gameplay: "Walk into registered league area bounds",
        wired: true,
    },
    wilderness_level: {
        file: "server/src/network/wsServer.ts",
        fn: "wilderness level tick → leagueTaskManager.onWildernessLevelCross",
        gameplay: "Cross wilderness level threshold while moving",
        wired: true,
    },
    level_reach: {
        file: "server/src/network/wsServer.ts",
        fn: "syncSkillProgressTasks (login/XP)",
        gameplay: "Gain skill XP / level up / login sync",
        wired: true,
    },
    total_level_reach: {
        file: "server/src/network/wsServer.ts",
        fn: "syncSkillProgressTasks (login/XP)",
        gameplay: "Total level milestone on login or XP gain",
        wired: true,
    },
    combat_level_reach: {
        file: "server/src/network/wsServer.ts",
        fn: "syncSkillProgressTasks (login/XP)",
        gameplay: "Combat level milestone on login or XP gain",
        wired: true,
    },
    xp_reach: {
        file: "server/src/network/wsServer.ts",
        fn: "syncSkillProgressTasks (login/XP)",
        gameplay: "Skill XP milestone on login or XP gain",
        wired: true,
    },
    collection_log: {
        file: "server/src/network/wsServer.ts",
        fn: "doTrackCollectionLogItem → leagueTaskManager.onCollectionLogEvent",
        gameplay: "First-time collection log unlock",
        wired: true,
    },
};

function extractTargetIds(trigger: TaskTrigger): number[] {
    switch (trigger.type) {
        case "npc_kill":
            return trigger.npcIds ?? [];
        case "item_equip":
        case "item_obtain":
        case "item_craft":
            return trigger.itemIds ?? [];
        case "skilling_action":
            return trigger.targetIds ?? [];
        case "spell_cast":
            if (trigger.spellId) return [trigger.spellId];
            if (trigger.spellIdsAny) return trigger.spellIdsAny;
            return [];
        case "area_enter":
            return [];
        case "wilderness_level":
            return [trigger.minLevel ?? 0];
        case "collection_log":
            return trigger.tabIndex !== undefined ? [trigger.tabIndex] : [];
        default:
            return [];
    }
}

function triggerDetail(trigger: TaskTrigger): string {
    switch (trigger.type) {
        case "skilling_action":
            return `${trigger.skill}/${trigger.action} targets=[${(trigger.targetIds ?? []).join(",")}]`;
        case "npc_kill":
            return `npcIds=[${(trigger.npcIds ?? []).join(",")}]`;
        case "item_equip":
        case "item_obtain":
        case "item_craft":
            return `itemIds=[${(trigger.itemIds ?? []).join(",")}]`;
        case "spell_cast":
            if (trigger.teleportName) return `teleport=${trigger.teleportName}`;
            if (trigger.spellCategory) return `category=${trigger.spellCategory}`;
            if (trigger.spellbook) return `spellbook=${trigger.spellbook}`;
            return `spellId=${trigger.spellId ?? "any"}`;
        case "area_enter":
            return `areaKeys=[${(trigger.areaKeys ?? []).join(",")}]`;
        case "wilderness_level":
            return `minLevel=${trigger.minLevel ?? 1}`;
        case "level_reach":
            return `level=${trigger.level} anySkill=${!!trigger.anySkill}`;
        case "total_level_reach":
            return `minTotalLevel=${trigger.minTotalLevel}`;
        case "combat_level_reach":
            return `minCombatLevel=${trigger.minCombatLevel}`;
        case "xp_reach":
            return `minXp=${trigger.minXp} skill=${trigger.skillId ?? "any"}`;
        case "collection_log":
            return `milestone=${trigger.milestone} minSlots=${trigger.minSlots ?? "n/a"}`;
        default:
            return trigger.type;
    }
}

function sharedTriggerKey(trigger: TaskTrigger): string {
    switch (trigger.type) {
        case "skilling_action":
            return (trigger.targetIds ?? [])
                .map((id) => skillingActionIndexKey(trigger.skill, trigger.action, id))
                .sort()
                .join("|");
        case "npc_kill":
            return `npc_kill:${(trigger.npcIds ?? []).sort((a, b) => a - b).join(",")}`;
        case "item_equip":
            return `item_equip:${(trigger.itemIds ?? []).sort((a, b) => a - b).join(",")}`;
        case "item_obtain":
            return `item_obtain:${(trigger.itemIds ?? []).sort((a, b) => a - b).join(",")}`;
        case "item_craft":
            return `item_craft:${(trigger.itemIds ?? []).sort((a, b) => a - b).join(",")}`;
        case "spell_cast":
            if (trigger.teleportName) return `spell_teleport:${trigger.teleportName.toLowerCase()}`;
            if (trigger.spellId) return `spell_id:${trigger.spellId}`;
            return JSON.stringify(trigger);
        case "area_enter":
            return `area:${(trigger.areaKeys ?? []).sort().join(",")}`;
        default:
            return JSON.stringify(trigger);
    }
}

function isWoodcutObjectMisTrigger(trigger: TaskTrigger): boolean {
    if (trigger.type !== "item_obtain") return false;
    const ids = trigger.itemIds ?? [];
    return ids.some((id) => id in WOODCUT_OBJECT_TO_LOG);
}

function isWrongCookChicken(trigger: TaskTrigger, name: string): boolean {
    if (!name.toLowerCase().includes("cook chicken")) return false;
    if (trigger.type === "item_craft") {
        const ids = trigger.itemIds ?? [];
        return ids.includes(5609) && !ids.includes(2140);
    }
    return false;
}

function isHunterLizardMisTrigger(trigger: TaskTrigger, name: string): boolean {
    if (!name.toLowerCase().includes("desert lizard")) return false;
    if (trigger.type !== "item_obtain") return false;
    return (trigger.itemIds ?? []).includes(6695);
}

function classifyEntry(
    taskId: number,
    name: string,
    trigger: TaskTrigger,
    reg: ReturnType<typeof buildRegistries>,
    sharedWith: number[],
): Omit<LiveTaskAuditEntry, "sharedTriggerKey" | "sharedWithTaskIds"> {
    const triggerType = trigger.type;
    const targetIds = extractTargetIds(trigger);
    const wiring = EMIT_WIRING[triggerType] ?? {
        file: "(unknown)",
        fn: "(unknown)",
        gameplay: "(unknown)",
        wired: false,
    };

    let classification: GameplayClassification = "natural_gameplay_confirmed";
    let confidence: "high" | "medium" | "low" = "high";
    let issue: string | null = null;
    let recommendedFix: string | null = null;

    if (!wiring.wired) {
        classification = "missing_emit";
        issue = `No verified gameplay emit for trigger type ${triggerType}`;
        recommendedFix = `Wire LeagueTaskManager handler for ${triggerType}`;
    } else if (isWoodcutObjectMisTrigger(trigger)) {
        classification = "likely_unreachable";
        confidence = "high";
        const objId = (trigger.itemIds ?? [])[0];
        const logId = WOODCUT_OBJECT_TO_LOG[objId];
        issue = `item_obtain uses tree object id ${objId}; woodcut emits skilling_action/chop with log id ${logId}`;
        recommendedFix = `Change trigger to skilling_action woodcutting/chop targetIds=[${logId}]`;
    } else if (isWrongCookChicken(trigger, name)) {
        classification = "likely_unreachable";
        confidence = "high";
        issue = "item_craft targets 5609; cooked chicken is item 2140 from cook handler";
        recommendedFix = "Change trigger to skilling_action cooking/cook targetIds=[2140]";
    } else if (isHunterLizardMisTrigger(trigger, name)) {
        classification = "likely_unreachable";
        confidence = "high";
        issue = "item_obtain 6695 is not a valid item; hunter trap gives feathers (314), no hunter skilling emit";
        recommendedFix =
            "Change trigger to skilling_action hunter/catch targetIds=[5551] and emit from hunter checkTrap";
    } else if (sharedWith.length > 0) {
        const regionalNpc =
            trigger.type === "npc_kill" &&
            /\b(in|near|on)\s+(the\s+)?\w+/i.test(name) &&
            !name.toLowerCase().includes("wilderness");
        if (regionalNpc) {
            classification = "needs_manual_test";
            confidence = "medium";
            issue = `Shared npc_kill trigger with tasks [${sharedWith.join(", ")}]; no region gate on hook`;
            recommendedFix = "Verify kill location in-game; regional tasks may complete from wrong area";
        } else {
            classification = "duplicate_shared_trigger";
            confidence = "high";
            issue = `Same trigger completes tasks [${sharedWith.join(", ")}, ${taskId}]`;
            recommendedFix = null;
        }
    } else if (trigger.type === "npc_kill") {
        const npcId = (trigger.npcIds ?? [])[0];
        if (npcId && !reg.spawnedNpcIds.has(npcId)) {
            classification = "needs_manual_test";
            confidence = "medium";
            issue = `npcId ${npcId} not in npc-spawns.json (may be instance/dynamic boss)`;
            recommendedFix = "Verify boss encounter exists in-game; add spawn data if missing";
        }
    } else if (trigger.type === "item_equip" || trigger.type === "item_obtain") {
        const itemId = (trigger.itemIds ?? [])[0];
        if (itemId) {
            const itemName = reg.getItemName(itemId);
            if (!itemName || itemName.startsWith("item:")) {
                classification = "missing_content";
                confidence = "high";
                issue = `itemId ${itemId} not in cache`;
            }
        }
    } else if (trigger.type === "skilling_action") {
        // Content checks delegated to validate-tasks; emit path verified in SkillActionHandler.
    } else if (trigger.type === "area_enter") {
        const keys = trigger.areaKeys ?? [];
        if (keys.length === 0) {
            classification = "likely_unreachable";
            issue = "area_enter trigger missing areaKeys";
        }
    }

    if (
        classification === "natural_gameplay_confirmed" &&
        trigger.type === "collection_log"
    ) {
        classification = "needs_manual_test";
        confidence = "medium";
        issue = "Requires first-time collection log unlock; verify in-game";
    }

    return {
        taskId,
        sourceCsvId: null,
        name,
        triggerType,
        targetIds,
        triggerDetail: triggerDetail(trigger),
        expectedGameplaySource: wiring.gameplay,
        emitFile: wiring.file,
        emitFunction: wiring.fn,
        classification,
        confidence,
        issue,
        recommendedFix,
    };
}

export function buildLiveTaskGameplayAudit(repoRoot: string): LiveTaskAuditReport {
    const reg = buildRegistries(repoRoot);
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvByName = new Map(csvRows.map((r) => [r.name.trim(), r.id]));

    type PartialEntry = LiveTaskAuditEntry & { _key: string };
    const partials: PartialEntry[] = [];

    for (const task of LEAGUE_TASKS) {
        const trigger = LEAGUE_TASK_TRIGGER_BY_ID[task.taskId];
        if (!trigger) continue;
        const key = sharedTriggerKey(trigger);
        const base = classifyEntry(task.taskId, task.name.trim(), trigger, reg, []);
        partials.push({
            ...base,
            sourceCsvId: csvByName.get(task.name.trim()) ?? null,
            sharedTriggerKey: key,
            sharedWithTaskIds: [],
            _key: key,
        });
    }

    const byKey = new Map<string, number[]>();
    for (const p of partials) {
        const arr = byKey.get(p._key) ?? [];
        arr.push(p.taskId);
        byKey.set(p._key, arr);
    }

    for (const p of partials) {
        const group = byKey.get(p._key) ?? [];
        if (group.length > 1) {
            p.sharedWithTaskIds = group.filter((id) => id !== p.taskId);
            if (p.classification === "natural_gameplay_confirmed") {
                const reclassified = classifyEntry(
                    p.taskId,
                    p.name,
                    LEAGUE_TASK_TRIGGER_BY_ID[p.taskId]!,
                    reg,
                    p.sharedWithTaskIds,
                );
                p.classification = reclassified.classification;
                p.confidence = reclassified.confidence;
                p.issue = reclassified.issue;
                p.recommendedFix = reclassified.recommendedFix;
            }
        }
    }

    const summary: Record<GameplayClassification, number> = {
        natural_gameplay_confirmed: 0,
        admin_sim_only: 0,
        likely_unreachable: 0,
        missing_emit: 0,
        missing_content: 0,
        needs_manual_test: 0,
        duplicate_shared_trigger: 0,
    };
    const byTriggerType: Record<string, number> = {};

    const entries: LiveTaskAuditEntry[] = partials.map(({ _key, ...rest }) => {
        summary[rest.classification]++;
        byTriggerType[rest.triggerType] = (byTriggerType[rest.triggerType] ?? 0) + 1;
        return rest;
    });

    return {
        generatedAt: new Date().toISOString(),
        liveTaskCount: LEAGUE_TASKS.length,
        summary,
        byTriggerType,
        entries: entries.sort((a, b) => a.taskId - b.taskId),
    };
}

export function writeLiveTaskGameplayAudit(repoRoot: string, report: LiveTaskAuditReport): string {
    const outPath = path.join(
        repoRoot,
        "server/data/leagues/reports/live-task-gameplay-completion-audit.json",
    );
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    return outPath;
}

export function buildGameplayTestGroups(report: LiveTaskAuditReport): Map<
    string,
    {
        actionLabel: string;
        managerCall: string;
        taskIds: number[];
        sourceCsvIds: (number | null)[];
        names: string[];
    }
> {
    const groups = new Map<
        string,
        {
            actionLabel: string;
            managerCall: string;
            taskIds: number[];
            sourceCsvIds: (number | null)[];
            names: string[];
        }
    >();

    for (const entry of report.entries) {
        if (entry.classification === "likely_unreachable" || entry.classification === "missing_emit") {
            continue;
        }
        let key = "";
        let actionLabel = "";
        let managerCall = "";

        switch (entry.triggerType) {
            case "skilling_action": {
                const m = entry.triggerDetail.match(/^(\w+)\/(\w+)/);
                const skill = m?.[1] ?? "?";
                const action = m?.[2] ?? "?";
                const tid = entry.targetIds[0] ?? 0;
                key = `skill:${skill}:${action}:${tid}`;
                actionLabel = `${action} (${skill}) target ${tid}`;
                managerCall = `onSkillingAction(playerId, "${skill}", "${action}", ${tid}, 1)`;
                break;
            }
            case "npc_kill": {
                const nid = entry.targetIds[0] ?? 0;
                key = `npc_kill:${nid}`;
                actionLabel = `Kill NPC ${nid}`;
                managerCall = `onNpcKill(playerId, ${nid})`;
                break;
            }
            case "item_equip": {
                const iid = entry.targetIds[0] ?? 0;
                key = `item_equip:${iid}`;
                actionLabel = `Equip item ${iid}`;
                managerCall = `onItemEquip(playerId, ${iid})`;
                break;
            }
            case "item_obtain": {
                const iid = entry.targetIds[0] ?? 0;
                key = `item_obtain:${iid}`;
                actionLabel = `Obtain item ${iid}`;
                managerCall = `onItemObtain(playerId, ${iid}, 1)`;
                break;
            }
            case "spell_cast": {
                key = `spell:${entry.triggerDetail}`;
                actionLabel = entry.triggerDetail;
                managerCall = `onSpellCast(playerId, { ... })`;
                break;
            }
            default:
                continue;
        }

        const g = groups.get(key) ?? {
            actionLabel,
            managerCall,
            taskIds: [],
            sourceCsvIds: [],
            names: [],
        };
        g.taskIds.push(entry.taskId);
        g.sourceCsvIds.push(entry.sourceCsvId);
        g.names.push(entry.name);
        groups.set(key, g);
    }

    return groups;
}

/** Runtime log ids for woodcut MVP fix verification. */
export function getWoodcutLogIdForObjectId(objectId: number): number | undefined {
    return WOODCUT_OBJECT_TO_LOG[objectId];
}

export function getWoodcuttingLogIdsFromRuntime(): Set<number> {
    const ids = new Set<number>();
    for (const treeId of [
        "normal",
        "oak",
        "willow",
        "maple",
        "yew",
        "magic",
        "teak",
        "mahogany",
        "redwood",
    ]) {
        const t = getWoodcuttingTreeById(treeId);
        if (t?.logItemId) ids.add(t.logItemId);
    }
    return ids;
}
