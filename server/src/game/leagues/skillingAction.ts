/**
 * League task skilling_action event keys (skill + verb + product/target item id).
 */
export const SKILLING_ACTION_SKILLS = {
    mining: "mining",
    fishing: "fishing",
    woodcutting: "woodcutting",
    firemaking: "firemaking",
    cooking: "cooking",
    fletching: "fletching",
    smithing: "smithing",
    crafting: "crafting",
    thieving: "thieving",
} as const;

export type SkillingActionSkill = (typeof SKILLING_ACTION_SKILLS)[keyof typeof SKILLING_ACTION_SKILLS];

export const SKILLING_ACTION_VERBS = {
    mine: "mine",
    catch: "catch",
    chop: "chop",
    burn: "burn",
    cook: "cook",
    fletch: "fletch",
    smith: "smith",
    spin: "spin",
    pickpocket: "pickpocket",
} as const;

export type SkillingActionVerb = (typeof SKILLING_ACTION_VERBS)[keyof typeof SKILLING_ACTION_VERBS];

export function skillingActionIndexKey(skill: string, action: string, targetId: number): string {
    return `${skill}:${action}:${targetId | 0}`;
}
