/**
 * Shared helpers for the Leagues V tier-1 and tier-2 relics.
 *
 * Tier 1 (struct order, key = 1-based position in the tier-1 relic enum):
 *   - Power Miner       (relic key 1, struct_1117, grants Echo pickaxe)
 *   - Animal Wrangler   (relic key 2, struct_1118, grants Echo harpoon)
 *   - Lumberjack        (relic key 3, struct_1119, grants Echo axe)
 *
 * Tier 2 (struct order, key = 1-based position in the tier-2 relic enum):
 *   - Clue Compass      (relic key 1, struct_1120, teleport)
 *   - Bank Heist        (relic key 2, struct_1121, teleport)
 *   - Corner Cutter     (relic key 3, struct_1123, agility passive)
 *   - Friendly Forager  (relic key 4, struct_1124, herblore + gather pouch)
 *   - Dodgy Deals       (relic key 5, struct_1125, thieving passive)
 *
 * Tier-1 selection is stored in VARBIT_LEAGUE_RELIC_1 (10049).
 * Tier-2 selection is stored in VARBIT_LEAGUE_RELIC_2 (10050).
 *
 * The Echo tool reward objs (param_2049 on each tier-1 relic struct) are:
 *   - league_trailblazer_axe      = 25110
 *   - league_trailblazer_pickaxe  = 25112
 *   - league_trailblazer_harpoon  = 25114
 *
 * Tool toggle varbits (2 bits each, base varp 2804):
 *   - VARBIT_LEAGUE_TOOL_TOGGLE_MINING       bit 0 = auto-smelt, bit 1 = auto-cut gems
 *   - VARBIT_LEAGUE_TOOL_TOGGLE_WOODCUTTING  bit 0 = auto-burn,  bit 1 = auto-fletch
 *   - VARBIT_LEAGUE_TOOL_TOGGLE_FISHING      bit 0 = auto-cook
 *
 * Adding a new tier:
 *   1. Add the tier's relic-key constants to a `LeagueRelicTierNKey` map below.
 *   2. Add `has<Name>Relic(player)` predicate(s) that read the tier varbit.
 *   3. Add hook helpers (in server/src/game/leagues/...) that consume the predicates.
 *
 * No effect logic should hardcode varbit values directly; everything funnels
 * through these helpers so that tier varbits stay configurable.
 */
import {
    VARBIT_LEAGUE_RELIC_1,
    VARBIT_LEAGUE_RELIC_2,
    VARBIT_LEAGUE_RELIC_3,
    VARBIT_LEAGUE_RELIC_4,
    VARBIT_LEAGUE_RELIC_5,
    VARBIT_LEAGUE_RELIC_6,
    VARBIT_LEAGUE_RELIC_7,
    VARBIT_LEAGUE_RELIC_8,
    VARBIT_LEAGUE_TOOL_TOGGLE_FISHING,
    VARBIT_LEAGUE_TOOL_TOGGLE_MINING,
    VARBIT_LEAGUE_TOOL_TOGGLE_WOODCUTTING,
} from "../vars";

/** All 8 tier varbits (tier 1 .. tier 8). */
export const LEAGUE_RELIC_TIER_VARBITS: readonly number[] = [
    VARBIT_LEAGUE_RELIC_1,
    VARBIT_LEAGUE_RELIC_2,
    VARBIT_LEAGUE_RELIC_3,
    VARBIT_LEAGUE_RELIC_4,
    VARBIT_LEAGUE_RELIC_5,
    VARBIT_LEAGUE_RELIC_6,
    VARBIT_LEAGUE_RELIC_7,
    VARBIT_LEAGUE_RELIC_8,
] as const;

/** Tier-1 relic keys (1-based enum positions inside the tier-1 relic enum). */
export const LeagueRelicTier1Key = Object.freeze({
    POWER_MINER: 1,
    ANIMAL_WRANGLER: 2,
    LUMBERJACK: 3,
} as const);
export type LeagueRelicTier1Key = (typeof LeagueRelicTier1Key)[keyof typeof LeagueRelicTier1Key];

/**
 * Tier-2 relic keys (1-based enum positions inside the tier-2 relic enum).
 * The cache enum order is: 1=Clue Compass, 2=Bank Heist, 3=Corner Cutter,
 * 4=Friendly Forager, 5=Dodgy Deals (struct ids 1120, 1121, 1123, 1124, 1125).
 */
export const LeagueRelicTier2Key = Object.freeze({
    CLUE_COMPASS: 1,
    BANK_HEIST: 2,
    CORNER_CUTTER: 3,
    FRIENDLY_FORAGER: 4,
    DODGY_DEALS: 5,
} as const);
export type LeagueRelicTier2Key = (typeof LeagueRelicTier2Key)[keyof typeof LeagueRelicTier2Key];

/** Echo tool item ids granted by tier-1 relic selection (param_2049 on the relic struct). */
export const ECHO_AXE_ITEM_ID = 25110;
export const ECHO_PICKAXE_ITEM_ID = 25112;
export const ECHO_HARPOON_ITEM_ID = 25114;

/** Toggle bit masks (relative to the relic toggle varbit value). */
export const LEAGUE_TOOL_TOGGLE_BIT = Object.freeze({
    /** Power Miner: auto-smelt ores into bars and grant Smithing XP. */
    MINING_AUTO_SMELT: 1 << 0,
    /** Power Miner: auto-cut gems and grant Crafting XP. */
    MINING_AUTO_CUT_GEMS: 1 << 1,
    /** Lumberjack: auto-burn logs and grant Firemaking XP. */
    WOODCUTTING_AUTO_BURN: 1 << 0,
    /** Lumberjack: auto-fletch logs into arrow shafts and grant Fletching XP. */
    WOODCUTTING_AUTO_FLETCH: 1 << 1,
    /** Animal Wrangler: 50% chance to auto-cook fish caught. */
    FISHING_AUTO_COOK: 1 << 0,
} as const);

export interface LeagueRelicPlayer {
    getVarbitValue?: (id: number) => number;
}

function getVarbit(player: LeagueRelicPlayer, varbitId: number): number {
    return player.getVarbitValue?.(varbitId) ?? 0;
}

/** Returns the relic key selected for the given tier (1..8), or 0 if none. */
export function getSelectedRelicKey(player: LeagueRelicPlayer, tierIndex: number): number {
    if (tierIndex < 0 || tierIndex >= LEAGUE_RELIC_TIER_VARBITS.length) return 0;
    return getVarbit(player, LEAGUE_RELIC_TIER_VARBITS[tierIndex]!);
}

/** Returns the tier-1 relic key selected (0 = none, 1=PowerMiner, 2=AnimalWrangler, 3=Lumberjack). */
export function getTier1RelicKey(player: LeagueRelicPlayer): number {
    return getVarbit(player, VARBIT_LEAGUE_RELIC_1);
}

export function hasPowerMinerRelic(player: LeagueRelicPlayer): boolean {
    return getTier1RelicKey(player) === LeagueRelicTier1Key.POWER_MINER;
}

export function hasAnimalWranglerRelic(player: LeagueRelicPlayer): boolean {
    return getTier1RelicKey(player) === LeagueRelicTier1Key.ANIMAL_WRANGLER;
}

export function hasLumberjackRelic(player: LeagueRelicPlayer): boolean {
    return getTier1RelicKey(player) === LeagueRelicTier1Key.LUMBERJACK;
}

export function getMiningToolToggle(player: LeagueRelicPlayer): number {
    return getVarbit(player, VARBIT_LEAGUE_TOOL_TOGGLE_MINING);
}

export function getWoodcuttingToolToggle(player: LeagueRelicPlayer): number {
    return getVarbit(player, VARBIT_LEAGUE_TOOL_TOGGLE_WOODCUTTING);
}

export function getFishingToolToggle(player: LeagueRelicPlayer): number {
    return getVarbit(player, VARBIT_LEAGUE_TOOL_TOGGLE_FISHING);
}

export function isPowerMinerAutoSmeltEnabled(player: LeagueRelicPlayer): boolean {
    if (!hasPowerMinerRelic(player)) return false;
    return (getMiningToolToggle(player) & LEAGUE_TOOL_TOGGLE_BIT.MINING_AUTO_SMELT) !== 0;
}

export function isPowerMinerAutoCutGemsEnabled(player: LeagueRelicPlayer): boolean {
    if (!hasPowerMinerRelic(player)) return false;
    return (getMiningToolToggle(player) & LEAGUE_TOOL_TOGGLE_BIT.MINING_AUTO_CUT_GEMS) !== 0;
}

export function isLumberjackAutoBurnEnabled(player: LeagueRelicPlayer): boolean {
    if (!hasLumberjackRelic(player)) return false;
    return (getWoodcuttingToolToggle(player) & LEAGUE_TOOL_TOGGLE_BIT.WOODCUTTING_AUTO_BURN) !== 0;
}

export function isLumberjackAutoFletchEnabled(player: LeagueRelicPlayer): boolean {
    if (!hasLumberjackRelic(player)) return false;
    return (
        (getWoodcuttingToolToggle(player) & LEAGUE_TOOL_TOGGLE_BIT.WOODCUTTING_AUTO_FLETCH) !== 0
    );
}

/**
 * Animal Wrangler's auto-cook fish effect.
 * OSRS parity: the 50% auto-cook chance is always on while the relic is selected (not toggleable).
 * The fishing toggle varbit is retained for future use (e.g. UX preferences) but is not gated here.
 */
export function isAnimalWranglerAutoCookEnabled(player: LeagueRelicPlayer): boolean {
    return hasAnimalWranglerRelic(player);
}

// ---------------------------------------------------------------------------
// Tier-2 helpers
// ---------------------------------------------------------------------------

/** Returns the tier-2 relic key selected (0 = none). See LeagueRelicTier2Key. */
export function getTier2RelicKey(player: LeagueRelicPlayer): number {
    return getVarbit(player, VARBIT_LEAGUE_RELIC_2);
}

export function hasCornerCutterRelic(player: LeagueRelicPlayer): boolean {
    return getTier2RelicKey(player) === LeagueRelicTier2Key.CORNER_CUTTER;
}

export function hasFriendlyForagerRelic(player: LeagueRelicPlayer): boolean {
    return getTier2RelicKey(player) === LeagueRelicTier2Key.FRIENDLY_FORAGER;
}

export function hasDodgyDealsRelic(player: LeagueRelicPlayer): boolean {
    return getTier2RelicKey(player) === LeagueRelicTier2Key.DODGY_DEALS;
}
