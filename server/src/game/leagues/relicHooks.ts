/**
 * Server-side relic hook helpers.
 *
 * Existing skill code (mining/fishing/woodcutting/hunter/herblore/thieving/run-
 * energy) only ever calls into this file — never the relic predicates or
 * configs directly — so the touchpoints across skills are minimal and a future
 * relic can plug into the same hooks without re-editing those skills.
 *
 * The hooks are intentionally null-safe: when no relic is selected they fast-
 * exit with the "no-op" return (false / undefined / 1.0 multiplier), so they
 * are cheap to call from hot paths like the per-step run-energy drain.
 */

import {
    hasCornerCutterRelic,
    hasDodgyDealsRelic,
    hasFriendlyForagerRelic,
    type LeagueRelicPlayer,
} from "../../../../src/shared/leagues/leagueRelicEffects";
import {
    CORNER_CUTTER_CONFIG,
    DODGY_DEALS_CONFIG,
    FRIENDLY_FORAGER_CONFIG,
} from "../../../../src/shared/leagues/leagueTier2Relics";
import {
    type ForagerPouchEntry,
    type ForagerPouchHolder,
    isForagerPouchItem,
    tryConsumeForagerPouchSecondary,
    tryStoreToForagerPouch,
} from "./foragerPouch";

type RelicPlayer = LeagueRelicPlayer & ForagerPouchHolder;

// ---------------------------------------------------------------------------
// Friendly Forager hooks
// ---------------------------------------------------------------------------

export interface ForagerRouteResult {
    /** Quantity that was diverted into the pouch. */
    routed: number;
    /** Quantity that should still be granted via the normal inventory path. */
    remaining: number;
}

/**
 * Gather hook (Mining / Fishing / Woodcutting / Hunter): when Friendly Forager
 * is active and the gathered item is a pouch-eligible herb/secondary, route
 * as much of the stack as possible into the Forager's Pouch. The caller should
 * use `remaining` to decide how many to add via addItemToInventory.
 */
export function onGatherItemForRelics(
    player: RelicPlayer,
    itemId: number,
    quantity: number,
): ForagerRouteResult {
    if (quantity <= 0 || !hasFriendlyForagerRelic(player)) {
        return { routed: 0, remaining: Math.max(0, quantity) };
    }
    if (!FRIENDLY_FORAGER_CONFIG.autoStoreOnGather) {
        return { routed: 0, remaining: quantity };
    }
    if (!isForagerPouchItem(itemId)) {
        return { routed: 0, remaining: quantity };
    }
    const { stored, remaining } = tryStoreToForagerPouch(player, itemId, quantity);
    return { routed: stored, remaining };
}

export type PotionCraftConsumeResult = "consumed_inventory" | "saved_relic" | "saved_pouch";

/**
 * Herblore hook: invoked once per secondary required to make a potion.
 * Returns:
 *   - "consumed_inventory" — caller must consume the secondary slot as normal.
 *   - "saved_pouch"        — the pouch had a stored copy and consumed it instead.
 *   - "saved_relic"        — Friendly Forager save chance hit; caller should
 *                            skip the inventory consume.
 */
export function onPotionCraftSecondary(
    player: RelicPlayer,
    secondaryItemId: number,
): PotionCraftConsumeResult {
    if (!hasFriendlyForagerRelic(player)) return "consumed_inventory";
    if (tryConsumeForagerPouchSecondary(player, secondaryItemId)) {
        return "saved_pouch";
    }
    if (Math.random() < FRIENDLY_FORAGER_CONFIG.secondarySaveChance) {
        return "saved_relic";
    }
    return "consumed_inventory";
}

/**
 * Returns true if Friendly Forager's "extra dose / extra product" roll fires
 * for the current potion craft.
 */
export function shouldGrantForagerBonusPotion(player: RelicPlayer): boolean {
    if (!hasFriendlyForagerRelic(player)) return false;
    return Math.random() < FRIENDLY_FORAGER_CONFIG.bonusPotionChance;
}

export function getForagerPouchSnapshot(player: RelicPlayer): ForagerPouchEntry[] {
    return player.foragerPouch?.entries() ?? [];
}

// ---------------------------------------------------------------------------
// Corner Cutter hooks
// ---------------------------------------------------------------------------

/**
 * Returns the multiplier to apply on top of the player's normal run-energy
 * drain. 1.0 = no change. Lower values mean run lasts longer. Stacks
 * multiplicatively with the existing stamina-effect drain multiplier.
 */
export function getRelicRunEnergyDrainMultiplier(player: RelicPlayer): number {
    if (hasCornerCutterRelic(player)) {
        return CORNER_CUTTER_CONFIG.runEnergyDrainMultiplier;
    }
    return 1;
}

/**
 * Agility XP hook: scales an XP award when Corner Cutter is selected. The
 * caller is responsible for awarding the (returned) modified XP.
 */
export function applyAgilityXpRelicBonus(player: RelicPlayer, baseXp: number): number {
    if (!hasCornerCutterRelic(player)) return baseXp;
    return baseXp * CORNER_CUTTER_CONFIG.agilityXpMultiplier;
}

/**
 * Tick-delay hook for agility obstacles. Returns a modified delay (rounded
 * down to whole ticks, minimum 1 tick) when Corner Cutter is selected.
 */
export function applyAgilityObstacleDelayMultiplier(
    player: RelicPlayer,
    baseDelayTicks: number,
): number {
    if (baseDelayTicks <= 0) return baseDelayTicks;
    if (!hasCornerCutterRelic(player)) return baseDelayTicks;
    const next = Math.floor(baseDelayTicks * CORNER_CUTTER_CONFIG.obstacleDelayMultiplier);
    return Math.max(1, next);
}

/**
 * Per-obstacle bonus reward roll. Returns true if the bonus reward chance
 * fires this tick. Callers supply their own bonus reward table; this hook
 * just gates the roll behind the relic.
 */
export function rollAgilityObstacleBonusReward(player: RelicPlayer): boolean {
    if (!hasCornerCutterRelic(player)) return false;
    return Math.random() < CORNER_CUTTER_CONFIG.bonusRewardChance;
}

// ---------------------------------------------------------------------------
// Dodgy Deals hooks
// ---------------------------------------------------------------------------

/**
 * Returns true if a pickpocket attempt should always succeed (bypassing the
 * normal level-vs-target roll) due to the Dodgy Deals relic.
 */
export function shouldPickpocketAlwaysSucceed(player: RelicPlayer): boolean {
    if (!hasDodgyDealsRelic(player)) return false;
    return DODGY_DEALS_CONFIG.pickpocketAlwaysSucceeds;
}

/**
 * Returns true if Dodgy Deals' "extra loot" roll fires on this pickpocket
 * success. Callers grant an additional loot roll on top of the normal reward.
 */
export function shouldRollPickpocketExtraLoot(player: RelicPlayer): boolean {
    if (!hasDodgyDealsRelic(player)) return false;
    return Math.random() < DODGY_DEALS_CONFIG.extraLootChance;
}

/**
 * Returns true if Dodgy Deals' auto-store-coins behaviour is active. When
 * true, pickpocket coin rewards bypass the coin-pouch consumable and credit
 * directly to the inventory.
 */
export function shouldAutoStorePickpocketCoins(player: RelicPlayer): boolean {
    if (!hasDodgyDealsRelic(player)) return false;
    return DODGY_DEALS_CONFIG.autoStoreCoins;
}

/**
 * Returns the thieving speed multiplier (>1 = faster). Callers should divide
 * cooldown ticks by this value (and floor / clamp to >=1 tick).
 */
export function getThievingSpeedMultiplier(player: RelicPlayer): number {
    if (!hasDodgyDealsRelic(player)) return 1;
    return Math.max(1, DODGY_DEALS_CONFIG.thievingSpeedMultiplier);
}

/**
 * Helper for thieving phase scheduling: divides a tick delay by the relic's
 * thieving speed multiplier and rounds down (clamped at 1 tick minimum).
 */
export function applyThievingSpeedMultiplier(
    player: RelicPlayer,
    baseDelayTicks: number,
): number {
    if (baseDelayTicks <= 0) return baseDelayTicks;
    const mult = getThievingSpeedMultiplier(player);
    if (mult <= 1) return baseDelayTicks;
    return Math.max(1, Math.floor(baseDelayTicks / mult));
}
