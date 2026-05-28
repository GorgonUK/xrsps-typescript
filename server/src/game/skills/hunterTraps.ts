/**
 * Hunter trap manager.
 *
 * Owns the runtime lifecycle of every placed Hunter trap:
 *   - placed/arming -> armed -> caught | failed -> collected/removed
 *
 * Traps are keyed by world tile (x:y:level). The manager is tick-driven and
 * is type-agnostic with respect to trap variants; new trap kinds are added to
 * hunter.ts (TRAP_DEFINITIONS / CREATURE_DEFINITIONS) without changes here.
 *
 * Trap visuals are driven exclusively through cache loc transforms (the same
 * mechanism doors, picklocks and depleted trees already use), so no new
 * network opcodes or client changes are required.
 *
 * Persistence: traps are runtime-only. On server restart, leftover traps are
 * dropped from memory and the trap items are not refunded (OSRS parity: traps
 * left in the world disappear on logout/world hop and the player loses the item).
 */

import { type HunterCreatureDefinition, type HunterTrapDefinition } from "./hunter";

export type HunterTrapState =
    | "arming"
    | "armed"
    | "triggered" // NPC has arrived; rolling success/failure THIS tick.
    | "caught"
    | "failed"
    | "removed"; // tombstone, briefly retained so tick handlers don't double-process

export interface HunterTrapPlacement {
    ownerPlayerId: number;
    /** Trap definition id (`net_trap`, `box_trap`, ...). */
    trapDefId: string;
    tile: { x: number; y: number; level: number };
    /** Tile-keyed unique id, e.g. "1234:5678:0". */
    key: string;
    state: HunterTrapState;
    /** Tick at which the trap entered its current state. */
    stateChangedTick: number;
    /** Tick at which the trap was first placed. */
    placedTick: number;
    /** Last tick the manager polled the trap for nearby creatures. */
    lastPollTick: number;
    /** Creature definition id once the trap has caught something. */
    caughtCreatureId?: string;
    /** Snapshot of the player's hunter level at trap placement (for catch chance rolls). */
    ownerHunterLevel: number;
    /** Current loc id displayed at the trap tile (used to revert when removed). */
    currentLocId: number;
    /**
     * NPC currently committed to triggering this trap. While set, the trap is
     * exclusively reserved to this NPC and no other creature is recruited.
     * The matching reverse lookup lives on the manager (npcReservations map).
     */
    targetedByNpcId?: number;
}

const buildKey = (x: number, y: number, level: number): string => `${x}:${y}:${level}`;

export interface HunterTrapManagerEvents {
    /** Invoked when a trap successfully catches a creature (after loc change). */
    onCaught?: (trap: HunterTrapPlacement, creature: HunterCreatureDefinition) => void;
    /** Invoked when a trap fails (after loc change). */
    onFailed?: (trap: HunterTrapPlacement) => void;
    /**
     * Invoked when a trap is removed (caught/check, dismantle, lifetime expiry).
     * Implementations should revert the loc change at the trap's tile if needed.
     */
    onRemoved?: (trap: HunterTrapPlacement) => void;
}

/**
 * Runtime registry for placed Hunter traps. Single instance per server.
 */
export class HunterTrapManager {
    private readonly traps = new Map<string, HunterTrapPlacement>();
    /** Reverse-index: player -> set of active trap keys (for trap-limit checks). */
    private readonly trapsByPlayer = new Map<number, Set<string>>();
    /**
     * Reverse-index of trap reservations: npcId -> trap.key. Enforces the
     * one-trap-per-NPC invariant. Synced in lockstep with placement.targetedByNpcId.
     */
    private readonly npcReservations = new Map<number, string>();

    constructor(private readonly events: HunterTrapManagerEvents = {}) {}

    setEvents(events: HunterTrapManagerEvents): void {
        Object.assign(this.events, events);
    }

    getTrapAtTile(x: number, y: number, level: number): HunterTrapPlacement | undefined {
        return this.traps.get(buildKey(x, y, level));
    }

    hasTrapAtTile(x: number, y: number, level: number): boolean {
        return this.traps.has(buildKey(x, y, level));
    }

    /**
     * Active = arming|armed|caught|failed (not "removed" tombstones).
     */
    getActiveTrapCountForPlayer(playerId: number): number {
        const set = this.trapsByPlayer.get(playerId);
        if (!set) return 0;
        let count = 0;
        for (const key of set) {
            const trap = this.traps.get(key);
            if (!trap || trap.state === "removed") continue;
            count++;
        }
        return count;
    }

    getActiveTrapsForPlayer(playerId: number): HunterTrapPlacement[] {
        const set = this.trapsByPlayer.get(playerId);
        if (!set) return [];
        const out: HunterTrapPlacement[] = [];
        for (const key of set) {
            const trap = this.traps.get(key);
            if (trap && trap.state !== "removed") out.push(trap);
        }
        return out;
    }

    place(params: {
        ownerPlayerId: number;
        ownerHunterLevel: number;
        trapDef: HunterTrapDefinition;
        tile: { x: number; y: number; level: number };
        tick: number;
    }): HunterTrapPlacement | undefined {
        const key = buildKey(params.tile.x, params.tile.y, params.tile.level);
        if (this.traps.has(key)) return undefined;
        const placement: HunterTrapPlacement = {
            ownerPlayerId: params.ownerPlayerId,
            trapDefId: params.trapDef.id,
            tile: { ...params.tile },
            key,
            state: "arming",
            stateChangedTick: params.tick,
            placedTick: params.tick,
            lastPollTick: params.tick,
            ownerHunterLevel: params.ownerHunterLevel,
            currentLocId: params.trapDef.armedLocId,
        };
        this.traps.set(key, placement);
        let bucket = this.trapsByPlayer.get(params.ownerPlayerId);
        if (!bucket) {
            bucket = new Set();
            this.trapsByPlayer.set(params.ownerPlayerId, bucket);
        }
        bucket.add(key);
        return placement;
    }

    /**
     * Transition the trap to a new state. Updates the current loc id when the
     * caller has just emitted a loc transform.
     */
    transition(
        trap: HunterTrapPlacement,
        nextState: HunterTrapState,
        opts: { tick: number; newLocId?: number; caughtCreatureId?: string },
    ): void {
        trap.state = nextState;
        trap.stateChangedTick = opts.tick;
        if (opts.newLocId !== undefined) trap.currentLocId = opts.newLocId;
        if (opts.caughtCreatureId !== undefined) trap.caughtCreatureId = opts.caughtCreatureId;
    }

    /**
     * Permanently remove the trap from the registry. Caller is responsible for
     * reverting the loc change at the tile (typically via events.onRemoved).
     */
    remove(trap: HunterTrapPlacement, tick: number): void {
        const prevState = trap.state;
        trap.state = "removed";
        trap.stateChangedTick = tick;
        this.releaseReservation(trap);
        this.traps.delete(trap.key);
        const bucket = this.trapsByPlayer.get(trap.ownerPlayerId);
        if (bucket) {
            bucket.delete(trap.key);
            if (bucket.size === 0) this.trapsByPlayer.delete(trap.ownerPlayerId);
        }
        if (prevState !== "removed") this.events.onRemoved?.(trap);
    }

    // ---------------- NPC reservations ----------------

    /**
     * Attempt to reserve an NPC for this trap. Fails (returns false) if the
     * trap already has a different NPC reserved, or if the NPC is already
     * committed to another trap. The reservation guarantees the two are
     * exclusively bound until released.
     */
    reserveNpc(trap: HunterTrapPlacement, npcId: number): boolean {
        if (trap.targetedByNpcId === npcId) return true;
        if (trap.targetedByNpcId !== undefined) return false;
        if (this.npcReservations.has(npcId)) return false;
        trap.targetedByNpcId = npcId;
        this.npcReservations.set(npcId, trap.key);
        return true;
    }

    isNpcReserved(npcId: number): boolean {
        return this.npcReservations.has(npcId);
    }

    getReservedTrapForNpc(npcId: number): HunterTrapPlacement | undefined {
        const key = this.npcReservations.get(npcId);
        if (!key) return undefined;
        return this.traps.get(key);
    }

    /** Release the reservation on this trap (called from cleanup paths). */
    releaseReservation(trap: HunterTrapPlacement): void {
        if (trap.targetedByNpcId === undefined) return;
        const npcId = trap.targetedByNpcId;
        trap.targetedByNpcId = undefined;
        const heldKey = this.npcReservations.get(npcId);
        if (heldKey === trap.key) {
            this.npcReservations.delete(npcId);
        }
    }

    /** Iterate every (npcId, trap) reservation pair currently held. */
    *iterReservations(): IterableIterator<{ npcId: number; trap: HunterTrapPlacement }> {
        for (const [npcId, key] of this.npcReservations.entries()) {
            const trap = this.traps.get(key);
            if (trap) yield { npcId, trap };
        }
    }

    /**
     * Iterate every live trap. Order is insertion order; callers should not
     * mutate the map during iteration (use remove() after the loop).
     */
    *iterTraps(): IterableIterator<HunterTrapPlacement> {
        for (const trap of this.traps.values()) {
            if (trap.state !== "removed") yield trap;
        }
    }

    notifyCaught(trap: HunterTrapPlacement, creature: HunterCreatureDefinition): void {
        this.events.onCaught?.(trap, creature);
    }

    notifyFailed(trap: HunterTrapPlacement): void {
        this.events.onFailed?.(trap);
    }
}
