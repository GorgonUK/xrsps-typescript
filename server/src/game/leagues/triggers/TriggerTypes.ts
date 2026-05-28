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
    regionIds: number[];
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
    | QuestCompleteTrigger
    | LevelReachTrigger
    | TotalLevelReachTrigger
    | XpReachTrigger
    | XpGainTrigger
    | AreaEnterTrigger
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

export type TaskEvent = NpcKillEvent | ItemEquipEvent | ItemObtainEvent | ItemCraftEvent;
