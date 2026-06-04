/**
 * Hunter skill content module.
 *
 * Wires the data-driven Hunter system into the script registry:
 *   - "Lay" inventory action on every TRAP_DEFINITION item id.
 *   - "Check" and "Dismantle" loc interactions on every trap loc id.
 *   - A tick handler that drives the trap state machine:
 *       arming -> armed -> caught | failed -> (collected/expired)
 *
 * Trap visuals are pushed via loc transforms (no new opcodes needed). Nearby
 * Hunter creature NPCs are polled via services.getNearbyNpcs and rolled
 * against the data-driven catch chance formula.
 *
 * Extending Hunter (deadfall, snares, butterfly net, falconry, ...) is done
 * exclusively in skills/hunter.ts (data) — this module is type-agnostic.
 */

import { hasAnimalWranglerRelic } from "../../../../../../src/shared/leagues/leagueRelicEffects";
import { onGatherItemForRelics } from "../../../leagues/relicHooks";
import { SkillId } from "../../../../../../src/rs/skill/skills";
import type { PlayerState } from "../../../player";
import {
    ALL_TRAP_LOC_IDS,
    CREATURE_DEFINITIONS,
    HUNTER_CREATURE_NPC_TYPE_IDS,
    TRAP_DEFINITIONS,
    getCreatureDefinitionById,
    getCreatureDefinitionByNpcTypeId,
    getLeagueHunterCatchTargetId,
    getMaxActiveTrapsForLevel,
    getTrapDefinitionById,
    rollCatchSuccess,
    rollCreatureLoot,
    type HunterCreatureDefinition,
    type HunterTrapDefinition,
} from "../../../skills/hunter";
import {
    HunterTrapManager,
    type HunterTrapPlacement,
} from "../../../skills/hunterTraps";
import { type IScriptRegistry, type ScriptModule, type ScriptServices } from "../../types";

const isPlayerAdjacentToTile = (player: PlayerState, x: number, y: number, level: number): boolean => {
    if (player.level !== level) return false;
    return Math.abs(player.tileX - x) <= 1 && Math.abs(player.tileY - y) <= 1;
};

/**
 * Animal Wrangler (Leagues V tier-1 relic) effects on Hunter:
 *   - All Hunter trap catch rolls succeed.
 *   - Box trap chinchompa catches trigger at chebyshev distance <= 1 (1 tile
 *     earlier than the default trap.triggerRadius = 0). The chinchompa is
 *     lured the same way; the trap simply closes on it one tick sooner.
 *   - Box trap chinchompa catches yield 2x loot quantity and 2x XP.
 *
 * The relic check is keyed off the *trap owner*, looked up via getPlayerById so
 * the perk applies even if the owner isn't logged in (defensive; the trap
 * normally expires when the owner disconnects).
 */
const CHINCHOMPA_CREATURE_IDS: ReadonlySet<string> = new Set([
    "chinchompa",
    "carnivorous_chinchompa",
    "black_chinchompa",
]);
const ANIMAL_WRANGLER_CHINCHOMPA_TRIGGER_RADIUS = 1;
const ANIMAL_WRANGLER_CHINCHOMPA_MULTIPLIER = 2;

const ownerHasAnimalWrangler = (
    services: ScriptServices,
    ownerPlayerId: number,
): boolean => {
    const owner = services.getPlayerById?.(ownerPlayerId);
    if (!owner) return false;
    return hasAnimalWranglerRelic(owner as any);
};

const computeEffectiveTriggerRadius = (
    services: ScriptServices,
    trap: HunterTrapPlacement,
    trapDef: HunterTrapDefinition,
    creature: HunterCreatureDefinition,
): number => {
    if (
        trapDef.trapType === "box_trap" &&
        CHINCHOMPA_CREATURE_IDS.has(creature.id) &&
        ownerHasAnimalWrangler(services, trap.ownerPlayerId)
    ) {
        return Math.max(trapDef.triggerRadius, ANIMAL_WRANGLER_CHINCHOMPA_TRIGGER_RADIUS);
    }
    return trapDef.triggerRadius;
};

/**
 * When true, prints a verbose per-poll trace of every armed trap including
 * nearby NPC scans, reservation attempts, and path requests. Use to debug
 * "no creatures coming" issues; leave off in steady-state.
 *
 * Initial value seeded from HUNTER_DEBUG=1 in .env, then toggleable at
 * runtime via the ::hunterdebug admin chat command (see MessageHandlers).
 * Hot-reloading this module resets the flag to the .env default — fine,
 * just retype ::hunterdebug.
 */
let HUNTER_DEBUG = process.env.HUNTER_DEBUG === "1";

export const setHunterDebug = (enabled: boolean): void => {
    HUNTER_DEBUG = !!enabled;
};
export const isHunterDebug = (): boolean => HUNTER_DEBUG;

/**
 * Emit a debug log line. Goes to the server logger always (so the console
 * has it), and also echoes to the trap owner's in-game chat when an owner
 * player is supplied and is online — much more convenient when running
 * solo on a dev box than alt-tabbing to the terminal.
 */
const debugLog = (
    services: ScriptServices,
    text: string,
    ownerPlayerId?: number,
): void => {
    if (!HUNTER_DEBUG) return;
    services.logger?.info?.(text);
    if (ownerPlayerId !== undefined) {
        const owner = services.getPlayerById?.(ownerPlayerId);
        if (owner) {
            services.sendGameMessage(owner, text);
        }
    }
};

/**
 * Test whether a tile is a valid trap placement spot. Rejects tiles that:
 *   - Already contain a Hunter trap (managed in trapManager).
 *   - Are flagged blocked / occupied by an object in the collision map.
 *
 * Hunter creatures themselves do not block placement; they wander on the same
 * walkable tiles a trap may be laid on.
 */
const isValidTrapTile = (
    services: ScriptServices,
    trapManager: HunterTrapManager,
    tile: { x: number; y: number; level: number },
): boolean => {
    if (trapManager.hasTrapAtTile(tile.x, tile.y, tile.level)) return false;
    const pathService = services.getPathService?.();
    if (!pathService) return true; // best-effort if no collision service available
    const flag = pathService.getCollisionFlagAt(tile.x, tile.y, tile.level);
    if (flag === undefined) return false;
    // CollisionFlag bits 0x200000 = FLOOR_BLOCKED, 0x100 = OBJECT. Hardcoded to
    // avoid importing the shared CollisionFlag module into the script bundle.
    const FLOOR_BLOCKED_BIT = 0x200000 | 0x40000; // FLOOR | FLOOR_DECORATION
    const OBJECT_BIT = 0x100;
    if ((flag & (FLOOR_BLOCKED_BIT | OBJECT_BIT)) !== 0) return false;
    return true;
};

const restoreTrapItem = (
    services: ScriptServices,
    player: PlayerState,
    trapDef: HunterTrapDefinition,
): boolean => {
    const result = services.addItemToInventory(player, trapDef.itemId, 1);
    if (result.added <= 0) {
        services.sendGameMessage(
            player,
            `You don't have room to pick up the ${trapDef.displayName.toLowerCase()}.`,
        );
        return false;
    }
    services.snapshotInventory(player);
    return true;
};

/**
 * Lay handler shared by all trap items. Validates Hunter level/limits, consumes
 * the item, plays the set-trap animation and registers the trap with the
 * manager. The trap immediately transitions to its armed loc visual; arming
 * delay prevents same-tick triggers without forcing an extra loc swap.
 */
const layTrap = (
    services: ScriptServices,
    trapManager: HunterTrapManager,
    player: PlayerState,
    trapDef: HunterTrapDefinition,
    sourceSlot: number,
    sourceItemId: number,
    tick: number,
): void => {
    const skill = player.getSkill(SkillId.Hunter);
    const baseLevel = Math.max(1, skill.baseLevel);

    if (baseLevel < trapDef.requiredHunterLevel) {
        services.sendGameMessage(
            player,
            `You need a Hunter level of ${trapDef.requiredHunterLevel} to use this trap.`,
        );
        return;
    }

    const maxTraps = getMaxActiveTrapsForLevel(baseLevel);
    const activeTraps = trapManager.getActiveTrapCountForPlayer(player.id);
    if (activeTraps >= maxTraps) {
        services.sendGameMessage(
            player,
            `You can only have ${maxTraps} trap${maxTraps === 1 ? "" : "s"} placed at a time.`,
        );
        return;
    }

    const tile = { x: player.tileX, y: player.tileY, level: player.level };
    if (!isValidTrapTile(services, trapManager, tile)) {
        services.sendGameMessage(
            player,
            "You can't set up a trap here.",
        );
        return;
    }

    const inventory = services.getInventoryItems(player);
    const slotEntry = inventory[sourceSlot];
    if (!slotEntry || slotEntry.itemId !== sourceItemId || slotEntry.quantity <= 0) {
        return;
    }
    if (!services.consumeItem(player, sourceSlot)) return;
    services.snapshotInventory(player);

    player.queueOneShotSeq(trapDef.layAnimation);

    const placement = trapManager.place({
        ownerPlayerId: player.id,
        ownerHunterLevel: baseLevel,
        trapDef,
        tile,
        tick,
    });
    if (!placement) {
        // Race: another trap was placed first. Refund the consumed item.
        services.addItemToInventory(player, trapDef.itemId, 1);
        services.snapshotInventory(player);
        return;
    }

    services.emitLocChange?.(0, trapDef.armedLocId, { x: tile.x, y: tile.y }, tile.level);
    services.sendGameMessage(player, `You set up the ${trapDef.displayName.toLowerCase()}.`);

    if (HUNTER_DEBUG) {
        const scanRadius = Math.max(trapDef.triggerRadius, trapDef.attractionRadius);
        const nearby =
            services.getNearbyNpcs?.(
                { x: tile.x, y: tile.y },
                tile.level,
                scanRadius,
            ) ?? [];
        const matching = nearby.filter((n) => HUNTER_CREATURE_NPC_TYPE_IDS.has(n.typeId));
        debugLog(
            services,
            `[hunter] placed ${trapDef.id} @(${tile.x},${tile.y},${tile.level}); scan r=${scanRadius}: ${nearby.length} npcs total, ${matching.length} compatible -> ${
                matching.length === 0
                    ? "<none>"
                    : matching
                          .map((n) => `npc=${n.id}/type${n.typeId}@(${n.x},${n.y})`)
                          .join(", ")
            }`,
            player.id,
        );
    }
};

const checkTrap = (
    services: ScriptServices,
    trapManager: HunterTrapManager,
    player: PlayerState,
    trap: HunterTrapPlacement,
    trapDef: HunterTrapDefinition,
    tick: number,
): void => {
    if (player.id !== trap.ownerPlayerId) {
        services.sendGameMessage(player, "This isn't your trap.");
        return;
    }
    player.faceTile(trap.tile.x, trap.tile.y);
    player.queueOneShotSeq(trapDef.checkAnimation);

    if (trap.state === "caught" && trap.caughtCreatureId) {
        const creature = getCreatureDefinitionById(trap.caughtCreatureId);
        if (!creature) {
            // Defensive: should be impossible since caughtCreatureId comes from the registry.
            removeTrapAndRevert(services, trapManager, trap, tick);
            return;
        }

        // Animal Wrangler relic: chinchompa box trap catches yield 2x loot and 2x XP.
        const chinchompaBonus =
            trapDef.trapType === "box_trap" &&
            CHINCHOMPA_CREATURE_IDS.has(creature.id) &&
            hasAnimalWranglerRelic(player as any);
        const lootMultiplier = chinchompaBonus ? ANIMAL_WRANGLER_CHINCHOMPA_MULTIPLIER : 1;
        const xpMultiplier = chinchompaBonus ? ANIMAL_WRANGLER_CHINCHOMPA_MULTIPLIER : 1;

        // Award XP first so the levelup popup is queued before the loc swaps.
        services.addSkillXp?.(player, SkillId.Hunter, creature.xp * xpMultiplier);

        const loot = rollCreatureLoot(creature);
        for (const drop of loot) {
            const quantity = drop.quantity * lootMultiplier;
            // Friendly Forager (Leagues V tier-2 relic): redirect any
            // grimy herb / herblore secondary drops into the player's
            // Forager's Pouch before falling back to the inventory.
            const route = onGatherItemForRelics(player, drop.itemId, quantity);
            const remaining = route.remaining;
            if (remaining <= 0) continue;
            const added = services.addItemToInventory(player, drop.itemId, remaining);
            if (added.added <= 0) {
                services.sendGameMessage(
                    player,
                    "You don't have room for the rewards from the trap.",
                );
                break;
            }
        }
        services.snapshotInventory(player);
        services.sendGameMessage(
            player,
            chinchompaBonus
                ? `You catch a pair of ${creature.displayName.toLowerCase()}s!`
                : `You catch a ${creature.displayName.toLowerCase()}!`,
        );
        const catchTargetId = getLeagueHunterCatchTargetId(creature);
        if (catchTargetId > 0) {
            services.onLeagueSkillingAction?.(player.id, "hunter", "catch", catchTargetId, 1);
        }
        // The trap item is returned when the trap is collected (OSRS parity).
        restoreTrapItem(services, player, trapDef);
        removeTrapAndRevert(services, trapManager, trap, tick);
        return;
    }

    if (trap.state === "failed") {
        services.sendGameMessage(player, "Your trap has failed.");
        restoreTrapItem(services, player, trapDef);
        removeTrapAndRevert(services, trapManager, trap, tick);
        return;
    }

    // Armed / arming traps default to dismantle behaviour on "check".
    dismantleTrap(services, trapManager, player, trap, trapDef, tick);
};

const dismantleTrap = (
    services: ScriptServices,
    trapManager: HunterTrapManager,
    player: PlayerState,
    trap: HunterTrapPlacement,
    trapDef: HunterTrapDefinition,
    tick: number,
): void => {
    if (player.id !== trap.ownerPlayerId) {
        services.sendGameMessage(player, "This isn't your trap.");
        return;
    }
    player.faceTile(trap.tile.x, trap.tile.y);
    player.queueOneShotSeq(trapDef.checkAnimation);
    restoreTrapItem(services, player, trapDef);
    services.sendGameMessage(player, "You dismantle the trap.");
    removeTrapAndRevert(services, trapManager, trap, tick);
};

const removeTrapAndRevert = (
    services: ScriptServices,
    trapManager: HunterTrapManager,
    trap: HunterTrapPlacement,
    tick: number,
): void => {
    const currentLoc = trap.currentLocId;
    trapManager.remove(trap, tick);
    if (currentLoc > 0) {
        services.emitLocChange?.(
            currentLoc,
            0,
            { x: trap.tile.x, y: trap.tile.y },
            trap.tile.level,
        );
    }
};

/**
 * Despawn duration (in ticks) for a successfully caught creature before its
 * spawn returns. ~30 seconds keeps spawn density healthy without making
 * "caught" feel meaningless.
 */
const CAUGHT_NPC_RESPAWN_DELAY_TICKS = 50;

const chebyshev = (
    a: { x: number; y: number },
    b: { x: number; y: number },
): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * Roll catch chance and transition the trap into caught/failed. Called the
 * exact tick a reserved NPC arrives within triggerRadius of the trap (no
 * passive timer-driven catches).
 */
const resolveTrapTrigger = (
    services: ScriptServices,
    trapManager: HunterTrapManager,
    trap: HunterTrapPlacement,
    trapDef: HunterTrapDefinition,
    creature: HunterCreatureDefinition,
    npcId: number,
    tick: number,
): void => {
    // Spec: armed -> triggered -> caught | failed.
    // The triggered state is transient (same tick) but explicitly transitioned
    // through so anything listening (logs, future shake animation, etc.) gets
    // a deterministic signal that an NPC arrived at the trap.
    trapManager.transition(trap, "triggered", { tick });
    // Animal Wrangler relic: every catch roll succeeds while the relic is selected.
    const relicNeverFail = ownerHasAnimalWrangler(services, trap.ownerPlayerId);
    const success =
        relicNeverFail || rollCatchSuccess(trap.ownerHunterLevel, creature, trapDef);
    services.logger?.info?.(
        `[hunter] ${trapDef.id} at (${trap.tile.x},${trap.tile.y}) triggered by ${creature.id} npc=${npcId} for player=${trap.ownerPlayerId} -> ${success ? "caught" : "failed"}${relicNeverFail ? " (animal_wrangler)" : ""}`,
    );

    if (success) {
        services.emitLocChange?.(
            trap.currentLocId,
            creature.caughtLocId,
            { x: trap.tile.x, y: trap.tile.y },
            trap.tile.level,
        );
        trapManager.transition(trap, "caught", {
            tick,
            newLocId: creature.caughtLocId,
            caughtCreatureId: creature.id,
        });
        trapManager.notifyCaught(trap, creature);
        // OSRS parity: caught creature disappears and respawns later.
        services.despawnNpcWithRespawn?.(npcId, CAUGHT_NPC_RESPAWN_DELAY_TICKS);
    } else {
        services.emitLocChange?.(
            trap.currentLocId,
            trapDef.failedLocId,
            { x: trap.tile.x, y: trap.tile.y },
            trap.tile.level,
        );
        trapManager.transition(trap, "failed", {
            tick,
            newLocId: trapDef.failedLocId,
        });
        trapManager.notifyFailed(trap);
        // Failed catch: NPC stops, naturally resumes wandering after its roam timer.
        services.clearNpcPath?.(npcId);
    }

    // Either outcome ends the reservation.
    trapManager.releaseReservation(trap);
};

/**
 * Scan tiles near `trap` for a valid Hunter creature NPC to commit to it.
 * Skips NPCs already reserved by another trap, in combat, or dead. Returns
 * the first match in iteration order (stable enough for V1).
 */
const findCandidateForTrap = (
    services: ScriptServices,
    trapManager: HunterTrapManager,
    trap: HunterTrapPlacement,
    trapDef: HunterTrapDefinition,
):
    | { npcId: number; creature: HunterCreatureDefinition }
    | undefined => {
    const scanRadius = Math.max(trapDef.triggerRadius, trapDef.attractionRadius);
    const nearby =
        services.getNearbyNpcs?.(
            { x: trap.tile.x, y: trap.tile.y },
            trap.tile.level,
            scanRadius,
        ) ?? [];

    if (HUNTER_DEBUG) {
        const summary = nearby.length === 0
            ? "<none>"
            : nearby.map((n) => `${n.id}/type${n.typeId}@(${n.x},${n.y})`).join(", ");
        debugLog(
            services,
            `[hunter] ${trapDef.id} @(${trap.tile.x},${trap.tile.y}) scanned r=${scanRadius} found ${nearby.length} npcs: ${summary}`,
            trap.ownerPlayerId,
        );
    }

    for (const npc of nearby) {
        if (!HUNTER_CREATURE_NPC_TYPE_IDS.has(npc.typeId)) continue;
        const creature = getCreatureDefinitionByNpcTypeId(npc.typeId);
        if (!creature || creature.trapType !== trapDef.trapType) {
            if (HUNTER_DEBUG && creature) {
                debugLog(
                    services,
                    `[hunter]   skip npc=${npc.id} type=${npc.typeId} creature=${creature.id} wrong trap type (${creature.trapType} != ${trapDef.trapType})`,
                    trap.ownerPlayerId,
                );
            }
            continue;
        }
        if (trapManager.isNpcReserved(npc.id)) {
            if (HUNTER_DEBUG) {
                debugLog(
                    services,
                    `[hunter]   skip npc=${npc.id} reserved by another trap`,
                    trap.ownerPlayerId,
                );
            }
            continue;
        }
        const snap = services.getNpcSnapshot?.(npc.id);
        if (snap && (snap.isDead || snap.isInCombat)) {
            if (HUNTER_DEBUG) {
                debugLog(
                    services,
                    `[hunter]   skip npc=${npc.id} dead=${snap.isDead} combat=${snap.isInCombat}`,
                    trap.ownerPlayerId,
                );
            }
            continue;
        }
        return { npcId: npc.id, creature };
    }
    return undefined;
};

/**
 * Drive a single armed trap forward by one poll cycle:
 *   - If a reservation exists, validate it (NPC alive / in range / not in combat),
 *     trigger on arrival, or re-issue its path if it drifted off course.
 *   - Otherwise, look for a free candidate to reserve and lure.
 *
 * No random/timer-driven catches: a trap only transitions to caught/failed
 * when its committed NPC steps within triggerRadius.
 */
const pollArmedTrap = (
    services: ScriptServices,
    trapManager: HunterTrapManager,
    trap: HunterTrapPlacement,
    trapDef: HunterTrapDefinition,
    tick: number,
): void => {
    if (trap.targetedByNpcId !== undefined) {
        const npcId = trap.targetedByNpcId;
        const npc = services.getNpcSnapshot?.(npcId);
        if (!npc || npc.isDead || npc.level !== trap.tile.level || npc.isInCombat) {
            debugLog(
                services,
                `[hunter] ${trapDef.id} releasing npc=${npcId}: snapshot=${!!npc} dead=${npc?.isDead} combat=${npc?.isInCombat}`,
                trap.ownerPlayerId,
            );
            trapManager.releaseReservation(trap);
            return;
        }

        const dist = chebyshev({ x: npc.x, y: npc.y }, trap.tile);

        if (dist > trapDef.attractionRadius + 2) {
            debugLog(
                services,
                `[hunter] ${trapDef.id} npc=${npcId} drifted out of range (dist=${dist}, cap=${trapDef.attractionRadius + 2}); releasing`,
                trap.ownerPlayerId,
            );
            trapManager.releaseReservation(trap);
            return;
        }

        const creature = getCreatureDefinitionByNpcTypeId(npc.typeId);
        if (!creature) {
            trapManager.releaseReservation(trap);
            return;
        }
        const triggerRadius = computeEffectiveTriggerRadius(services, trap, trapDef, creature);
        if (dist <= triggerRadius) {
            resolveTrapTrigger(services, trapManager, trap, trapDef, creature, npcId, tick);
            return;
        }

        // We always re-issue the path each poll (clearing any in-flight steps
        // first). The queued path may legitimately be heading toward the trap
        // already, but the NPC may also have been re-pathed elsewhere by
        // recovery logic / wander; re-pathing is cheap and ensures the NPC
        // stays committed to the reservation.
        services.clearNpcPath?.(npcId);
        const pathed = services.requestNpcPathToward?.(
            npcId,
            { x: trap.tile.x, y: trap.tile.y },
            { maxQueuedSteps: 4, maxPathCalcSteps: 4 },
        );
        debugLog(
            services,
            `[hunter] ${trapDef.id} re-luring npc=${npcId} dist=${dist} pathed=${pathed}`,
            trap.ownerPlayerId,
        );
        return;
    }

    const candidate = findCandidateForTrap(services, trapManager, trap, trapDef);
    if (!candidate) {
        debugLog(
            services,
            `[hunter] ${trapDef.id} @(${trap.tile.x},${trap.tile.y}) no candidate found this poll`,
            trap.ownerPlayerId,
        );
        return;
    }
    if (!trapManager.reserveNpc(trap, candidate.npcId)) {
        debugLog(
            services,
            `[hunter] ${trapDef.id} reserveNpc failed for npc=${candidate.npcId}`,
            trap.ownerPlayerId,
        );
        return;
    }
    // Stop any in-flight random roam so the trap path takes priority THIS tick.
    // Without this, a candidate that just queued a roam path would ignore our
    // path request (queueNpcPathToward returns false when hasPath), and we'd
    // wait many ticks for the random path to drain before the NPC began moving
    // toward the trap.
    services.clearNpcPath?.(candidate.npcId);
    const pathed = services.requestNpcPathToward?.(
        candidate.npcId,
        { x: trap.tile.x, y: trap.tile.y },
        { maxQueuedSteps: 4, maxPathCalcSteps: 4 },
    );
    services.logger?.info?.(
        `[hunter] ${trapDef.id} at (${trap.tile.x},${trap.tile.y}) committed npc=${candidate.npcId} (${candidate.creature.id}) pathed=${pathed}`,
    );
    debugLog(
        services,
        `[hunter] ${trapDef.id} committed npc=${candidate.npcId} (${candidate.creature.id}) pathed=${pathed}`,
        trap.ownerPlayerId,
    );
};

/**
 * Per-tick processing of all live traps:
 *   - Tick the arming countdown.
 *   - Drive each armed trap's NPC AI (recruit / lure / trigger).
 *   - Expire traps that exceed their lifetime.
 */
const tickTraps = (
    services: ScriptServices,
    trapManager: HunterTrapManager,
    tick: number,
): void => {
    const toRemove: HunterTrapPlacement[] = [];
    for (const trap of trapManager.iterTraps()) {
        const trapDef = getTrapDefinitionById(trap.trapDefId);
        if (!trapDef) continue;

        // Lifetime expiry: any non-removed state can time out and collapse.
        if (tick - trap.placedTick >= trapDef.lifetimeTicks) {
            if (trap.state !== "failed") {
                services.emitLocChange?.(
                    trap.currentLocId,
                    trapDef.failedLocId,
                    { x: trap.tile.x, y: trap.tile.y },
                    trap.tile.level,
                );
                trapManager.transition(trap, "failed", {
                    tick,
                    newLocId: trapDef.failedLocId,
                });
                trapManager.notifyFailed(trap);
                // Lifetime expiry must also free any committed NPC.
                trapManager.releaseReservation(trap);
            }
            // Traps left to rot for too long after failing decay completely.
            if (tick - trap.stateChangedTick >= trapDef.lifetimeTicks) {
                toRemove.push(trap);
            }
            continue;
        }

        if (trap.state === "arming") {
            if (tick - trap.stateChangedTick >= trapDef.armTicks) {
                trapManager.transition(trap, "armed", { tick, newLocId: trap.currentLocId });
            }
            continue;
        }

        if (trap.state !== "armed") continue;

        // Throttle reservation/lure work to pollIntervalTicks. Arrival checks
        // for already-reserved traps run on the same throttle: NPCs path in
        // ~1 tile / tick, so a 2-tick poll catches arrival within a tile of
        // accuracy without flooding the path service.
        if (tick - trap.lastPollTick < trapDef.pollIntervalTicks) continue;
        trap.lastPollTick = tick;

        pollArmedTrap(services, trapManager, trap, trapDef, tick);
    }

    for (const trap of toRemove) {
        const currentLoc = trap.currentLocId;
        trapManager.remove(trap, tick);
        if (currentLoc > 0) {
            services.emitLocChange?.(
                currentLoc,
                0,
                { x: trap.tile.x, y: trap.tile.y },
                trap.tile.level,
            );
        }
    }
};

const registerTrapInteractions = (
    registry: IScriptRegistry,
    services: ScriptServices,
    trapManager: HunterTrapManager,
): void => {
    const handleLocAction = (action: "check" | "dismantle") => {
        return ({
            player,
            tile,
            level,
            tick,
        }: {
            player: PlayerState;
            tile: { x: number; y: number };
            level: number;
            tick: number;
        }) => {
            const trap = trapManager.getTrapAtTile(tile.x, tile.y, level);
            if (!trap) return;
            const trapDef = getTrapDefinitionById(trap.trapDefId);
            if (!trapDef) return;
            // Best-effort adjacency check; engine routes the player adjacent
            // before invoking the handler.
            if (!isPlayerAdjacentToTile(player, tile.x, tile.y, level)) return;
            if (action === "check") checkTrap(services, trapManager, player, trap, trapDef, tick);
            else dismantleTrap(services, trapManager, player, trap, trapDef, tick);
        };
    };

    // Hunter trap locs typically expose ["Check", "Dismantle", "Take"]. We register
    // for the option names OSRS uses and also fall back to the generic action when
    // the option text isn't sent by the client.
    for (const locId of ALL_TRAP_LOC_IDS) {
        registry.registerLocInteraction(locId, handleLocAction("check"), "check");
        registry.registerLocInteraction(locId, handleLocAction("check"), "investigate");
        registry.registerLocInteraction(locId, handleLocAction("check"), "take");
        registry.registerLocInteraction(locId, handleLocAction("dismantle"), "dismantle");
        // Default (no option) action falls through to "check" — preserves OSRS
        // single-click-to-check behaviour for caught/failed visuals.
        registry.registerLocInteraction(locId, handleLocAction("check"));
    }
};

const registerLayActions = (
    registry: IScriptRegistry,
    services: ScriptServices,
    trapManager: HunterTrapManager,
): void => {
    for (const trapDef of TRAP_DEFINITIONS) {
        registry.registerItemAction(
            trapDef.itemId,
            ({ player, source, tick }) => {
                if (source.itemId !== trapDef.itemId) return;
                layTrap(services, trapManager, player, trapDef, source.slot, source.itemId, tick);
            },
            "lay",
        );
    }
};

export const hunterModule: ScriptModule = {
    id: "skills.hunter",
    register(registry, services) {
        // Module-local manager keeps trap state out of the global service surface.
        const trapManager = new HunterTrapManager();
        if (services.logger) {
            services.logger.info(
                `[hunter] registered ${TRAP_DEFINITIONS.length} trap defs, ${CREATURE_DEFINITIONS.length} creatures`,
            );
        }

        registerLayActions(registry, services, trapManager);
        registerTrapInteractions(registry, services, trapManager);

        registry.registerTickHandler(({ tick }) => {
            tickTraps(services, trapManager, tick);
        });

        // Hot-reloadable admin chat command: `::hunterdebug [on|off]`.
        // Toggles per-poll trace output for the issuing player. Lives here
        // rather than in MessageHandlers so a script reload re-registers it.
        registry.registerChatCommand(
            "hunterdebug",
            ({ args }) => {
                const arg = args[0]?.toLowerCase();
                let requested: boolean | undefined;
                if (arg === "on" || arg === "1" || arg === "true") requested = true;
                else if (arg === "off" || arg === "0" || arg === "false") requested = false;
                const next = requested ?? !isHunterDebug();
                setHunterDebug(next);
                return `Hunter debug ${next ? "ON" : "OFF"}.`;
            },
            { requireAdmin: true, description: "Toggle Hunter trap-AI debug trace echo." },
        );

        // Hot reload + shutdown cleanup: revert every in-flight trap's loc back
        // to empty so a fresh module load doesn't leave orphaned ground visuals.
        return () => {
            for (const trap of trapManager.iterTraps()) {
                if (trap.currentLocId > 0) {
                    services.emitLocChange?.(
                        trap.currentLocId,
                        0,
                        { x: trap.tile.x, y: trap.tile.y },
                        trap.tile.level,
                    );
                }
            }
            services.logger?.info?.("[hunter] cleared in-flight traps on unload");
        };
    },
};
