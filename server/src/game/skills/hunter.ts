/**
 * Hunter skill data definitions.
 *
 * Provides data-driven configuration for the Hunter skill:
 *   - Trap definitions  (item id, animation, loc transitions, lifetimes)
 *   - Creature definitions (npc type ids, required level, xp, loot, catch chance)
 *   - Helpers for catch chance rolls and trap-limit-by-level
 *
 * New Hunter methods (deadfall, butterfly net, snares, falconry, etc.) are added
 * by extending TRAP_DEFINITIONS and CREATURE_DEFINITIONS rather than the
 * surrounding system code. The state machine, scheduler and tick loop are all
 * type-agnostic.
 *
 * References:
 *   - https://oldschool.runescape.wiki/w/Hunter
 *   - Loc ids (Bird snare 9344-9379, Box trap 9380-9397, 50727)
 *   - NPC ids (hunting_bird_* 5549-5552, hunting_chinchompa 2910-2912, hunting_ferret 1505)
 */

export type HunterTrapType = "net_trap" | "box_trap";

/**
 * A trap definition describes the *item* a player uses to lay a trap and the
 * shared loc-id transitions a trap of this type goes through over its lifetime.
 * Per-creature loc ids (e.g. "full_jungle" bird snare) are part of
 * HunterCreatureDefinition since they vary by catch.
 */
export interface HunterTrapDefinition {
    /** Stable id used for serialization & lookup. */
    id: string;
    /** Display name shown to the player. */
    displayName: string;
    /** Type discriminator used to pair traps with creature definitions. */
    trapType: HunterTrapType;
    /** Item id the player consumes when laying / receives back when dismantling. */
    itemId: number;
    /** Minimum Hunter level required just to lay (use) this trap. */
    requiredHunterLevel: number;
    /** Loc id shown while the trap is armed (no creature inside). */
    armedLocId: number;
    /** Loc id shown when the trap fails (collapsed / triggered without catch). */
    failedLocId: number;
    /**
     * Chebyshev tile distance from the trap at which a committed creature
     * triggers the catch roll. OSRS parity is 0 (the creature must step
     * onto the trap tile itself); larger values trigger on adjacent tiles
     * and are reserved for hypothetical area traps (e.g. deadfalls).
     */
    triggerRadius: number;
    /**
     * Tile radius around the trap inside which valid creatures will be actively
     * lured toward the trap. Mirrors OSRS behavior where birds fly to snares
     * and small ground creatures wander into box traps. Should be larger than
     * triggerRadius. Set to 0 to disable luring (passive only).
     */
    attractionRadius: number;
    /**
     * How long a trap stays armed before naturally collapsing (in server ticks).
     * Mirrors OSRS hunter trap timeout (~60s for snares, ~75s for box traps).
     */
    lifetimeTicks: number;
    /**
     * How long an armed trap stays "warming up" before it can actually be triggered.
     * Provides player feedback and prevents instant self-trigger.
     */
    armTicks: number;
    /** Animation played when the player lays the trap. */
    layAnimation: number;
    /** Animation played when the player checks/dismantles a trap. */
    checkAnimation: number;
    /** How frequently the trap polls for nearby creatures (in server ticks). */
    pollIntervalTicks: number;
}

/**
 * A creature that can be caught by Hunter. Each creature definition is paired
 * with a trap type and references existing NPC type ids so the wandering NPCs
 * are spawned via the normal NpcManager pipeline.
 */
export interface HunterCreatureLootEntry {
    itemId: number;
    min: number;
    max: number;
    /** 0-1 probability that this entry is rolled into the rewards. */
    chance: number;
}

export interface HunterCreatureDefinition {
    id: string;
    displayName: string;
    /** Trap type this creature is caught by. */
    trapType: HunterTrapType;
    /** Cache NPC type ids that count as this creature in the world. */
    creatureNpcTypeIds: readonly number[];
    /** Minimum Hunter level required to attempt to catch this creature. */
    requiredHunterLevel: number;
    /** XP awarded when the player checks a successfully caught trap. */
    xp: number;
    /** Loc id shown when this creature is successfully caught inside the trap. */
    caughtLocId: number;
    /** Loot rolled and added to the player's inventory when the trap is checked. */
    lootTable: readonly HunterCreatureLootEntry[];
}

// =============================================================================
// Animation / Item / Loc id constants (sourced from r235 cache)
// =============================================================================

/** Player animation: hunting_setting_trap_small. */
const HUNTER_LAY_ANIMATION = 5212;
/** Player animation: human_hunting_dismantle_net. */
const HUNTER_CHECK_ANIMATION = 5207;

/** Bird snare item id (cache name: hunting_ojibway_bird_snare). */
export const BIRD_SNARE_ITEM_ID = 10006;
/** Box trap item id (cache name: hunting_box_trap). */
export const BOX_TRAP_ITEM_ID = 10008;

/** Bird snare loc ids. */
const BIRD_SNARE_ARMED_LOC = 9345; // hunting_ojibway_trap
const BIRD_SNARE_FAILED_LOC = 9344; // hunting_ojibway_trap_broken

/** Box trap loc ids. */
const BOX_TRAP_ARMED_LOC = 9380; // hunting_boxtrap_empty
const BOX_TRAP_FAILED_LOC = 9385; // hunting_boxtrap_failed

// =============================================================================
// Trap definitions
// =============================================================================

export const TRAP_DEFINITIONS: readonly HunterTrapDefinition[] = [
    {
        id: "net_trap",
        displayName: "Bird snare",
        trapType: "net_trap",
        itemId: BIRD_SNARE_ITEM_ID,
        requiredHunterLevel: 1,
        armedLocId: BIRD_SNARE_ARMED_LOC,
        failedLocId: BIRD_SNARE_FAILED_LOC,
        // OSRS: bird must step ONTO the snare tile to trigger.
        triggerRadius: 0,
        // Lured from up to ~7 tiles away. Birds in OSRS reliably fly to snares.
        attractionRadius: 7,
        // OSRS bird snares timeout after ~60 seconds = 100 ticks.
        lifetimeTicks: 100,
        // 2 ticks of arming so a creature standing on the lay tile doesn't insta-trigger.
        armTicks: 2,
        layAnimation: HUNTER_LAY_ANIMATION,
        checkAnimation: HUNTER_CHECK_ANIMATION,
        // Poll every tick so the catch fires the exact tick the bird arrives
        // on the snare tile — a 2-tick poll could miss the single tick the
        // NPC stands on the trap before pathing off again.
        pollIntervalTicks: 1,
    },
    {
        id: "box_trap",
        displayName: "Box trap",
        trapType: "box_trap",
        itemId: BOX_TRAP_ITEM_ID,
        requiredHunterLevel: 27,
        armedLocId: BOX_TRAP_ARMED_LOC,
        failedLocId: BOX_TRAP_FAILED_LOC,
        // OSRS: creature must step ONTO the box trap tile to trigger.
        triggerRadius: 0,
        // Ground creatures don't lure quite as aggressively as birds.
        attractionRadius: 5,
        lifetimeTicks: 125,
        armTicks: 2,
        layAnimation: HUNTER_LAY_ANIMATION,
        checkAnimation: HUNTER_CHECK_ANIMATION,
        // Poll every tick — same rationale as the bird snare; the chinchompa
        // is only on the trap for a single tick before its next path step.
        pollIntervalTicks: 1,
    },
];

const TRAP_BY_ID = new Map<string, HunterTrapDefinition>(
    TRAP_DEFINITIONS.map((trap) => [trap.id, trap]),
);
const TRAP_BY_ITEM_ID = new Map<number, HunterTrapDefinition>(
    TRAP_DEFINITIONS.map((trap) => [trap.itemId, trap]),
);
const TRAP_BY_LOC_ID = new Map<number, HunterTrapDefinition>();
for (const trap of TRAP_DEFINITIONS) {
    TRAP_BY_LOC_ID.set(trap.armedLocId, trap);
    TRAP_BY_LOC_ID.set(trap.failedLocId, trap);
}

export const getTrapDefinitionById = (id: string): HunterTrapDefinition | undefined =>
    TRAP_BY_ID.get(id);
export const getTrapDefinitionByItemId = (itemId: number): HunterTrapDefinition | undefined =>
    TRAP_BY_ITEM_ID.get(itemId);
export const getTrapDefinitionByLocId = (locId: number): HunterTrapDefinition | undefined =>
    TRAP_BY_LOC_ID.get(locId);

// =============================================================================
// Creature definitions
// =============================================================================

export const CREATURE_DEFINITIONS: readonly HunterCreatureDefinition[] = [
    // ---- Net trap (bird snare) ----
    {
        id: "crimson_swift",
        displayName: "Crimson swift",
        trapType: "net_trap",
        creatureNpcTypeIds: [5549], // hunting_bird_jungle
        requiredHunterLevel: 1,
        xp: 34,
        caughtLocId: 9373, // hunting_ojibway_trap_full_jungle
        lootTable: [{ itemId: 526, min: 1, max: 1, chance: 1.0 }], // bones
    },
    {
        id: "desert_lizard",
        displayName: "Desert lizard",
        trapType: "net_trap",
        // Reuse the desert hunter bird for V1 since the cache desert lizard is a
        // deadfall creature and only spawned via slayer locs. Keeps the system
        // visually correct (bird-style net catch) without introducing deadfall.
        creatureNpcTypeIds: [5551], // hunting_bird_desert
        requiredHunterLevel: 5,
        xp: 47,
        caughtLocId: 9377, // hunting_ojibway_trap_full_desert
        lootTable: [{ itemId: 314, min: 2, max: 4, chance: 1.0 }], // feathers
    },

    // ---- Box trap ----
    {
        id: "ferret",
        displayName: "Ferret",
        trapType: "box_trap",
        creatureNpcTypeIds: [1505], // hunting_ferret
        requiredHunterLevel: 27,
        xp: 115,
        caughtLocId: 9384, // hunting_boxtrap_full_ferret
        lootTable: [{ itemId: 10092, min: 1, max: 1, chance: 1.0 }], // hunting_ferret
    },
    {
        id: "chinchompa",
        displayName: "Chinchompa",
        trapType: "box_trap",
        creatureNpcTypeIds: [2910], // hunting_chinchompa (grey)
        requiredHunterLevel: 53,
        xp: 198.5,
        caughtLocId: 9382, // hunting_boxtrap_full_chinchompa
        lootTable: [{ itemId: 10033, min: 1, max: 1, chance: 1.0 }], // chinchompa_captured (grey)
    },
    {
        id: "carnivorous_chinchompa",
        displayName: "Carnivorous chinchompa",
        trapType: "box_trap",
        creatureNpcTypeIds: [2911], // hunting_chinchompa_big (red)
        requiredHunterLevel: 63,
        xp: 265,
        caughtLocId: 9383, // hunting_boxtrap_full_chinchompa_big
        lootTable: [{ itemId: 10034, min: 1, max: 1, chance: 1.0 }], // chinchompa_big_captured (red)
    },
    {
        id: "black_chinchompa",
        displayName: "Black chinchompa",
        trapType: "box_trap",
        creatureNpcTypeIds: [2912], // hunting_chinchompa_black
        requiredHunterLevel: 73,
        xp: 315,
        caughtLocId: 721, // hunting_boxtrap_full_chinchompa_black
        lootTable: [{ itemId: 11959, min: 1, max: 1, chance: 1.0 }], // chinchompa_black
    },
];

const CREATURE_BY_ID = new Map<string, HunterCreatureDefinition>(
    CREATURE_DEFINITIONS.map((c) => [c.id, c]),
);
const CREATURE_BY_NPC_TYPE_ID = new Map<number, HunterCreatureDefinition>();
for (const creature of CREATURE_DEFINITIONS) {
    for (const typeId of creature.creatureNpcTypeIds) {
        CREATURE_BY_NPC_TYPE_ID.set(typeId, creature);
    }
}

export const getCreatureDefinitionById = (id: string): HunterCreatureDefinition | undefined =>
    CREATURE_BY_ID.get(id);
export const getCreatureDefinitionByNpcTypeId = (
    npcTypeId: number,
): HunterCreatureDefinition | undefined => CREATURE_BY_NPC_TYPE_ID.get(npcTypeId);

/** League skilling_action hunter/catch target id (creature NPC type id). */
export const getLeagueHunterCatchTargetId = (creature: HunterCreatureDefinition): number =>
    creature.creatureNpcTypeIds[0] ?? 0;

export const getCreaturesForTrapType = (
    trapType: HunterTrapType,
): readonly HunterCreatureDefinition[] =>
    CREATURE_DEFINITIONS.filter((c) => c.trapType === trapType);

/**
 * Hunter creature NPC type ids the trap-trigger tick scans for. Building a
 * single set at module load keeps the per-tick scan cheap regardless of how
 * many creature definitions exist.
 */
export const HUNTER_CREATURE_NPC_TYPE_IDS: ReadonlySet<number> = new Set(
    Array.from(CREATURE_BY_NPC_TYPE_ID.keys()),
);

// =============================================================================
// Trap limit & catch chance
// =============================================================================

/**
 * Maximum number of traps a player can have placed at once, by Hunter level.
 * Matches the OSRS table (1 / 20 / 40 / 60 / 80).
 */
export const TRAP_LIMIT_TABLE: ReadonlyArray<{ minLevel: number; limit: number }> = [
    { minLevel: 80, limit: 5 },
    { minLevel: 60, limit: 4 },
    { minLevel: 40, limit: 3 },
    { minLevel: 20, limit: 2 },
    { minLevel: 1, limit: 1 },
];

export const getMaxActiveTrapsForLevel = (hunterLevel: number): number => {
    const level = Math.max(1, hunterLevel | 0);
    for (const entry of TRAP_LIMIT_TABLE) {
        if (level >= entry.minLevel) return entry.limit;
    }
    return 1;
};

/**
 * Roll catch chance.
 *
 * Formula (simple, easy to tune; matches the spec):
 *   - If playerLevel < requiredLevel, never succeeds.
 *   - Base 35% chance.
 *   - +2% per level above the requirement.
 *   - Box traps are slightly harder than net traps (-5% base).
 *   - Capped at 90%.
 */
export const computeCatchChance = (
    playerHunterLevel: number,
    creature: HunterCreatureDefinition,
    trap: HunterTrapDefinition,
): number => {
    if (playerHunterLevel < creature.requiredHunterLevel) return 0;
    const baseByTrap = trap.trapType === "box_trap" ? 0.3 : 0.35;
    const bonus = Math.max(0, playerHunterLevel - creature.requiredHunterLevel) * 0.02;
    return Math.max(0, Math.min(0.9, baseByTrap + bonus));
};

export const rollCatchSuccess = (
    playerHunterLevel: number,
    creature: HunterCreatureDefinition,
    trap: HunterTrapDefinition,
    random: () => number = Math.random,
): boolean => random() < computeCatchChance(playerHunterLevel, creature, trap);

/**
 * Roll the loot table for a caught creature. Each entry is independently
 * sampled against its chance and a random qty in [min, max] is selected.
 */
export const rollCreatureLoot = (
    creature: HunterCreatureDefinition,
    random: () => number = Math.random,
): Array<{ itemId: number; quantity: number }> => {
    const out: Array<{ itemId: number; quantity: number }> = [];
    for (const entry of creature.lootTable) {
        if (random() > entry.chance) continue;
        const min = Math.max(1, Math.floor(entry.min));
        const max = Math.max(min, Math.floor(entry.max));
        const qty = min === max ? min : min + Math.floor(random() * (max - min + 1));
        if (qty > 0) out.push({ itemId: entry.itemId, quantity: qty });
    }
    return out;
};

// =============================================================================
// All loc ids the scripts module needs to register handlers for
// =============================================================================

export const ALL_TRAP_LOC_IDS: readonly number[] = (() => {
    const ids = new Set<number>();
    for (const trap of TRAP_DEFINITIONS) {
        ids.add(trap.armedLocId);
        ids.add(trap.failedLocId);
    }
    for (const creature of CREATURE_DEFINITIONS) {
        ids.add(creature.caughtLocId);
    }
    return Array.from(ids);
})();
