/**
 * Scurrius (Varrock Sewers) — public mass room vs private instance (OSRS parity).
 *
 * NPC types (cache npctypes): 7221 rat_boss_normal (public), 7222 rat_boss_instance (solo).
 * Minions: 7223 rat_boss_giant_rat.
 *
 * Public: higher HP pool, higher combat XP bonus, longer respawn (15–30s) in the mass room.
 * Private instance: ~500 HP, solo XP bonus.
 *
 * References: OSRS Wiki — Scurrius; cache seqtypes (npc_rat_boss_*), spottypes (vfx_rat_boss_*).
 */
import type { PathService } from "../../pathfinding/PathService";
import type { AttackType } from "../combat/AttackType";
import { canNpcAttackPlayerFromCurrentPosition } from "../combat/CombatAction";
import {
    DEFAULT_NPC_MAGIC_RANGE,
    DEFAULT_NPC_MELEE_RANGE,
    DEFAULT_NPC_RANGED_RANGE,
} from "../combat/CombatRules";
import type { NpcState } from "../npc";
import type { PlayerState } from "../player";

/** Public / group Scurrius (Varrock sewers mass room) */
export const SCURRIUS_PUBLIC_TYPE_ID = 7221;
/** Instanced solo Scurrius */
export const SCURRIUS_INSTANCE_TYPE_ID = 7222;
/** Giant rat summoned during the fight */
export const SCURRIUS_MINION_TYPE_ID = 7223;

/** @deprecated Use SCURRIUS_PUBLIC_TYPE_ID / isScurriusBossTypeId */
export const SCURRIUS_TYPE_ID = SCURRIUS_PUBLIC_TYPE_ID;

export function isScurriusBossTypeId(typeId: number): boolean {
    return typeId === SCURRIUS_PUBLIC_TYPE_ID || typeId === SCURRIUS_INSTANCE_TYPE_ID;
}

// --- Cache-driven presentation (seqtypes / spottypes) ---
export const SCURRIUS_SEQ_SPAWN = 10686;
export const SCURRIUS_SEQ_MELEE_1 = 10692;
export const SCURRIUS_SEQ_MELEE_2 = 10693;
export const SCURRIUS_SEQ_RANGED = 10694;
export const SCURRIUS_SEQ_MAGIC = 10696;
export const SCURRIUS_SEQ_STOMP = 10698;
export const SCURRIUS_SEQ_SUMMON_1 = 10700;
export const SCURRIUS_SEQ_SUMMON_2 = 10701;
export const SCURRIUS_SEQ_DEATH = 10705;

/** Magic projectile / impact (spotanim) */
export const SCURRIUS_SPOT_PROJ_MAGIC = 2640;
export const SCURRIUS_SPOT_PROJ_MAGIC_IMPACT = 2641;
/** Ranged “fur ball” projectile / impact */
export const SCURRIUS_SPOT_PROJ_RANGED = 2642;
export const SCURRIUS_SPOT_PROJ_RANGED_IMPACT = 2643;
/** Falling debris (rockfall stomp) */
export const SCURRIUS_SPOT_FALLING_DEBRIS = 2644;
/** Boss body magic cast FX (optional telegraph on NPC) */
export const SCURRIUS_SPOT_ATTACK_MAGIC_BODY = 2638;

/** Public mass room — larger HP pool for multiple players */
export const SCURRIUS_PUBLIC_MAX_HP = 1500;
/** Private / solo instance */
export const SCURRIUS_PRIVATE_MAX_HP = 500;

/** Combat XP multipliers applied on top of league/other multipliers (OSRS wiki: +42.5% group, +20% solo) */
export const SCURRIUS_PUBLIC_COMBAT_XP_MULT = 1.425;
export const SCURRIUS_PRIVATE_COMBAT_XP_MULT = 1.2;

/**
 * Varrock Sewers — Scurrius public lair (approximate tile bounds, plane 0).
 * Spawn tile should lie inside this region for public scaling.
 */
export function isScurriusPublicRoomRegion(x: number, y: number, level: number): boolean {
    if (level !== 0) return false;
    return x >= 3280 && x <= 3305 && y >= 9860 && y <= 9885;
}

export function resolveScurriusMaxHitpoints(
    typeId: number,
    spawnX: number,
    spawnY: number,
    spawnLevel: number,
    derivedHp: number,
): number {
    if (!isScurriusBossTypeId(typeId)) return derivedHp;
    if (typeId === SCURRIUS_INSTANCE_TYPE_ID) return SCURRIUS_PRIVATE_MAX_HP;
    if (typeId === SCURRIUS_PUBLIC_TYPE_ID) {
        return isScurriusPublicRoomRegion(spawnX, spawnY, spawnLevel)
            ? SCURRIUS_PUBLIC_MAX_HP
            : SCURRIUS_PRIVATE_MAX_HP;
    }
    return derivedHp;
}

export function getScurriusCombatXpMultiplier(
    typeId: number | undefined,
    spawnX: number | undefined,
    spawnY: number | undefined,
    spawnLevel: number | undefined,
): number {
    if (typeId === undefined || !isScurriusBossTypeId(typeId)) return 1;
    if (typeId === SCURRIUS_INSTANCE_TYPE_ID) return SCURRIUS_PRIVATE_COMBAT_XP_MULT;
    if (typeId === SCURRIUS_PUBLIC_TYPE_ID) {
        if (
            spawnX === undefined ||
            spawnY === undefined ||
            spawnLevel === undefined ||
            !Number.isFinite(spawnX) ||
            !Number.isFinite(spawnY) ||
            !Number.isFinite(spawnLevel)
        ) {
            return SCURRIUS_PUBLIC_COMBAT_XP_MULT;
        }
        return isScurriusPublicRoomRegion(spawnX, spawnY, spawnLevel)
            ? SCURRIUS_PUBLIC_COMBAT_XP_MULT
            : SCURRIUS_PRIVATE_COMBAT_XP_MULT;
    }
    return 1;
}

/**
 * Public room: 15–30s respawn (OSRS) → 25–50 ticks at 0.6s/tick.
 * Returns undefined when default NPC respawn delay should apply.
 */
export function resolveScurriusRespawnDelayTicks(
    typeId: number,
    spawnX: number,
    spawnY: number,
    spawnLevel: number,
): number | undefined {
    if (typeId !== SCURRIUS_PUBLIC_TYPE_ID) return undefined;
    if (!isScurriusPublicRoomRegion(spawnX, spawnY, spawnLevel)) return undefined;
    const minTicks = 25; // ~15s
    const maxTicks = 50; // ~30s
    return minTicks + Math.floor(Math.random() * (maxTicks - minTicks + 1));
}

/** Per-style max hit (OSRS wiki — solo vs group). */
export function getScurriusStyleMaxHit(
    typeId: number,
    style: "melee" | "magic" | "ranged" | "rockfall",
): number {
    const group = typeId === SCURRIUS_PUBLIC_TYPE_ID;
    if (style === "melee") return 13;
    if (style === "magic") return group ? 8 : 14;
    if (style === "ranged") return group ? 7 : 13;
    return group ? 22 : 24;
}

/**
 * OSRS NPC magic/ranged hit delay (same geometry as CombatEngine.getTileDistance + pickDefaultNpcHitDelay).
 */
export function getScurriusProjectileHitDelayTicks(
    npc: NpcState,
    player: PlayerState,
    attackType: "magic" | "ranged",
): number {
    const px = player.tileX;
    const py = player.tileY;
    const minX = npc.tileX;
    const minY = npc.tileY;
    const size = Math.max(1, npc.size);
    const maxX = minX + size - 1;
    const maxY = minY + size - 1;
    const clampedX = Math.max(minX, Math.min(px, maxX));
    const clampedY = Math.max(minY, Math.min(py, maxY));
    const distance = Math.max(Math.abs(clampedX - px), Math.abs(clampedY - py));
    if (attackType === "magic") {
        return Math.max(1, 1 + Math.floor((1 + distance) / 3));
    }
    return Math.max(1, 1 + Math.floor((3 + distance) / 6));
}

export interface ScurriusAutoAttackPlan {
    attackType: AttackType;
    attackSeq: number;
    projectileId?: number;
    playerImpactSpotId?: number;
    npcCastSpotId?: number;
    maxHit: number;
    hitDelayTicks: number;
}

type StyleOpt = { kind: "melee" | "magic" | "ranged"; weight: number };

/**
 * Picks the next standard (non-stomp, non-summon) Scurrius attack with OSRS-style weights.
 * Caller must validate range again after selection (LOS / distance).
 */
export function planScurriusAutoAttack(
    npc: NpcState,
    player: PlayerState,
    tick: number,
    pathService: PathService,
): ScurriusAutoAttackPlan | undefined {
    const typeId = npc.typeId;
    const meleeOk = canNpcAttackPlayerFromCurrentPosition(
        npc,
        player,
        DEFAULT_NPC_MELEE_RANGE,
        "melee",
        { pathService },
    );
    const magicOk = canNpcAttackPlayerFromCurrentPosition(
        npc,
        player,
        DEFAULT_NPC_MAGIC_RANGE,
        "magic",
        { pathService },
    );
    const rangedOk = canNpcAttackPlayerFromCurrentPosition(
        npc,
        player,
        DEFAULT_NPC_RANGED_RANGE,
        "ranged",
        { pathService },
    );

    const options: StyleOpt[] = [];
    if (meleeOk) options.push({ kind: "melee", weight: 3 });
    if (magicOk) options.push({ kind: "magic", weight: 3 });
    if (rangedOk) options.push({ kind: "ranged", weight: 3 });

    if (options.length === 0) return undefined;

    const total = options.reduce((s, o) => s + o.weight, 0);
    let r = Math.random() * total;
    let kind: "melee" | "magic" | "ranged" = options[0].kind;
    for (const o of options) {
        r -= o.weight;
        if (r <= 0) {
            kind = o.kind;
            break;
        }
    }

    if (kind === "melee") {
        const seq = (tick & 1) === 0 ? SCURRIUS_SEQ_MELEE_1 : SCURRIUS_SEQ_MELEE_2;
        return {
            attackType: "melee",
            attackSeq: seq,
            maxHit: getScurriusStyleMaxHit(typeId, "melee"),
            hitDelayTicks: 1,
        };
    }
    if (kind === "magic") {
        return {
            attackType: "magic",
            attackSeq: SCURRIUS_SEQ_MAGIC,
            projectileId: SCURRIUS_SPOT_PROJ_MAGIC,
            playerImpactSpotId: SCURRIUS_SPOT_PROJ_MAGIC_IMPACT,
            npcCastSpotId: SCURRIUS_SPOT_ATTACK_MAGIC_BODY,
            maxHit: getScurriusStyleMaxHit(typeId, "magic"),
            hitDelayTicks: getScurriusProjectileHitDelayTicks(npc, player, "magic"),
        };
    }
    return {
        attackType: "ranged",
        attackSeq: SCURRIUS_SEQ_RANGED,
        projectileId: SCURRIUS_SPOT_PROJ_RANGED,
        playerImpactSpotId: SCURRIUS_SPOT_PROJ_RANGED_IMPACT,
        maxHit: getScurriusStyleMaxHit(typeId, "ranged"),
        hitDelayTicks: getScurriusProjectileHitDelayTicks(npc, player, "ranged"),
    };
}

const scurriusSwingCounterByNpc = new Map<number, { n: number }>();

/** Periodic special (stomp rockfall vs summon) on auto-attack cadence. */
export function nextScurriusSpecialSwing(npcId: number): "rockfall" | "summon" | undefined {
    const e = scurriusSwingCounterByNpc.get(npcId) ?? { n: 0 };
    e.n += 1;
    scurriusSwingCounterByNpc.set(npcId, e);
    if (e.n % 34 === 0) return "summon";
    if (e.n % 21 === 0) return "rockfall";
    return undefined;
}

export function clearScurriusSwingState(npcId: number): void {
    scurriusSwingCounterByNpc.delete(npcId);
}
