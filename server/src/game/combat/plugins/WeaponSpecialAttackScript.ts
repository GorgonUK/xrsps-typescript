import type { AttackType } from "../AttackType";
import type { CombatAttack } from "../model/CombatAttack";

export const SpecialAttackMaximumHitSource = Object.freeze({
    Standard: "standard",
    PhysicalMelee: "physical_melee",
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
    readonly accuracyMultiplier?: number;
    readonly damageMultiplier?: number;
    readonly guaranteedHit?: boolean;
    /** Overrides the combat style used to build the initial accuracy/max-hit roll. */
    readonly rollAttackType?: AttackType;
    readonly damageType?: AttackType;
    readonly maximumHitSource?: SpecialAttackMaximumHitSource;
    /** Base max hit for a visible-Magic special formula before magic-damage bonuses. */
    readonly visibleMagicMaximumHit?: number;
    readonly minimumDamageMultiplier?: number;
    readonly maximumDamageMultiplier?: number;
    /** Prevents the normal attack roll for utility-only special attacks. */
    readonly skipAttack?: boolean;
}

export interface WeaponSpecialAttackScript {
    readonly itemId: number;
    readonly energyCost: number;

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
}

export function markWeaponSpecialAttackExecuted(attack: CombatAttack): void {
    executedSpecialAttacks.add(attack);
}

export function wasWeaponSpecialAttackExecuted(attack: CombatAttack): boolean {
    return executedSpecialAttacks.has(attack);
}
