import type { CsvTaskRow } from "./types";
import type { ValidationRow } from "./types";

export type HookRoadmapType =
    | "npc_kill"
    | "boss_kill"
    | "item_obtain"
    | "item_equip"
    | "skilling_action"
    | "skilling_level"
    | "minigame_completion"
    | "raid_completion"
    | "quest_completion"
    | "area_entry"
    | "collection_log"
    | "shop_purchase"
    | "clue_completion"
    | "other";

const BOSS_PATTERN =
    /\b(zulrah|vorkath|cerberus|kraken|king black dragon|chaos elemental|chaos fanatic|crazy archaeologist|scorpia|callisto|vet'ion|venenatis|revenant|barrows|tztok|tzkal|corporeal|duke sucellus|leviathan|whisperer|vardorvis|phantom muspah|araxxor|hueycoatl|amoxliatl|scurrius|demonic gorilla|giant mole|kalphite queen|nex|god wars|sarachnis|bryophyta|deranged archaeologist|nightmare|corp|sire|hydra|grotesque|jad|zuk|sol heredit|hunllef|xeric|theatre of blood|tombs of amascut|chambers of xeric)\b/i;

const RAID_PATTERN =
    /\b(chambers of xeric|theatre of blood|tombs of amascut|raid)\b/i;

const MINIGAME_PATTERN =
    /\b(pest control|castle wars|soul wars|barbarian assault|wintertodt|tempoross|guardians of the rift|blast furnace|pyramid plunder|rogues'? den|mage training arena|fight caves|inferno|last man standing|volcanic mine|mahogany homes|nightmare zone|penguin agility)\b/i;

const SKILL_LEVEL_PATTERN =
    /^(achieve your first level|base level|reach level|reach total level|obtain \d+ million)/i;

const SKILL_ACTION_PATTERN =
    /^(chop|mine|catch|fish|burn|cook|craft|smith|fletch|make|clean|create|brew|plant|harvest|pick|string|add|combine|unfinished|steal|pickpocket|complete \d+ slayer|slayer task|learn a slayer|block a slayer|skip a slayer|receive a task from)/i;

export type SkippedTaskEntry = {
    task_id: number;
    task_name: string;
    area: string;
    difficulty: string;
    points: number;
    batch: string;
    matched_content: string;
    matched_hook: string;
    missing_requirement: string;
    suggested_fix: string;
};

export type HookRoadmapEntry = SkippedTaskEntry & {
    inferred_hook_type: HookRoadmapType;
};

export function inferHookRoadmapType(task: CsvTaskRow): HookRoadmapType {
    const name = task.name.trim();

    if (RAID_PATTERN.test(name)) return "raid_completion";
    if (MINIGAME_PATTERN.test(name)) return "minigame_completion";
    if (/\bcollection log\b/i.test(name)) return "collection_log";
    if (/\bclue scroll\b/i.test(name)) return "clue_completion";
    if (/\bcomplete\b/i.test(name) && /\b(quest|diary)\b/i.test(name)) return "quest_completion";
    if (/^enter\b/i.test(name)) return "area_entry";
    if (/^buy\b/i.test(name)) return "shop_purchase";
    if (/^(defeat|kill|slay)\b/i.test(name) && BOSS_PATTERN.test(name)) return "boss_kill";
    if (/^(defeat|kill|slay)\b/i.test(name)) return "npc_kill";
    if (/^(equip|wear)\b/i.test(name)) return "item_equip";
    if (/^(obtain|loot|receive|get)\b/i.test(name)) return "item_obtain";
    if (SKILL_LEVEL_PATTERN.test(name)) return "skilling_level";
    if (SKILL_ACTION_PATTERN.test(name)) return "skilling_action";
    if (/^(speak to|talk to|use |fill |ride |recharge )\b/i.test(name)) return "other";
    return "other";
}

export function buildHookRoadmap(
    needHookTasks: Array<{ csv: CsvTaskRow; validation: ValidationRow }>,
): {
    byHookType: Record<HookRoadmapType, HookRoadmapEntry[]>;
    counts: Record<HookRoadmapType, number>;
} {
    const byHookType = {} as Record<HookRoadmapType, HookRoadmapEntry[]>;
    const counts = {} as Record<HookRoadmapType, number>;

    for (const { csv, validation } of needHookTasks) {
        const hookType = inferHookRoadmapType(csv);
        const entry: HookRoadmapEntry = {
            task_id: csv.id,
            task_name: csv.name,
            area: csv.area,
            difficulty: csv.difficulty,
            points: csv.points,
            batch: validation.batch,
            matched_content: validation.matched_content,
            matched_hook: validation.matched_hook,
            missing_requirement: validation.missing_requirement,
            suggested_fix: validation.suggested_fix,
            inferred_hook_type: hookType,
        };
        if (!byHookType[hookType]) byHookType[hookType] = [];
        byHookType[hookType].push(entry);
        counts[hookType] = (counts[hookType] ?? 0) + 1;
    }

    for (const key of Object.keys(byHookType) as HookRoadmapType[]) {
        byHookType[key].sort((a, b) => a.task_id - b.task_id);
    }

    return { byHookType, counts };
}

export const GENERIC_HOOK_IMPLEMENTATION_HINTS: Record<HookRoadmapType, string> = {
    npc_kill: "LeagueTaskManager.onNpcKill (wired) — ensure NPC spawn + single id mapping",
    boss_kill: "onNpcKill on boss death + instance encounter completion",
    item_obtain: "LeagueTaskManager.onItemObtain (wired) — fire on inventory add from drops/skills",
    item_equip: "LeagueTaskManager.onItemEquip (wired) — fire on wear",
    skilling_action:
        "Central skilling success hook (after XP/item grant): emit item_obtain/item_craft or custom skilling_action",
    skilling_level: "LeagueTaskManager.syncSkillProgressTasks (wired) — normalize task names for parser",
    minigame_completion: "completeLeagueTask in minigame reward/completion scripts",
    raid_completion: "completeLeagueTask on raid chest/personal rewards",
    quest_completion: "Quest completion event → completeLeagueTask or quest_complete trigger",
    area_entry: "Region/area enter detector → area_enter trigger or script_manual",
    collection_log: "Collection log add event → completeLeagueTask",
    shop_purchase: "Shop buy success → item_obtain or shop_purchase hook",
    clue_completion: "Clue casket open → completeLeagueTask",
    other: "Per-interaction script_manual or dialogue/object hook",
};
