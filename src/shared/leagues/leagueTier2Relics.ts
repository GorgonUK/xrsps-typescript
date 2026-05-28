/**
 * Data-driven configuration for the Leagues V tier-2 relic effects this server
 * implements. The cache (rev 235) defines the relic UI / structs / unlock
 * gating; this file owns ONLY the gameplay tunables (chances, multipliers,
 * pouch sizes, ...) so future relics or balance passes are an isolated edit
 * with no touchpoints across skill code.
 *
 * Adding a new tier-2 relic:
 *   1. Add the relic's key to LeagueRelicTier2Key in leagueRelicEffects.ts.
 *   2. Add a config block to LEAGUE_TIER2_RELIC_CONFIGS below.
 *   3. Add a has<Name>Relic predicate next to the existing tier-2 predicates.
 *   4. Wire any hook helpers in server/src/game/leagues/relics/* that consume
 *      the predicate; existing skills only see the hook helpers, not the
 *      relic key itself.
 */
import { LeagueRelicTier2Key } from "./leagueRelicEffects";

export interface FriendlyForagerConfig {
    readonly id: "friendly_forager";
    readonly displayName: string;
    /** Maximum stack count for any single item slot in the Forager's Pouch. */
    readonly pouchSize: number;
    /** Per-secondary-ingredient chance to NOT consume while crafting potions. */
    readonly secondarySaveChance: number;
    /** Chance for each created potion to roll an extra dose / extra product. */
    readonly bonusPotionChance: number;
    /** Auto-route grimy herbs and herblore secondaries from gather drops into the pouch. */
    readonly autoStoreOnGather: boolean;
}

export interface CornerCutterConfig {
    readonly id: "corner_cutter";
    readonly displayName: string;
    /** XP multiplier applied to Agility XP awards. */
    readonly agilityXpMultiplier: number;
    /** Tick-delay multiplier for agility obstacle cooldowns (lower = faster). */
    readonly obstacleDelayMultiplier: number;
    /** Per-obstacle chance to roll a bonus reward (Marks of Grace / coins / vouchers). */
    readonly bonusRewardChance: number;
    /** Multiplier applied to the player's run-energy drain (lower = drains slower). */
    readonly runEnergyDrainMultiplier: number;
}

export interface DodgyDealsConfig {
    readonly id: "dodgy_deals";
    readonly displayName: string;
    /** When true, every pickpocket attempt automatically succeeds. */
    readonly pickpocketAlwaysSucceeds: boolean;
    /** Multiplier applied to thieving action speed (>1 = faster). */
    readonly thievingSpeedMultiplier: number;
    /** Chance to roll an extra loot entry on top of the normal pickpocket reward. */
    readonly extraLootChance: number;
    /**
     * Auto-loot coins directly into the inventory / money pouch instead of
     * granting the coin pouch consumable.
     */
    readonly autoStoreCoins: boolean;
}

export type LeagueTier2RelicConfig =
    | FriendlyForagerConfig
    | CornerCutterConfig
    | DodgyDealsConfig;

/**
 * Default-tunable relic configs. The user-suggested values are used as
 * starting points; OSRS parity tuning (e.g. Friendly Forager's 90% secondary
 * save) can be applied here without touching the hook implementations.
 */
export const LEAGUE_TIER2_RELIC_CONFIGS: Readonly<{
    [LeagueRelicTier2Key.FRIENDLY_FORAGER]: FriendlyForagerConfig;
    [LeagueRelicTier2Key.CORNER_CUTTER]: CornerCutterConfig;
    [LeagueRelicTier2Key.DODGY_DEALS]: DodgyDealsConfig;
}> = Object.freeze({
    [LeagueRelicTier2Key.FRIENDLY_FORAGER]: Object.freeze({
        id: "friendly_forager",
        displayName: "Friendly Forager",
        pouchSize: 100,
        secondarySaveChance: 0.25,
        bonusPotionChance: 0.1,
        autoStoreOnGather: true,
    }),
    [LeagueRelicTier2Key.CORNER_CUTTER]: Object.freeze({
        id: "corner_cutter",
        displayName: "Corner Cutter",
        agilityXpMultiplier: 1.5,
        obstacleDelayMultiplier: 0.75,
        bonusRewardChance: 0.15,
        runEnergyDrainMultiplier: 0.8,
    }),
    [LeagueRelicTier2Key.DODGY_DEALS]: Object.freeze({
        id: "dodgy_deals",
        displayName: "Dodgy Deals",
        pickpocketAlwaysSucceeds: true,
        thievingSpeedMultiplier: 1.5,
        extraLootChance: 0.2,
        autoStoreCoins: true,
    }),
});

export const FRIENDLY_FORAGER_CONFIG = LEAGUE_TIER2_RELIC_CONFIGS[LeagueRelicTier2Key.FRIENDLY_FORAGER];
export const CORNER_CUTTER_CONFIG = LEAGUE_TIER2_RELIC_CONFIGS[LeagueRelicTier2Key.CORNER_CUTTER];
export const DODGY_DEALS_CONFIG = LEAGUE_TIER2_RELIC_CONFIGS[LeagueRelicTier2Key.DODGY_DEALS];
