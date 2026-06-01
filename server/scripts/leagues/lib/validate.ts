import { parseTaskTrigger } from "../../../src/game/leagues/triggers/TriggerParser";
import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

import { categorizeTask } from "./categorize";
import {
    extractItemTargetFromTask,
    extractNpcTargetFromKillTask,
    extractPickpocketTarget,
    normalizeTaskNameForParser,
} from "./normalize";
import { getPhase2SkillingTrigger } from "./phase2Triggers";
import { getPhase2b1PickpocketTrigger } from "./phase2b1PickpocketTriggers";
import { getPhase2cSkillingTrigger } from "./phase2cSkillingTriggers";
import { getPhase2dSkillingTrigger } from "./phase2dSkillingTriggers";
import { getPhase3AreaTrigger } from "./phase3AreaTriggers";
import { getPhase3dAreaTrigger } from "./phase3dAreaTriggers";
import { getPhase3cCombatTrigger } from "./phase3cCombatTriggers";
import { getPhase4a1SpellTrigger } from "./phase4a1SpellTriggers";
import { getPhase4a2SpellTrigger } from "./phase4a2SpellTriggers";
import { getPhase4a3AlchemyTrigger } from "./phase4a3AlchemyTriggers";
import { getPhase4bCoreSpellTrigger } from "./phase4bCoreSpellTriggers";
import { getPhase6bCollectionTrigger } from "./phase6bCollectionTriggers";
import { getLeagueAreaDefinition } from "../../../src/game/leagues/AreaRegistry";
import { getSpellData } from "../../../src/data/spells";
import type { ValidationRegistries } from "./registries";
import type { CsvTaskRow, TaskBatch, TaskStatus, ValidationRow } from "./types";

const WIRED_HOOKS: Record<string, string> = {
    npc_kill: "LeagueTaskManager.onNpcKill",
    item_equip: "LeagueTaskManager.onItemEquip",
    item_obtain: "LeagueTaskManager.onItemObtain",
    item_craft: "LeagueTaskManager.onItemCraft",
    level_reach: "LeagueTaskManager.syncSkillProgressTasks",
    total_level_reach: "LeagueTaskManager.syncSkillProgressTasks",
    combat_level_reach: "LeagueTaskManager.syncSkillProgressTasks",
    xp_reach: "LeagueTaskManager.syncSkillProgressTasks",
    skilling_action: "LeagueTaskManager.onSkillingAction",
    area_enter: "LeagueTaskManager.onAreaEnter",
    wilderness_level: "LeagueTaskManager.onWildernessLevelCross",
    spell_cast: "LeagueTaskManager.onSpellCast",
    collection_log: "LeagueTaskManager.onCollectionLogEvent",
};

const UNWIRED_HOOKS: Record<string, string> = {
    quest_complete: "(unwired) quest completion",
    area_enter: "(unwired) area enter",
    collection_log: "(unwired) collection log add",
    minigame: "(unwired) minigame completion",
    slayer_task: "(unwired) slayer task complete",
    interaction: "(unwired) world interaction",
    pickpocket: "skill.pickpocket (no league hook)",
    clue: "(unwired) clue scroll complete",
    script_manual: "ScriptRuntime.completeLeagueTask",
};

function hookForTrigger(trigger: TaskTrigger | undefined): string {
    if (!trigger) return "";
    if (trigger.type in WIRED_HOOKS) return WIRED_HOOKS[trigger.type];
    if (trigger.type === "custom") return `(unwired) custom:${trigger.validator}`;
    return "";
}

function result(
    row: CsvTaskRow,
    batch: TaskBatch,
    status: TaskStatus,
    matched_content: string,
    matched_hook: string,
    missing_requirement: string,
    suggested_fix: string,
): ValidationRow {
    return {
        task_id: row.id,
        task_name: row.name,
        batch,
        status,
        matched_content,
        matched_hook,
        missing_requirement,
        suggested_fix,
    };
}

function checkNpcIds(
    reg: ValidationRegistries,
    npcIds: number[],
    requireSpawn: boolean,
): { content: string; missing: string; status: TaskStatus } {
    if (!reg.cacheAvailable) {
        return {
            content: "",
            missing: "cache loaders unavailable",
            status: "missing_content",
        };
    }
    if (npcIds.length === 0) {
        return { content: "", missing: "npc not found in cache", status: "missing_content" };
    }
    if (npcIds.length > 1) {
        const names = npcIds
            .slice(0, 5)
            .map((id) => `${id}:${reg.getNpcName(id)}`)
            .join("; ");
        return {
            content: `npc candidates: ${names}`,
            missing: "multiple NPC ids for name",
            status: "ambiguous",
        };
    }
    const id = npcIds[0];
    const spawned = reg.spawnedNpcIds.has(id);
    const content = `npc:${id} ${reg.getNpcName(id)}${spawned ? " spawned" : " not-spawned"}`;
    if (requireSpawn && !spawned) {
        return {
            content,
            missing: "npc not present in npc-spawns.json",
            status: "missing_content",
        };
    }
    return { content, missing: "", status: "ready" };
}

function resolveItemIds(reg: ValidationRegistries, itemName: string): number[] {
    const direct = reg.getItemIdsByName(itemName);
    if (direct.length > 0) return direct;
    // Try without trailing descriptors
    const simplified = itemName
        .replace(/\s+ornament kit$/i, "")
        .replace(/\s+set$/i, "")
        .trim();
    if (simplified !== itemName) {
        const alt = reg.getItemIdsByName(simplified);
        if (alt.length > 0) return alt;
    }
    return [];
}

function checkItemIds(
    reg: ValidationRegistries,
    itemIds: number[],
    opts: { requireObtainable?: boolean; itemLabel?: string; itemName?: string },
): { content: string; missing: string; status: TaskStatus } {
    if (!reg.cacheAvailable) {
        return {
            content: "",
            missing: "cache loaders unavailable",
            status: "missing_content",
        };
    }
    if (itemIds.length === 0) {
        const hint = opts.itemName ? ` ("${opts.itemName}")` : "";
        return {
            content: "",
            missing: `item not found in cache${hint}`,
            status: "missing_content",
        };
    }
    if (itemIds.length > 1) {
        const names = itemIds
            .slice(0, 5)
            .map((id) => `${id}:${reg.getItemName(id)}`)
            .join("; ");
        return {
            content: `item candidates: ${names}`,
            missing: "multiple item ids for name",
            status: "ambiguous",
        };
    }
    const id = itemIds[0];
    const name = reg.getItemName(id);
    const inLog = reg.collectionLogItemIds.has(id);
    const inManualDrops = reg.manualDropItemNames.has(reg.npcName(name));
    const obtainable = inLog || inManualDrops;
    let content = `${opts.itemLabel ?? "item"}:${id} ${name}`;
    if (inLog) content += " collection-log";
    if (inManualDrops) content += " manual-drop";
    if (opts.requireObtainable && !obtainable) {
        return {
            content,
            missing: "no known obtain path (drop/collection-log)",
            status: "missing_content",
        };
    }
    return { content, missing: "", status: "ready" };
}

function checkPickpocketNpcIds(
    reg: ValidationRegistries,
    npcIds: number[],
): { content: string; missing: string; status: TaskStatus } {
    if (npcIds.length === 0) {
        return {
            content: "",
            missing: "pickpocket trigger missing targetIds",
            status: "missing_content",
        };
    }
    const missing = npcIds.filter((id) => !reg.pickpocketNpcIds.has(id | 0));
    if (missing.length > 0) {
        return {
            content: `pickpocket npc ids: ${npcIds.slice(0, 5).join(",")}...`,
            missing: `npc ids not in thieving.ts PICKPOCKET_NPCS: ${missing.slice(0, 5).join(",")}`,
            status: "missing_content",
        };
    }
    const sample = npcIds
        .slice(0, 3)
        .map((id) => `${id}:${reg.getNpcName(id)}`)
        .join("; ");
    return {
        content: `thieving/pickpocket npcIds(${npcIds.length}) ${sample}`,
        missing: "",
        status: "ready",
    };
}

function validateWithTrigger(
    reg: ValidationRegistries,
    row: CsvTaskRow,
    batch: TaskBatch,
    trigger: TaskTrigger | undefined,
    opts: { requireSpawn?: boolean; requireObtainable?: boolean },
): ValidationRow {
    const hook = hookForTrigger(trigger);
    if (!trigger) {
        return result(
            row,
            batch,
            "need_hook",
            "",
            "",
            "no TaskTrigger could be parsed from task name",
            "Add explicit trigger JSON or implement parser pattern",
        );
    }

    if (!(trigger.type in WIRED_HOOKS)) {
        const unwired = UNWIRED_HOOKS[trigger.type] ?? `(unwired) ${trigger.type}`;
        return result(
            row,
            batch,
            "need_hook",
            `trigger:${trigger.type}`,
            unwired,
            "completion event not wired to LeagueTaskManager",
            `Wire ${trigger.type} or use ScriptRuntime.completeLeagueTask in content script`,
        );
    }

    switch (trigger.type) {
        case "npc_kill": {
            const check = checkNpcIds(reg, trigger.npcIds, opts.requireSpawn ?? true);
            const status = check.status === "ready" ? "ready" : check.status;
            return result(row, batch, status, check.content, hook, check.missing, suggest(check, row));
        }
        case "item_equip":
        case "item_obtain":
        case "item_craft": {
            const check = checkItemIds(reg, trigger.itemIds, {
                requireObtainable: opts.requireObtainable ?? trigger.type !== "item_equip",
                itemLabel: trigger.type,
            });
            const status = check.status === "ready" ? "ready" : check.status;
            return result(row, batch, status, check.content, hook, check.missing, suggest(check, row));
        }
        case "level_reach":
        case "total_level_reach":
        case "combat_level_reach":
        case "xp_reach":
            return result(
                row,
                batch,
                "ready",
                trigger.type === "combat_level_reach"
                    ? `combat_level_reach:${trigger.minCombatLevel}`
                    : `trigger:${trigger.type}`,
                hook,
                "",
                "",
            );
        case "skilling_action": {
            if (trigger.skill === "thieving" && trigger.action === "pickpocket") {
                const check = checkPickpocketNpcIds(reg, trigger.targetIds);
                const content = check.content
                    ? `skilling_action:${check.content}`
                    : "skilling_action:thieving/pickpocket";
                const status = check.status === "ready" ? "ready" : check.status;
                return result(row, batch, status, content, hook, check.missing, suggest(check, row));
            }
            const check = checkItemIds(reg, trigger.targetIds, {
                itemLabel: `${trigger.skill}/${trigger.action}`,
            });
            const content = check.content
                ? `skilling_action:${trigger.skill}/${trigger.action} ${check.content}`
                : `skilling_action:${trigger.skill}/${trigger.action}`;
            const status = check.status === "ready" ? "ready" : check.status;
            return result(row, batch, status, content, hook, check.missing, suggest(check, row));
        }
        case "area_enter": {
            const areaKeys = trigger.areaKeys ?? [];
            if (areaKeys.length > 0) {
                return result(
                    row,
                    batch,
                    "ready",
                    `area_enter:${areaKeys.join(",")}`,
                    hook,
                    "",
                    "",
                );
            }
            if ((trigger.regionIds?.length ?? 0) > 0) {
                return result(
                    row,
                    batch,
                    "ready",
                    `area_enter:regions:${(trigger.regionIds ?? []).join(",")}`,
                    hook,
                    "",
                    "",
                );
            }
            return result(
                row,
                batch,
                "need_hook",
                "area_enter",
                hook,
                "area_enter trigger missing areaKeys/regionIds",
                "Add areaKeys or regionIds for area_enter trigger",
            );
        }
        case "wilderness_level": {
            const minLevel = trigger.minLevel | 0;
            if (minLevel > 0) {
                return result(
                    row,
                    batch,
                    "ready",
                    `wilderness_level:${minLevel}`,
                    hook,
                    "",
                    "",
                );
            }
            return result(
                row,
                batch,
                "need_hook",
                "wilderness_level",
                hook,
                "wilderness_level trigger missing minLevel",
                "Add minLevel for wilderness_level trigger",
            );
        }
        case "spell_cast": {
            const spellIds: number[] = [];
            if (trigger.spellId !== undefined && trigger.spellId > 0) {
                spellIds.push(trigger.spellId);
            }
            if (trigger.spellIdsAny) {
                spellIds.push(...trigger.spellIdsAny);
            }
            const missingIds = spellIds.filter((id) => !getSpellData(id));
            if (spellIds.length > 0 && missingIds.length > 0) {
                return result(
                    row,
                    batch,
                    "missing_content",
                    `spell_cast:missing:${missingIds.join(",")}`,
                    hook,
                    "spell id not in spells.ts",
                    "Add SpellDataEntry or fix trigger spell id",
                );
            }
            const contentParts: string[] = [];
            if (trigger.spellId) contentParts.push(`spellId:${trigger.spellId}`);
            if (trigger.spellIdsAny?.length) {
                contentParts.push(`spellIdsAny:${trigger.spellIdsAny.join(",")}`);
            }
            if (trigger.spellCategory) contentParts.push(`category:${trigger.spellCategory}`);
            if (trigger.teleportName) contentParts.push(`teleport:${trigger.teleportName}`);
            if (trigger.anySpell) contentParts.push("anySpell");
            if (trigger.spellbook) contentParts.push(`spellbook:${trigger.spellbook}`);
            if (trigger.areaKeys?.length) {
                contentParts.push(`areaKeys:${trigger.areaKeys.join(",")}`);
            }
            if (trigger.count) contentParts.push(`count:${trigger.count}`);
            const missingAreas = (trigger.areaKeys ?? []).filter((key) => !getLeagueAreaDefinition(key));
            if (missingAreas.length > 0) {
                return result(
                    row,
                    batch,
                    "missing_content",
                    contentParts.join(" "),
                    hook,
                    `unknown areaKeys: ${missingAreas.join(",")}`,
                    "Add AreaRegistry definition for areaKeys",
                );
            }
            if (
                trigger.spellbook &&
                !trigger.spellId &&
                !(trigger.spellIdsAny?.length ?? 0) &&
                !trigger.spellCategory &&
                !trigger.teleportName &&
                !trigger.anySpell
            ) {
                return result(row, batch, "ready", contentParts.join(" "), hook, "", "");
            }
            return result(
                row,
                batch,
                "ready",
                contentParts.length > 0 ? `spell_cast:${contentParts.join(" ")}` : "spell_cast",
                hook,
                "",
                "",
            );
        }
        case "collection_log": {
            const contentParts: string[] = [`milestone:${trigger.milestone}`];
            if (trigger.milestone === "slot") {
                contentParts.push(`minSlots:${Math.max(1, trigger.minSlots ?? 1)}`);
            } else if (trigger.milestone === "page") {
                if (trigger.tabIndex !== undefined) {
                    contentParts.push(`tabIndex:${trigger.tabIndex}`);
                }
                if (trigger.categoryStructId !== undefined) {
                    contentParts.push(`structId:${trigger.categoryStructId}`);
                }
            }
            return result(row, batch, "ready", contentParts.join(" "), hook, "", "");
        }
        default:
            return result(row, batch, "need_hook", "", hook, "unknown trigger", "");
    }
}

function suggest(
    check: { status: TaskStatus; missing: string },
    row: CsvTaskRow,
): string {
    if (check.status === "ambiguous") return "Set explicit target_id(s) in tasks source";
    if (check.missing.includes("not-spawned") || check.missing.includes("npc-spawns")) {
        return `Add NPC spawn for task ${row.id} or change target`;
    }
    if (check.missing.includes("not found in cache")) {
        return "Verify item/NPC name matches cache (r235) spelling";
    }
    if (check.missing.includes("obtain path")) {
        return "Add drop table, shop, craft recipe, or obtain-allowlist entry";
    }
    return "";
}

function validateSkills(reg: ValidationRegistries, row: CsvTaskRow): ValidationRow {
    const batch: TaskBatch = "skills";
    const name = row.name;

    if (/\bpickpocket\b/i.test(name)) {
        const target = extractPickpocketTarget(name);
        if (!target) {
            return result(row, batch, "ambiguous", "", UNWIRED_HOOKS.pickpocket, "pickpocket target not parsed", "");
        }
        const norm = reg.npcName(target);
        const matchedName = reg.pickpocketDisplayNames.find((d) => reg.npcName(d) === norm);
        const npcIds = reg.getNpcIdsByName(target);
        const ppIds = npcIds.filter((id) => reg.pickpocketNpcIds.has(id));
        const content =
            ppIds.length > 0
                ? `pickpocket npc ids: ${ppIds.join(",")}`
                : matchedName
                  ? `pickpocket def: ${matchedName}`
                  : "";
        if (ppIds.length === 0 && !matchedName) {
            return result(
                row,
                batch,
                "missing_content",
                content,
                UNWIRED_HOOKS.pickpocket,
                "pickpocket target not in thieving.ts PICKPOCKET_NPCS",
                `Add pickpocket def for "${target}" in thieving.ts`,
            );
        }
        return result(
            row,
            batch,
            "need_hook",
            content || `pickpocket:${target}`,
            UNWIRED_HOOKS.pickpocket,
            "pickpocket works but does not call LeagueTaskManager",
            "Emit league task check after successful pickpocket or use script_manual",
        );
    }

    if (/\bsteal from\b/i.test(name)) {
        return result(
            row,
            batch,
            "need_hook",
            "stall theft",
            UNWIRED_HOOKS.interaction,
            "stall theft not wired to league tasks",
            "Wire stall theft success or script_manual",
        );
    }

    if (/\bslayer task\b/i.test(name)) {
        return result(
            row,
            batch,
            "need_hook",
            "slayer task system exists",
            UNWIRED_HOOKS.slayer_task,
            "slayer task completion not wired to league tasks",
            "Hook slayer task completion in player/slayer module",
        );
    }

    const normalized = normalizeTaskNameForParser(name);
    const trigger = parseTaskTrigger(normalized, row.requirements, reg.loaders);
    return validateWithTrigger(reg, row, batch, trigger, {
        requireSpawn: false,
        requireObtainable: false,
    });
}

function validateCombat(reg: ValidationRegistries, row: CsvTaskRow): ValidationRow {
    const npcName = extractNpcTargetFromKillTask(row.name);
    const normalized = normalizeTaskNameForParser(row.name);
    const trigger =
        parseTaskTrigger(normalized, row.requirements, reg.loaders) ??
        ({
            type: "npc_kill" as const,
            npcIds: reg.getNpcIdsByName(npcName),
        } satisfies TaskTrigger);
    return validateWithTrigger(reg, row, "combat", trigger, { requireSpawn: true });
}

function validateBosses(reg: ValidationRegistries, row: CsvTaskRow): ValidationRow {
    const base = validateCombat(reg, row);
    if (base.status === "ready") {
        return { ...base, batch: "bosses" };
    }
    if (base.status === "missing_content" && base.missing_requirement.includes("not-spawned")) {
        return result(
            row,
            "bosses",
            "need_hook",
            base.matched_content,
            WIRED_HOOKS.npc_kill,
            "boss may be instanced/not in world spawns",
            "Confirm boss instance script fires onNpcKill or use script_manual",
        );
    }
    return { ...base, batch: "bosses" };
}

function validateMinigames(reg: ValidationRegistries, row: CsvTaskRow): ValidationRow {
    return result(
        row,
        "minigames",
        "need_hook",
        `minigame:${row.name}`,
        UNWIRED_HOOKS.minigame,
        "minigame completion not wired to league tasks",
        "Call completeLeagueTask from minigame reward script or add minigame validator",
    );
}

function validateCollection(reg: ValidationRegistries, row: CsvTaskRow): ValidationRow {
    const normalized = normalizeTaskNameForParser(row.name);
    const trigger = parseTaskTrigger(normalized, row.requirements, reg.loaders);
    if (/\bcollection log\b/i.test(row.name)) {
        return result(
            row,
            "collection",
            "need_hook",
            "collection log page",
            UNWIRED_HOOKS.collection_log,
            "collection log page completion not wired",
            "Hook collection log milestone or script_manual",
        );
    }
    const itemName = extractItemTargetFromTask(row.name);
    if (trigger) {
        return validateWithTrigger(reg, row, "collection", trigger, {
            requireSpawn: false,
            requireObtainable: true,
        });
    }
    if (itemName) {
        const ids = resolveItemIds(reg, itemName);
        const check = checkItemIds(reg, ids, {
            requireObtainable: true,
            itemLabel: "item",
            itemName,
        });
        const hook =
            /equip|wear/i.test(row.name) ? WIRED_HOOKS.item_equip : WIRED_HOOKS.item_obtain;
        const status = check.status === "ready" ? "ready" : check.status;
        return result(row, "collection", status, check.content, hook, check.missing, suggest(check, row));
    }
    return result(
        row,
        "collection",
        "need_hook",
        "",
        "",
        "could not parse collection task target",
        "Add explicit trigger with item ids",
    );
}

function validateQuests(reg: ValidationRegistries, row: CsvTaskRow): ValidationRow {
    void reg;
    if (/\benter\b/i.test(row.name)) {
        return result(
            row,
            "quests",
            "need_hook",
            `area:${row.area}`,
            UNWIRED_HOOKS.area_enter,
            "area enter not wired to league tasks",
            "Wire region enter hook or script_manual on area entry",
        );
    }
    if (/\bcomplete\b/i.test(row.name) && /\bclue\b/i.test(row.name)) {
        return result(
            row,
            "quests",
            "need_hook",
            "clue scroll",
            UNWIRED_HOOKS.clue,
            "clue scroll completion not wired",
            "Hook clue completion or script_manual",
        );
    }
    return result(
        row,
        "quests",
        "need_hook",
        `quest/area:${row.area}`,
        UNWIRED_HOOKS.quest_complete,
        "quest/diary completion not implemented",
        "Implement quest system hook or script_manual",
    );
}

function validateMisc(reg: ValidationRegistries, row: CsvTaskRow): ValidationRow {
    const name = row.name;
    if (/^(speak to|talk to)\b/i.test(name)) {
        return result(
            row,
            "misc",
            "need_hook",
            "npc dialogue",
            UNWIRED_HOOKS.interaction,
            "dialogue completion not wired",
            "Hook dialogue step or script_manual",
        );
    }
    if (/^(use|buy|fill|ride|recharge)\b/i.test(name)) {
        return result(
            row,
            "misc",
            "need_hook",
            "world interaction",
            UNWIRED_HOOKS.interaction,
            "interaction not wired to league tasks",
            "Implement object/NPC interaction hook or script_manual",
        );
    }
    const normalized = normalizeTaskNameForParser(name);
    const trigger = parseTaskTrigger(normalized, row.requirements, reg.loaders);
    if (trigger) {
        return validateWithTrigger(reg, row, "misc", trigger, { requireSpawn: false });
    }
    return result(
        row,
        "misc",
        "need_hook",
        "",
        "",
        "unclassified mechanic",
        "Assign completion_type and explicit trigger",
    );
}

export function validateTask(reg: ValidationRegistries, row: CsvTaskRow): ValidationRow {
    const batch = categorizeTask(row);
    const phase2Trigger = getPhase2SkillingTrigger(row.id);
    if (phase2Trigger) {
        return validateWithTrigger(reg, row, batch, phase2Trigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    const phase2cTrigger = getPhase2cSkillingTrigger(row.id);
    if (phase2cTrigger) {
        return validateWithTrigger(reg, row, batch, phase2cTrigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    const phase2dTrigger = getPhase2dSkillingTrigger(row.id);
    if (phase2dTrigger) {
        return validateWithTrigger(reg, row, batch, phase2dTrigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    const phase2b1Trigger = getPhase2b1PickpocketTrigger(row.id);
    if (phase2b1Trigger) {
        return validateWithTrigger(reg, row, batch, phase2b1Trigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    const phase3Trigger = getPhase3AreaTrigger(row.id);
    if (phase3Trigger) {
        return validateWithTrigger(reg, row, batch, phase3Trigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    const phase3dTrigger = getPhase3dAreaTrigger(row.id);
    if (phase3dTrigger) {
        return validateWithTrigger(reg, row, batch, phase3dTrigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    const phase3cTrigger = getPhase3cCombatTrigger(row.id);
    if (phase3cTrigger) {
        return validateWithTrigger(reg, row, batch, phase3cTrigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    const phase4a1Trigger = getPhase4a1SpellTrigger(row.id);
    if (phase4a1Trigger) {
        return validateWithTrigger(reg, row, batch, phase4a1Trigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    const phase4a2Trigger = getPhase4a2SpellTrigger(row.id);
    if (phase4a2Trigger) {
        return validateWithTrigger(reg, row, batch, phase4a2Trigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    const phase4a3Trigger = getPhase4a3AlchemyTrigger(row.id);
    if (phase4a3Trigger) {
        return validateWithTrigger(reg, row, batch, phase4a3Trigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    const phase4bCoreTrigger = getPhase4bCoreSpellTrigger(row.id);
    if (phase4bCoreTrigger) {
        return validateWithTrigger(reg, row, batch, phase4bCoreTrigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    const phase6bTrigger = getPhase6bCollectionTrigger(row.id);
    if (phase6bTrigger) {
        return validateWithTrigger(reg, row, batch, phase6bTrigger, {
            requireSpawn: false,
            requireObtainable: false,
        });
    }
    switch (batch) {
        case "skills":
            return validateSkills(reg, row);
        case "combat":
            return validateCombat(reg, row);
        case "bosses":
            return validateBosses(reg, row);
        case "minigames":
            return validateMinigames(reg, row);
        case "collection":
            return validateCollection(reg, row);
        case "quests":
            return validateQuests(reg, row);
        default:
            return validateMisc(reg, row);
    }
}

export function findDuplicates(tasks: CsvTaskRow[]): Map<number, number> {
    const fingerprintToId = new Map<string, number>();
    const duplicateOf = new Map<number, number>();
    for (const row of tasks) {
        const fp = `${categorizeTask(row)}|${registriesFingerprint(row)}`;
        const existing = fingerprintToId.get(fp);
        if (existing !== undefined) {
            duplicateOf.set(row.id, existing);
        } else {
            fingerprintToId.set(fp, row.id);
        }
    }
    return duplicateOf;
}

function registriesFingerprint(row: CsvTaskRow): string {
    return row.name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function applyDuplicateStatus(
    rows: ValidationRow[],
    duplicateOf: Map<number, number>,
): ValidationRow[] {
    return rows.map((r) => {
        const dup = duplicateOf.get(r.task_id);
        if (dup === undefined) return r;
        return {
            ...r,
            status: "duplicate",
            missing_requirement: `duplicate of task ${dup}`,
            suggested_fix: `Remove or differentiate from task ${dup}`,
        };
    });
}
