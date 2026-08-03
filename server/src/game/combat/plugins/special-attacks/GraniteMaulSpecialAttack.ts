import type { CombatAttack } from "../../model/CombatAttack";
import { SpecialAttackTiming, type WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const GRANITE_MAUL_ITEM_IDS = Object.freeze([4153, 12848, 24225]);

const GRANITE_MAUL_SPECIAL = Object.freeze({
    energyCostPercent: 50,
    hitCount: 1,
    accuracyMultiplier: 1,
    damageMultiplier: 1,
    attackAnimation: 1667,
    castGraphic: Object.freeze({ id: 340 }),
    attackSoundId: 2715,
});

export const GRANITE_MAUL_SPECIAL_ATTACK_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:granite_maul",
    itemIds: GRANITE_MAUL_ITEM_IDS,
    specialAttackEnergyCost: GRANITE_MAUL_SPECIAL.energyCostPercent,
    specialAttackTiming: SpecialAttackTiming.Instant,
    handleSpecialAttack: () => GRANITE_MAUL_SPECIAL,
});

export class GraniteMaulSpecialAttackScript implements WeaponSpecialAttackScript {
    readonly energyCost = GRANITE_MAUL_SPECIAL.energyCostPercent;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: GRANITE_MAUL_SPECIAL.hitCount,
            accuracyMultiplier: GRANITE_MAUL_SPECIAL.accuracyMultiplier,
            damageMultiplier: GRANITE_MAUL_SPECIAL.damageMultiplier,
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

export const GRANITE_MAUL_SPECIAL_ATTACK_SCRIPTS = Object.freeze(
    GRANITE_MAUL_ITEM_IDS.map((itemId) =>
        Object.freeze(new GraniteMaulSpecialAttackScript(itemId)),
    ),
);
