import type { CsvTaskRow, TaskBatch } from "./types";

const MINIGAME_PATTERNS: RegExp[] = [
    /\bpest control\b/i,
    /\bcastle wars\b/i,
    /\bsoul wars\b/i,
    /\bbarbarian assault\b/i,
    /\bwintertodt\b/i,
    /\btempoross\b/i,
    /\bguardians of the rift\b/i,
    /\bblast furnace\b/i,
    /\bpyramid plunder\b/i,
    /\brogues'? den\b/i,
    /\bmage training arena\b/i,
    /\bfight caves\b/i,
    /\binferno\b/i,
    /\bchambers of xeric\b/i,
    /\btheatre of blood\b/i,
    /\btombs of amascut\b/i,
    /\blast man standing\b/i,
    /\bvolcanic mine\b/i,
    /\bmahogany homes\b/i,
    /\bshooting stars?\b/i,
    /\bnightmare zone\b/i,
    /\bclan wars\b/i,
    /\bbrimhaven agility\b/i,
    /\bpenguin agility\b/i,
];

const BOSS_PATTERNS: RegExp[] = [
    /\bzulrah\b/i,
    /\bvorkath\b/i,
    /\bcerberus\b/i,
    /\bkraken\b/i,
    /\bking black dragon\b/i,
    /\bkbd\b/i,
    /\bchaos elemental\b/i,
    /\bchaos fanatic\b/i,
    /\bcrazy archaeologist\b/i,
    /\bscorpia\b/i,
    /\bcallisto\b/i,
    /\bvet'?ion\b/i,
    /\bvenenatis\b/i,
    /\brevenant\b/i,
    /\bbarrows\b/i,
    /\btztok\b/i,
    /\btzkal\b/i,
    /\bcorporeal\b/i,
    /\bcerberus\b/i,
    /\bthermonuclear\b/i,
    /\bduct\b/i,
    /\bduke sucellus\b/i,
    /\bthe leviathan\b/i,
    /\bthe whisperer\b/i,
    /\bvardorvis\b/i,
    /\bphantom muspah\b/i,
    /\baraxxor\b/i,
    /\bhueycoatl\b/i,
    /\bamoxliatl\b/i,
    /\bscurrius\b/i,
    /\bdemonic gorilla\b/i,
    /\bgiant mole\b/i,
    /\bkalphite queen\b/i,
    /\bnex\b/i,
    /\bgod wars\b/i,
    /\bcommander zilyana\b/i,
    /\bgeneral graardor\b/i,
    /\bkree'?arra\b/i,
    /\bkril\b/i,
    /\bnightmare\b/i,
    /\bphosani\b/i,
    /\bsarachnis\b/i,
    /\bamoxliatl\b/i,
    /\bolm\b/i,
    /\bxeric\b/i,
    /\braid\b/i,
    /\bwildy boss\b/i,
    /\bderanged archaeologist\b/i,
    /\bbrutal black dragon\b/i,
    /\bskeletal wyvern\b/i,
    /\bcorrupted hunllef\b/i,
    /\bhunllef\b/i,
];

const QUEST_AREA_PATTERNS: RegExp[] = [
    /\bcomplete the .+ quest\b/i,
    /\bcomplete .+ diary\b/i,
    /\bachievement diary\b/i,
    /\bquest point\b/i,
    /\bminiquest\b/i,
];

const COLLECTION_PATTERNS: RegExp[] = [
    /^obtain\b/i,
    /^equip\b/i,
    /^wear\b/i,
    /\bcollection log\b/i,
    /\bpet\b/i,
    /\bunique drop\b/i,
    /\bclue scroll\b/i,
    /\bcasket\b/i,
];

const SKILL_PATTERNS: RegExp[] = [
    /^achieve your first level\b/i,
    /^base level\b/i,
    /^reach level\b/i,
    /^reach total level\b/i,
    /^obtain \d+ million\b/i,
    /^(chop|mine|catch|fish|burn|cook|craft|smith|fletch|make|clean|create|brew|plant|harvest|pick)\b/i,
    /\bslayer task\b/i,
    /\bslayer helmet\b/i,
    /\brunecraft\b/i,
    /\bherblore\b/i,
    /\bagility course\b/i,
    /\blap of\b/i,
    /\bhunter\b/i,
    /\bfarming\b/i,
    /\bprayer\b/i,
    /\bconstruction\b/i,
    /^string \d+ bows\b/i,
];

const COMBAT_PATTERNS: RegExp[] = [/^(defeat|kill|slay)\b/i];

/**
 * Assign each task to exactly one validation batch (priority order).
 */
export function categorizeTask(row: CsvTaskRow): TaskBatch {
    const name = row.name.trim();

    if (QUEST_AREA_PATTERNS.some((p) => p.test(name))) return "quests";
    if (/\benter\b/i.test(name) && row.area !== "General") return "quests";
    if (MINIGAME_PATTERNS.some((p) => p.test(name))) return "minigames";
    if (/\bcomplete\b/i.test(name) && MINIGAME_PATTERNS.some((p) => p.test(name))) return "minigames";

    if (COLLECTION_PATTERNS.some((p) => p.test(name))) return "collection";
    if (/\bcomplete\b/i.test(name) && /\bcollection log\b/i.test(name)) return "collection";

    if (COMBAT_PATTERNS.some((p) => p.test(name)) && BOSS_PATTERNS.some((p) => p.test(name))) {
        return "bosses";
    }

    if (SKILL_PATTERNS.some((p) => p.test(name))) return "skills";
    if (/\bpickpocket\b/i.test(name) || /\bsteal from\b/i.test(name)) return "skills";

    if (COMBAT_PATTERNS.some((p) => p.test(name))) return "combat";

    if (/\benter\b/i.test(name) || /\bspeak to\b/i.test(name) || /\buse the\b/i.test(name)) {
        return "quests";
    }

    return "misc";
}
