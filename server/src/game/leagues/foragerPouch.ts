/**
 * Friendly Forager relic — Forager's Pouch storage system.
 *
 * The pouch is a per-player virtual container that auto-collects grimy herbs
 * (and herblore secondaries the relic supports) gathered from skilling. It
 * persists across sessions, is queryable via the Inspect helper, and is the
 * source feed for Friendly Forager's "secondary save" effect — when crafting
 * potions the relic can pull a saved secondary out of the pouch instead of
 * consuming one from the inventory.
 *
 * Design constraints:
 *   - Data-driven: the supported-item list lives in this file (FORAGER_POUCH_*),
 *     not in skill code, so adding a new gather drop or secondary is a single
 *     edit here.
 *   - Storage-only: this module owns NO skill logic. Mining/Fishing/Hunter/
 *     Herblore code talks to the pouch through `ForagerPouchStore` and reuses
 *     existing inventory/snapshot APIs around it.
 *   - Per-slot stack cap (`pouchSize` from the relic config) avoids the pouch
 *     becoming a substitute bank — gathering routes overflow back into the
 *     normal inventory just like OSRS.
 */

import { FRIENDLY_FORAGER_CONFIG } from "../../../../src/shared/leagues/leagueTier2Relics";

// ---------------------------------------------------------------------------
// Supported items (data-driven)
// ---------------------------------------------------------------------------

/**
 * Grimy herb item ids accepted by the pouch. Pulled from
 * server/src/game/scripts/modules/skills/herblore.ts CLEAN_LIST so the auto-
 * gather routing always matches the herblore module's known herbs.
 */
const GRIMY_HERB_IDS: readonly number[] = [
    199, // Grimy guam leaf
    201, // Grimy marrentill
    203, // Grimy tarromin
    205, // Grimy harralander
    207, // Grimy ranarr
    3049, // Grimy toadflax
    209, // Grimy irit
    211, // Grimy avantoe
    213, // Grimy kwuarm
    3051, // Grimy snapdragon
    215, // Grimy cadantine
    2485, // Grimy lantadyme
    217, // Grimy dwarf weed
    219, // Grimy torstol
];

/**
 * Herblore secondary ingredients the pouch accepts. Sourced from
 * server/src/game/scripts/modules/skills/herblore.ts FINISHED_LIST. These are
 * the items Friendly Forager's "secondary save" effect can pull out of the
 * pouch when crafting potions, and are the stackable feed targets for the
 * gather auto-route when a skill drops one of them.
 */
const HERBLORE_SECONDARY_IDS: readonly number[] = [
    221, // Eye of newt
    235, // Unicorn horn dust
    225, // Limpwurt root
    223, // Red spiders' eggs
    1975, // Chocolate dust
    239, // White berries
    2152, // Toad's legs
    9736, // Crushed superior dragon bone (combat potion proxy)
    231, // Snape grass
    241, // Wine of zamorak
    2970, // Mort myre fungus
    2150, // Swamp toad
    245, // Wine of zamorak / sub
    9735, // Crushed nest
    11525, // Bird's egg / Fletching potion proxy
    6049, // Crushed nest / Antipoison+ proxy
    6693, // Crushed nest / Saradomin brew proxy
    3138, // Potato cactus / Magic potion
    10111, // Crushed bird's nest / Hunter potion
    247, // Jangerberries
];

const POUCH_ITEM_ID_SET: ReadonlySet<number> = new Set([
    ...GRIMY_HERB_IDS,
    ...HERBLORE_SECONDARY_IDS,
]);

/** Returns true if `itemId` is eligible for the Forager's Pouch. */
export function isForagerPouchItem(itemId: number): boolean {
    return POUCH_ITEM_ID_SET.has(itemId);
}

/** Returns true if `itemId` is one of the pouch-accepted grimy herbs. */
export function isForagerPouchGrimyHerb(itemId: number): boolean {
    for (const id of GRIMY_HERB_IDS) {
        if (id === itemId) return true;
    }
    return false;
}

/** Returns true if `itemId` is one of the pouch-accepted herblore secondaries. */
export function isForagerPouchSecondary(itemId: number): boolean {
    for (const id of HERBLORE_SECONDARY_IDS) {
        if (id === itemId) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// Storage state (attached per-player)
// ---------------------------------------------------------------------------

export interface ForagerPouchEntry {
    readonly itemId: number;
    readonly quantity: number;
}

/**
 * Mutable pouch state. Each player owns a single instance of this attached as
 * `player.foragerPouch`. The map key is the item id; the value is the stack
 * count (1..pouchSize).
 */
export class ForagerPouchStore {
    private readonly stacks = new Map<number, number>();

    static readonly MAX_STACK = FRIENDLY_FORAGER_CONFIG.pouchSize;

    /** Returns total stacked quantity of `itemId` currently in the pouch. */
    getQuantity(itemId: number): number {
        return this.stacks.get(itemId) ?? 0;
    }

    /** Read-only snapshot for UI / persistence consumers. */
    entries(): ForagerPouchEntry[] {
        const out: ForagerPouchEntry[] = [];
        for (const [itemId, quantity] of this.stacks.entries()) {
            if (quantity > 0) out.push({ itemId, quantity });
        }
        // Stable order (item id ascending) keeps inspection output predictable.
        out.sort((a, b) => a.itemId - b.itemId);
        return out;
    }

    /** Total number of items stored across all stacks. */
    totalQuantity(): number {
        let total = 0;
        for (const qty of this.stacks.values()) total += qty;
        return total;
    }

    isEmpty(): boolean {
        if (this.stacks.size === 0) return true;
        for (const qty of this.stacks.values()) {
            if (qty > 0) return false;
        }
        return true;
    }

    /**
     * Try to add up to `quantity` of `itemId` to the pouch. Returns the
     * number of items actually stored (the rest must be routed back to the
     * inventory by the caller). Rejects items not in POUCH_ITEM_ID_SET.
     */
    tryStore(itemId: number, quantity: number): number {
        if (quantity <= 0 || !POUCH_ITEM_ID_SET.has(itemId)) return 0;
        const current = this.stacks.get(itemId) ?? 0;
        if (current >= ForagerPouchStore.MAX_STACK) return 0;
        const room = ForagerPouchStore.MAX_STACK - current;
        const stored = Math.min(room, Math.max(0, Math.floor(quantity)));
        if (stored <= 0) return 0;
        this.stacks.set(itemId, current + stored);
        return stored;
    }

    /**
     * Try to consume up to `quantity` of `itemId` from the pouch. Returns the
     * number of items actually removed.
     */
    tryConsume(itemId: number, quantity: number): number {
        if (quantity <= 0) return 0;
        const current = this.stacks.get(itemId) ?? 0;
        if (current <= 0) return 0;
        const consumed = Math.min(current, Math.max(0, Math.floor(quantity)));
        const next = current - consumed;
        if (next <= 0) this.stacks.delete(itemId);
        else this.stacks.set(itemId, next);
        return consumed;
    }

    /** Clear the pouch entirely. Returns the contents prior to clearing. */
    drain(): ForagerPouchEntry[] {
        const snapshot = this.entries();
        this.stacks.clear();
        return snapshot;
    }

    /** Replace the pouch contents wholesale (used by persistence reload). */
    replaceFromSnapshot(snapshot: readonly ForagerPouchEntry[] | undefined): void {
        this.stacks.clear();
        if (!snapshot) return;
        for (const entry of snapshot) {
            if (!entry || !POUCH_ITEM_ID_SET.has(entry.itemId)) continue;
            const qty = Math.max(0, Math.floor(entry.quantity ?? 0));
            if (qty <= 0) continue;
            const clamped = Math.min(qty, ForagerPouchStore.MAX_STACK);
            this.stacks.set(entry.itemId, clamped);
        }
    }
}

// ---------------------------------------------------------------------------
// Lightweight player surface used by the helpers below
// ---------------------------------------------------------------------------

export interface ForagerPouchHolder {
    foragerPouch?: ForagerPouchStore;
}

/**
 * Lazily allocate the pouch store on first access. Players who never select
 * Friendly Forager keep the field undefined, paying zero memory.
 */
export function getOrCreateForagerPouch(player: ForagerPouchHolder): ForagerPouchStore {
    if (!player.foragerPouch) {
        player.foragerPouch = new ForagerPouchStore();
    }
    return player.foragerPouch;
}

/**
 * Convenience wrapper used by gather hooks: tries to route up to `quantity`
 * of `itemId` into the pouch and returns the unstored remainder so the
 * caller can fall back to the regular inventory path.
 */
export function tryStoreToForagerPouch(
    player: ForagerPouchHolder,
    itemId: number,
    quantity: number,
): { stored: number; remaining: number } {
    if (quantity <= 0) return { stored: 0, remaining: 0 };
    if (!POUCH_ITEM_ID_SET.has(itemId)) {
        return { stored: 0, remaining: quantity };
    }
    const pouch = getOrCreateForagerPouch(player);
    const stored = pouch.tryStore(itemId, quantity);
    return { stored, remaining: quantity - stored };
}

/**
 * Convenience wrapper used by herblore: attempts to pull a single secondary
 * ingredient out of the pouch instead of consuming one from inventory. Returns
 * true if a unit was successfully consumed.
 */
export function tryConsumeForagerPouchSecondary(
    player: ForagerPouchHolder,
    itemId: number,
): boolean {
    if (!player.foragerPouch) return false;
    if (!isForagerPouchSecondary(itemId)) return false;
    return player.foragerPouch.tryConsume(itemId, 1) > 0;
}
