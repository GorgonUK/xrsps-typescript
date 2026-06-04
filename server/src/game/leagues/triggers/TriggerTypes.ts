/**
 * League task trigger type definitions.
 * These define what event completes a task.
 */
import type { SkillId } from "../../../../../src/rs/skill/skills";

// Tier 1 - Direct ID lookup triggers
export type NpcKillTrigger = {
    type: "npc_kill";
    npcIds: number[];
    count?: number; // For "Kill 10 Goblins" style tasks
};

export type NpcKillCombatLevelTrigger = {
    type: "npc_kill_combat_level";
    minCombatLevel: number;
    count: number;
};

export type ItemEquipTrigger = {
    type: "item_equip";
    itemIds: number[];
};

export type ItemObtainTrigger = {
    type: "item_obtain";
    itemIds: number[];
    count?: number;
};

export type ItemCraftTrigger = {
    type: "item_craft";
    itemIds: number[];
    count?: number;
};

/** Successful skilling action (mine/catch/chop/cook/etc.) with explicit product item id. */
export type SkillingActionTrigger = {
    type: "skilling_action";
    skill: string;
    action: string;
    targetIds: number[];
    /** When set, the action must occur inside one of these AreaRegistry keys. */
    areaKeys?: string[];
    count?: number;
};

export type QuestCompleteTrigger = {
    type: "quest_complete";
    questId: number;
};

// Tier 2 - Skill / account progress (indexed; evaluated against live player skills)
export type LevelReachTrigger = {
    type: "level_reach";
    level: number;
    /** Specific skill must be at least `level` */
    skillId?: SkillId;
    /** Any non-excluded skill must be at least `level` */
    anySkill?: boolean;
    excludedSkillIds?: SkillId[];
    /** Every skill must be at least `level` */
    allSkills?: boolean;
    /** "Achieve Your First Level Up" — any skill above default starting level */
    firstLevelUp?: boolean;
};

export type TotalLevelReachTrigger = {
    type: "total_level_reach";
    minTotalLevel: number;
};

/** "Achieve Level N Combat" — evaluated against player.combatLevel (sync on login / skill XP). */
export type CombatLevelReachTrigger = {
    type: "combat_level_reach";
    minCombatLevel: number;
};

export type XpReachTrigger = {
    type: "xp_reach";
    skillId: SkillId;
    minXp: number;
};

export type XpGainTrigger = {
    type: "xp_gain";
    skillId: number;
    amount: number;
};

export type AreaEnterTrigger = {
    type: "area_enter";
    regionIds?: number[];
    areaKeys?: string[];
};

/** Cross into wilderness at or above minLevel (uses getWildernessLevel; no duplicate bounds). */
export type WildernessLevelTrigger = {
    type: "wilderness_level";
    minLevel: number;
};

/** Successful spell cast (combat/utility) or spellbook teleport. */
export type SpellCastTrigger = {
    type: "spell_cast";
    /** Match this exact spell id (from spells.ts). */
    spellId?: number;
    /** Match any of these spell ids (indexed under each id). */
    spellIdsAny?: number[];
    /** Match spells with this category (SpellDataEntry.category or teleport category). */
    spellCategory?: "combat" | "teleport" | "utility" | "binding";
    /** Match this teleport by name (teleportDestinations.ts). */
    teleportName?: string;
    /** Match any successful spell cast (combat, utility, teleport). */
    anySpell?: boolean;
    /** Match SpellDataEntry.spellbook on successful cast. */
    spellbook?: "standard" | "ancient" | "lunar" | "arceuus";
    /** Require caster tile inside one of these AreaRegistry keys when cast succeeds. */
    areaKeys?: string[];
    count?: number;
};

/** Collection log slot milestone or category page completion. */
export type CollectionLogTrigger = {
    type: "collection_log";
    milestone: "slot" | "page";
    /** Unique collection log slots obtained (milestone: slot). */
    minSlots?: number;
    /** Any page complete on this tab: 0=Bosses, 1=Raids, 2=Clues, 3=Minigames (milestone: page). */
    tabIndex?: number;
    /** Specific category struct id, e.g. Slayer=527 (milestone: page). */
    categoryStructId?: number;
};

// Tier 3 - Custom validator
export type CustomTrigger = {
    type: "custom";
    validator: string; // Name of registered validator function
};

// Union of all trigger types
export type TaskTrigger =
    | NpcKillTrigger
    | NpcKillCombatLevelTrigger
    | ItemEquipTrigger
    | ItemObtainTrigger
    | ItemCraftTrigger
    | SkillingActionTrigger
    | QuestCompleteTrigger
    | LevelReachTrigger
    | TotalLevelReachTrigger
    | CombatLevelReachTrigger
    | XpReachTrigger
    | XpGainTrigger
    | AreaEnterTrigger
    | WildernessLevelTrigger
    | SpellCastTrigger
    | CollectionLogTrigger
    | CustomTrigger;

// Event types emitted by game systems
export type NpcKillEvent = {
    type: "npc_kill";
    npcId: number;
    npcName: string;
    playerId: number;
};

export type ItemEquipEvent = {
    type: "item_equip";
    itemId: number;
    playerId: number;
};

export type ItemObtainEvent = {
    type: "item_obtain";
    itemId: number;
    count: number;
    playerId: number;
};

export type ItemCraftEvent = {
    type: "item_craft";
    itemId: number;
    count: number;
    playerId: number;
};

export type SkillingActionEvent = {
    type: "skilling_action";
    skill: string;
    action: string;
    targetId: number;
    count: number;
    playerId: number;
};

export type AreaEnterEvent = {
    type: "area_enter";
    areaKey?: string;
    regionId?: number;
    playerId: number;
};

export type WildernessLevelEvent = {
    type: "wilderness_level";
    minLevel: number;
    previousLevel: number;
    currentLevel: number;
    playerId: number;
};

export type SpellCastEvent = {
    type: "spell_cast";
    spellId?: number;
    spellCategory?: "combat" | "teleport" | "utility" | "binding";
    spellbook?: "standard" | "ancient" | "lunar" | "arceuus";
    teleportName?: string;
    playerId: number;
};

export type CollectionLogEvent = {
    type: "collection_log";
    itemId: number;
    playerId: number;
};

export type TaskEvent =
    | NpcKillEvent
    | ItemEquipEvent
    | ItemObtainEvent
    | ItemCraftEvent
    | SkillingActionEvent
    | AreaEnterEvent
    | WildernessLevelEvent
    | SpellCastEvent
    | CollectionLogEvent;
