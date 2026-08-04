import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_HALBERD_ITEM_ID = 3204;
const CRYSTAL_HALBERD_ITEM_ID = 13081;
const SWEEP_ENERGY_COST = 30;
const SWEEP_DAMAGE_MULTIPLIER = 1.1;

/**
 * Sweep increases each hit's maximum damage by 10%. OSRS additionally creates
 * up to ten hits in front of the wielder; against a target occupying at least
 * two tiles it instead produces a second hit on that target with an independent
 * accuracy roll. Target footprint and forward-area queries belong to the
 * engagement engine and are not available through CombatAttack's references.
 */
export class DragonHalberdSpec implements WeaponSpecialAttackScript {
    constructor(readonly itemId = DRAGON_HALBERD_ITEM_ID) {}

    readonly energyCost = SWEEP_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            damageMultiplier: SWEEP_DAMAGE_MULTIPLIER,
        });
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void attacker;
        void target;
        void damageCalculated;
        void currentMapClock;
    }
}

export const DRAGON_HALBERD_SPEC = Object.freeze(new DragonHalberdSpec());
export const CRYSTAL_HALBERD_SPEC = Object.freeze(
    new DragonHalberdSpec(CRYSTAL_HALBERD_ITEM_ID),
);
