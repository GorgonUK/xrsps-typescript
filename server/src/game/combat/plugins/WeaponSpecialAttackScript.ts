import type { AttackType } from "../AttackType";
import type { CombatAttack } from "../model/CombatAttack";

export const SpecialAttackMaximumHitSource = Object.freeze({
    Standard: "standard",
    PhysicalMelee: "physical_melee",
    Magic: "magic",
    VisibleMagic: "visible_magic",
} as const);

export type SpecialAttackMaximumHitSource =
    (typeof SpecialAttackMaximumHitSource)[keyof typeof SpecialAttackMaximumHitSource];

/**
 * Attack-roll overrides authored by an individual weapon special-attack script.
 * Every value is optional so a script only needs to describe what it changes.
 */
export interface WeaponSpecialAttackTraitOverrides {
    readonly hitCount?: number;
    /** Splits the final maximum hit across this many sequential hits. */
    readonly maximumHitSplitCount?: number;
    /** Extra reveal delays for each hit, relative to the normal hit delay. */
    readonly hitDelayTicks?: readonly number[];
    /** Replaces this swing's next-attack delay after special energy is consumed. */
    readonly attackSpeedTicks?: number;
    readonly accuracyMultiplier?: number;
    readonly damageMultiplier?: number;
    /** Multiplies the visible Attack level before prayers and stance bonuses. */
    readonly attackLevelMultiplier?: number;
    /** Multiplies the visible Strength level before prayers and stance bonuses. */
    readonly strengthLevelMultiplier?: number;
    /** Applies each multiplier in order and floors the max hit after every stage. */
    readonly damageMultiplierStages?: readonly number[];
    readonly guaranteedHit?: boolean;
    /** Overrides the combat style used to build the initial accuracy/max-hit roll. */
    readonly rollAttackType?: AttackType;
    /** Uses this attack type only when building the target's defence roll. */
    readonly defenceRollAttackType?: AttackType;
    /** Multiplies the completed target defence roll for this special attack. */
    readonly defenceRollMultiplier?: number;
    readonly damageType?: AttackType;
    /** Ignores the target's matching protection prayer for this one hit. */
    readonly ignoreProtectionPrayer?: boolean;
    /** 0 = stab, 1 = slash, 2 = crush. Forces the melee attack and defence roll. */
    readonly meleeAttackBonusIndex?: 0 | 1 | 2;
    /** 0 = stab, 1 = slash, 2 = crush. Forces only the target defence roll. */
    readonly meleeDefenceBonusIndex?: 0 | 1 | 2;
    readonly maximumHitSource?: SpecialAttackMaximumHitSource;
    /** Replaces the standard max hit before special damage modifiers are applied. */
    readonly maxHitOverride?: number;
    /** Base max hit for a visible-Magic special formula before magic-damage bonuses. */
    readonly visibleMagicMaximumHit?: number;
    readonly minimumDamageMultiplier?: number;
    readonly maximumDamageMultiplier?: number;
    /** Flat damage added after percentage-based minimum/maximum calculations. */
    readonly minimumDamageBonus?: number;
    readonly maximumDamageBonus?: number;
    /**
     * Number of independent accuracy rolls used to resolve this one hitsplat.
     * This is distinct from hitCount: a special can make several accuracy rolls
     * while still dealing only one hit.
     */
    readonly accuracyRollCount?: number;
    /** Guarantees only the first accuracy roll of the first hitsplat. */
    readonly guaranteedFirstAccuracyRoll?: boolean;
    /**
     * When the target's current hitpoints are at or below this hit's maximum
     * damage, resolves accuracy with one fixed percentage of the maximum
     * attack roll instead of the ordinary random attack-roll distribution.
     */
    readonly fixedAccuracyRollMultiplierWhenTargetAtOrBelowMaximumDamage?: number;
    /** Damage ranges indexed by the number of successful internal accuracy rolls. */
    readonly damageRangeBySuccessfulAccuracyRolls?: readonly {
        readonly minimumDamageMultiplier: number;
        readonly maximumDamageMultiplier: number;
    }[];
    /** Flat max-hit reduction when every internal accuracy roll succeeds. */
    readonly maximumHitReductionOnFullAccuracyRolls?: number;
    /** Multiplies an enchanted bolt's base activation chance for this shot. */
    readonly enchantedBoltEffectChanceMultiplier?: number;
    /** Prevents the normal attack roll for utility-only special attacks. */
    readonly skipAttack?: boolean;
}

export interface WeaponSpecialAttackScript {
    readonly itemId: number;
    readonly energyCost: number;
    /** Lets an offensive special bypass the normal weapon attack-delay check. */
    readonly bypassAttackDelay?: boolean;

    /**
     * Modifies or executes the initial attack roll parameters (Accuracy & Max Hit scaling).
     */
    modifyAttackTraits(attack: CombatAttack): void;

    /**
     * Runs when special-attack energy is about to be consumed. Utility-only
     * specials can apply their effect here and set skipAttack in
     * modifyAttackTraits to avoid creating a damage hitsplat. Return false to
     * cancel the special without consuming its energy.
     */
    onSpecialActivated?(
        attacker: any,
        target: any,
        currentMapClock: number,
        attack: CombatAttack,
    ): boolean | void;

    /** Resolves a dynamic energy cost immediately before the special is consumed. */
    resolveEnergyCost?(
        attacker: any,
        target: any,
        currentMapClock: number,
        nearbyPlayers?: readonly any[],
    ): number;

    /** Utility-special hook that may select nearby players before energy is spent. */
    onSpecialActivatedWithPlayers?(
        attacker: any,
        target: any,
        currentMapClock: number,
        nearbyPlayers: readonly any[],
        attack: CombatAttack,
    ): boolean | void;

    /**
     * Executes custom content effects (healing, stat drains, freezes, double-hits)
     * right when the damage hitsplat resolves.
     */
    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void;
}

const attackTraitOverrides = new WeakMap<CombatAttack, WeaponSpecialAttackTraitOverrides>();
const executedSpecialAttacks = new WeakSet<CombatAttack>();
const specialAttackers = new WeakMap<CombatAttack, any>();
const specialAttackTargets = new WeakMap<CombatAttack, any>();

/**
 * Records immutable roll overrides for one prepared attack. Repeated calls merge,
 * allowing reusable helpers to contribute independent pieces of a special attack.
 */
export function setWeaponSpecialAttackTraitOverrides(
    attack: CombatAttack,
    overrides: WeaponSpecialAttackTraitOverrides,
): void {
    attackTraitOverrides.set(
        attack,
        Object.freeze({
            ...attackTraitOverrides.get(attack),
            ...overrides,
        }),
    );
}

export function getWeaponSpecialAttackTraitOverrides(
    attack: CombatAttack,
): WeaponSpecialAttackTraitOverrides | undefined {
    return attackTraitOverrides.get(attack);
}

export function clearWeaponSpecialAttackTraitOverrides(attack: CombatAttack): void {
    attackTraitOverrides.delete(attack);
    executedSpecialAttacks.delete(attack);
    specialAttackers.delete(attack);
    specialAttackTargets.delete(attack);
}

/** Provides the live attacker while a script prepares dynamic roll overrides. */
export function setWeaponSpecialAttackAttacker(attack: CombatAttack, attacker: any): void {
    specialAttackers.set(attack, attacker);
}

export function getWeaponSpecialAttackAttacker(attack: CombatAttack): any | undefined {
    return specialAttackers.get(attack);
}

/** Provides the live target while a script prepares dynamic roll overrides. */
export function setWeaponSpecialAttackTarget(attack: CombatAttack, target: any): void {
    specialAttackTargets.set(attack, target);
}

export function getWeaponSpecialAttackTarget(attack: CombatAttack): any | undefined {
    return specialAttackTargets.get(attack);
}

export function markWeaponSpecialAttackExecuted(attack: CombatAttack): void {
    executedSpecialAttacks.add(attack);
}

export function wasWeaponSpecialAttackExecuted(attack: CombatAttack): boolean {
    return executedSpecialAttacks.has(attack);
}
