import { parseTaskTrigger } from "../../../src/game/leagues/triggers/TriggerParser";
import type { TaskTrigger } from "../../../src/game/leagues/triggers/TriggerTypes";

import { categorizeTask } from "./categorize";
import {
    extractItemTargetFromTask,
    extractNpcTargetFromKillTask,
    extractPickpocketTarget,
    normalizeTaskNameForParser,
} from "./normalize";
import type { ValidationRegistries } from "./registries";
import type { CsvTaskRow, TaskBatch, TaskStatus, ValidationRow } from "./types";

const WIRED_HOOKS: Record<string, string> = {
    npc_kill: "LeagueTaskManager.onNpcKill",
    item_equip: "LeagueTaskManager.onItemEquip",
    item_obtain: "LeagueTaskManager.onItemObtain",
    item_craft: "LeagueTaskManager.onItemCraft",
    level_reach: "LeagueTaskManager.syncSkillProgressTasks",
    total_level_reach: "LeagueTaskManager.syncSkillProgressTasks",
    xp_reach: "LeagueTaskManager.syncSkillProgressTasks",
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
        case "xp_reach":
            return result(
                row,
                batch,
                "ready",
                `trigger:${trigger.type}`,
                hook,
                "",
                "",
            );
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
