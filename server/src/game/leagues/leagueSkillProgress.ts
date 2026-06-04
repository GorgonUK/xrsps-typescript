/**
 * Evaluates league task triggers that depend on live skill XP / levels / total level.
 */
import { getLevelForXp, SKILL_IDS } from "../../../../src/rs/skill/skills";
import { type PlayerState, getDefaultSkillXpForPlayer } from "../player";
import type { TaskTrigger } from "./triggers/TriggerTypes";

export function playerMatchesSkillProgressTrigger(
    player: PlayerState,
    trigger: TaskTrigger,
): boolean {
    switch (trigger.type) {
        case "level_reach": {
            if (trigger.firstLevelUp) {
                for (const id of SKILL_IDS) {
                    const base = player.getSkill(id).baseLevel;
                    const start = getLevelForXp(getDefaultSkillXpForPlayer(id), { virtual: false });
                    if (base > start) return true;
                }
                return false;
            }
            if (trigger.allSkills) {
                for (const id of SKILL_IDS) {
                    if (player.getSkill(id).baseLevel < trigger.level) return false;
                }
                return true;
            }
            if (trigger.anySkill) {
                const excluded = new Set(trigger.excludedSkillIds ?? []);
                for (const id of SKILL_IDS) {
                    if (excluded.has(id)) continue;
                    const base = player.getSkill(id).baseLevel;
                    const start = getLevelForXp(getDefaultSkillXpForPlayer(id), { virtual: false });
                    // OSRS parity: starting HP 10 must not satisfy "first level N" milestones.
                    if (base >= trigger.level && base > start) return true;
                }
                return false;
            }
            if (trigger.skillId !== undefined) {
                return player.getSkill(trigger.skillId).baseLevel >= trigger.level;
            }
            return false;
        }
        case "total_level_reach":
            return player.skillTotal >= trigger.minTotalLevel;
        case "combat_level_reach":
            return player.combatLevel >= trigger.minCombatLevel;
        case "xp_reach":
            return player.getSkill(trigger.skillId).xp >= trigger.minXp;
        default:
            return false;
    }
}
