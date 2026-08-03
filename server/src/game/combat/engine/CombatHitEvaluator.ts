import {
    PRAYER_NAME_SET,
    type PrayerCombatStat,
    type PrayerName,
    getPrayerDefinition,
} from "../../../../../client/rs/prayer/prayers";
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ServerServices } from "../../ServerServices";
import { NpcState } from "../../npc";
import { PlayerState } from "../../player";
import { OverheadType } from "../../prayer/OverheadType";
import { resolveElementalSpellBaseMaxHit } from "../../spells/ElementalSpellMaxHit";
import {
    calculatePoweredStaffBaseDamage,
    getPoweredStaffSpellData,
    getSpellData,
} from "../../spells/SpellDataProvider";
import { AttackType } from "../AttackType";
import { getAttackStyle as getWeaponAttackStyle } from "../WeaponDataProvider";
import {
    calculateAttackRoll,
    calculateDefenceRoll,
    calculateHitChance,
    rollAccuracy,
} from "../formulas/Accuracy";
import { calculateMeleeMaxHit } from "../formulas/MeleeMaxHit";
import { calculateRangedMaxHit } from "../formulas/RangedMaxHit";
import type { CombatAttack, CombatAttackStyle } from "../model/CombatAttack";
import type { CombatEntityRef } from "../model/CombatEntityRef";
import { CombatEntityType } from "../model/CombatEntityRef";
import type { WeaponSpecialAttack } from "../plugins/WeaponCombatProfile";
import { SpecialAttackMaximumHitSource } from "../plugins/WeaponSpecialAttackScript";
import { CombatAttributes } from "../state/CombatAttributes";
import type { CombatEntity } from "./CombatTargetResolver";

const PLAYER_EFFECTIVE_LEVEL_BONUS = 8;
const NPC_EFFECTIVE_LEVEL_BONUS = 9;
const MAGIC_ATTACK_BONUS_INDEX = 3;
const RANGED_ATTACK_BONUS_INDEX = 4;
const STAB_DEFENCE_BONUS_INDEX = 5;
const MAGIC_DEFENCE_BONUS_INDEX = 8;
const RANGED_DEFENCE_BONUS_INDEX = 9;
const MELEE_STRENGTH_BONUS_INDEX = 10;
const RANGED_STRENGTH_BONUS_INDEX = 11;
const MAGIC_DAMAGE_BONUS_INDEX = 12;

export interface CombatRollProfile {
    readonly effectiveAttack: number;
    readonly attackBonus: number;
    readonly effectiveDefence: number;
    readonly defenceBonus: number;
    readonly maxHit: number;
}

export interface CombatHitEvaluation {
    readonly valid: boolean;
    readonly attack: CombatAttack;
    readonly attacker?: CombatEntity;
    readonly target?: CombatEntity;
    readonly attackRoll: number;
    readonly defenceRoll: number;
    readonly hitChance: number;
    readonly maxHit: number;
    readonly landed: boolean;
    readonly damage: number;
    readonly reason?: "attacker_not_found" | "target_not_found";
}

export interface CombatHitEvaluatorOptions {
    resolveEntity(reference: CombatEntityRef): CombatEntity | undefined;
    getEquipmentBonuses(player: PlayerState): readonly number[];
    random?: () => number;
}

/** Creates the canonical hit evaluator against the live world registries. */
export function createCombatHitEvaluator(
    services: ServerServices,
    random?: () => number,
): CombatHitEvaluator {
    return new CombatHitEvaluator({
        resolveEntity: (reference) =>
            reference.type === CombatEntityType.Player
                ? services.players?.getById(reference.id)
                : services.npcManager?.getById(reference.id),
        getEquipmentBonuses: (player) =>
            services.equipmentService.computeEquipmentStatBonuses(player),
        random,
    });
}

interface StanceBonuses {
    readonly accuracy: number;
    readonly strength: number;
    readonly defence: number;
}

interface AttackProfile {
    readonly effectiveAttack: number;
    readonly attackBonus: number;
    readonly maxHit: number;
    readonly meleeBonusIndex: number;
}

/** Rolls one immutable attack using the integer Phase 2 formula functions. */
export class CombatHitEvaluator {
    private readonly random: () => number;

    constructor(private readonly options: CombatHitEvaluatorOptions) {
        this.random = options.random ?? Math.random;
    }

    evaluate(attack: CombatAttack): CombatHitEvaluation {
        return this.evaluateRoll(attack, {
            energyCostPercent: 0,
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
        });
    }

    evaluateSpecialAttack(
        attack: CombatAttack,
        special: WeaponSpecialAttack,
    ): readonly CombatHitEvaluation[] {
        const hitCount = Math.max(1, Math.trunc(special.hitCount));
        const evaluations: CombatHitEvaluation[] = [];
        for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
            evaluations.push(this.evaluateRoll(attack, special));
        }
        return Object.freeze(evaluations);
    }

    private evaluateRoll(attack: CombatAttack, special: WeaponSpecialAttack): CombatHitEvaluation {
        const attacker = this.options.resolveEntity(attack.attacker);
        if (!attacker) return this.invalid(attack, "attacker_not_found");

        const target = this.options.resolveEntity(attack.target);
        if (!target) return this.invalid(attack, "target_not_found", attacker);

        const rollAttack = this.withRollAttackType(attack, special.rollAttackType);
        const rolls = this.buildRollProfile(rollAttack, attacker, target);
        const accuracyMultiplier = this.nonNegativeMultiplier(
            special.accuracyMultiplier,
            "special attack accuracy",
        );
        const damageMultiplier = this.nonNegativeMultiplier(
            special.damageMultiplier,
            "special attack damage",
        );
        const attackRoll = Math.floor(
            calculateAttackRoll(rolls.effectiveAttack, rolls.attackBonus) * accuracyMultiplier,
        );
        const defenceRoll = calculateDefenceRoll(rolls.effectiveDefence, rolls.defenceBonus);
        const hitChance = special.guaranteedHit ? 1 : calculateHitChance(attackRoll, defenceRoll);
        const sourcedMaxHit =
            special.maximumHitSource === SpecialAttackMaximumHitSource.PhysicalMelee
                ? this.buildPhysicalMeleeMaxHit(attack, attacker)
                : special.maximumHitSource === SpecialAttackMaximumHitSource.VisibleMagic
                  ? this.buildVisibleMagicMaxHit(attacker, special.visibleMagicMaximumHit ?? 0)
                  : rolls.maxHit;
        const baseMaxHit =
            special.maxHitOverride === undefined
                ? sourcedMaxHit
                : this.nonNegativeInteger(special.maxHitOverride, "special attack max hit");
        const scaledMaxHit = Math.max(0, Math.floor(baseMaxHit * damageMultiplier));
        const minimumDamage = Math.floor(
            scaledMaxHit *
                this.nonNegativeMultiplier(
                    special.minimumDamageMultiplier ?? 0,
                    "special attack minimum damage",
                ),
        );
        const maximumDamage = Math.floor(
            scaledMaxHit *
                this.nonNegativeMultiplier(
                    special.maximumDamageMultiplier ?? 1,
                    "special attack maximum damage",
                ),
        );
        if (maximumDamage < minimumDamage) {
            throw new RangeError(
                `Combat special attack maximum damage ${maximumDamage} cannot be below minimum damage ${minimumDamage}`,
            );
        }
        const maxHit = Math.max(0, maximumDamage);
        const landed = special.guaranteedHit === true || rollAccuracy(hitChance, this.random);
        const rolledDamage = landed
            ? minimumDamage + Math.floor(this.nextRandom() * (maximumDamage - minimumDamage + 1))
            : 0;
        const damage = this.applyProtectionPrayer(
            rolledDamage,
            special.damageType ?? rollAttack.traits.type,
            attacker,
            target,
        );

        return Object.freeze({
            valid: true,
            attack,
            attacker,
            target,
            attackRoll,
            defenceRoll,
            hitChance,
            maxHit,
            landed,
            damage,
        });
    }

    private buildPhysicalMeleeMaxHit(attack: CombatAttack, attacker: CombatEntity): number {
        const physicalMeleeAttack: CombatAttack = {
            ...attack,
            traits: {
                ...attack.traits,
                type: AttackType.Melee,
            },
        };
        return this.buildAttackProfile(physicalMeleeAttack, attacker).maxHit;
    }

    private buildVisibleMagicMaxHit(attacker: CombatEntity, baseMaximumHit: number): number {
        if (!(attacker instanceof PlayerState)) return 0;
        const base = Math.max(0, Math.floor(baseMaximumHit));
        if (base <= 0) return 0;

        const visibleMagicLevel = this.getBoostedLevel(attacker, SkillId.Magic);
        const internalMaximumHit = Math.min(base, Math.floor((base * visibleMagicLevel) / 99 + 1));
        return this.applyMagicDamageBonuses(
            internalMaximumHit,
            attacker,
            this.options.getEquipmentBonuses(attacker),
        );
    }

    private withRollAttackType(
        attack: CombatAttack,
        rollAttackType: AttackType | undefined,
    ): CombatAttack {
        if (rollAttackType === undefined || rollAttackType === attack.traits.type) return attack;
        return {
            ...attack,
            traits: {
                ...attack.traits,
                type: rollAttackType,
            },
        };
    }

    private applyProtectionPrayer(
        damage: number,
        attackType: AttackType,
        attacker: CombatEntity,
        target: CombatEntity,
    ): number {
        if (!(damage > 0)) return 0;

        const requiredOverhead = this.overheadForAttackType(attackType);
        if (requiredOverhead === OverheadType.NONE) return damage;

        const activeOverhead = target.combatAttributes.get(CombatAttributes.ACTIVE_OVERHEAD_PRAYER);
        if (activeOverhead !== requiredOverhead) return damage;

        // Protection prayers fully block ordinary NPC damage. Against another
        // player they reduce the rolled damage by 40%, leaving 60% applied.
        return attacker instanceof NpcState ? 0 : Math.floor(damage * 0.6);
    }

    private overheadForAttackType(attackType: AttackType): OverheadType {
        switch (attackType) {
            case AttackType.Melee:
                return OverheadType.MELEE;
            case AttackType.Ranged:
                return OverheadType.RANGED;
            case AttackType.Magic:
                return OverheadType.MAGIC;
            default:
                return OverheadType.NONE;
        }
    }

    private nonNegativeMultiplier(value: number, field: string): number {
        if (!Number.isFinite(value) || value < 0) {
            throw new RangeError(
                `Combat ${field} multiplier must be non-negative; received ${value}`,
            );
        }
        return value;
    }

    private nonNegativeInteger(value: number, field: string): number {
        if (!Number.isFinite(value) || value < 0) {
            throw new RangeError(`Combat ${field} must be non-negative; received ${value}`);
        }
        return Math.trunc(value);
    }

    buildRollProfile(
        attack: CombatAttack,
        attacker: CombatEntity,
        target: CombatEntity,
    ): CombatRollProfile {
        const attackProfile = this.buildAttackProfile(attack, attacker);
        const defenceProfile = this.buildDefenceProfile(
            attack,
            target,
            attackProfile.meleeBonusIndex,
        );
        return {
            effectiveAttack: attackProfile.effectiveAttack,
            attackBonus: attackProfile.attackBonus,
            effectiveDefence: defenceProfile.effectiveDefence,
            defenceBonus: defenceProfile.defenceBonus,
            maxHit: attackProfile.maxHit,
        };
    }

    private buildAttackProfile(attack: CombatAttack, attacker: CombatEntity): AttackProfile {
        if (attacker instanceof NpcState) {
            return this.buildNpcAttackProfile(attack, attacker);
        }
        return this.buildPlayerAttackProfile(attack, attacker);
    }

    private buildPlayerAttackProfile(attack: CombatAttack, player: PlayerState): AttackProfile {
        const bonuses = this.options.getEquipmentBonuses(player);
        const stance = this.resolveStanceBonuses(attack.traits.style, attack.traits.type);
        const meleeBonusIndex = this.resolveMeleeBonusIndex(player, bonuses);

        switch (attack.traits.type) {
            case AttackType.Ranged: {
                const effectiveAttack = this.playerEffectiveLevel(
                    this.getBoostedLevel(player, SkillId.Ranged),
                    this.getPrayerMultiplier(player, "ranged"),
                    stance.accuracy,
                );
                const effectiveStrength = this.playerEffectiveLevel(
                    this.getBoostedLevel(player, SkillId.Ranged),
                    this.getPrayerMultiplier(player, "ranged_strength"),
                    stance.strength,
                );
                return {
                    effectiveAttack,
                    attackBonus: this.bonusAt(bonuses, RANGED_ATTACK_BONUS_INDEX),
                    maxHit: calculateRangedMaxHit(
                        effectiveStrength,
                        this.bonusAt(bonuses, RANGED_STRENGTH_BONUS_INDEX),
                    ),
                    meleeBonusIndex,
                };
            }
            case AttackType.Magic: {
                const effectiveMagic = this.playerEffectiveLevel(
                    this.getBoostedLevel(player, SkillId.Magic),
                    this.getPrayerMultiplier(player, "magic"),
                    0,
                );
                return {
                    effectiveAttack: effectiveMagic,
                    attackBonus: this.bonusAt(bonuses, MAGIC_ATTACK_BONUS_INDEX),
                    maxHit: this.calculatePlayerMagicMaxHit(
                        attack,
                        player,
                        effectiveMagic,
                        bonuses,
                    ),
                    meleeBonusIndex,
                };
            }
            case AttackType.Melee:
            default: {
                const effectiveAttack = this.playerEffectiveLevel(
                    this.getBoostedLevel(player, SkillId.Attack),
                    this.getPrayerMultiplier(player, "attack"),
                    stance.accuracy,
                );
                const effectiveStrength = this.playerEffectiveLevel(
                    this.getBoostedLevel(player, SkillId.Strength),
                    this.getPrayerMultiplier(player, "strength"),
                    stance.strength,
                );
                return {
                    effectiveAttack,
                    attackBonus: this.bonusAt(bonuses, meleeBonusIndex),
                    maxHit: calculateMeleeMaxHit(
                        effectiveStrength,
                        this.bonusAt(bonuses, MELEE_STRENGTH_BONUS_INDEX),
                    ),
                    meleeBonusIndex,
                };
            }
        }
    }

    private buildNpcAttackProfile(attack: CombatAttack, npc: NpcState): AttackProfile {
        const profile = npc.combat;
        switch (attack.traits.type) {
            case AttackType.Ranged:
                return {
                    effectiveAttack:
                        Math.max(0, Math.trunc(profile.rangedLevel)) + NPC_EFFECTIVE_LEVEL_BONUS,
                    attackBonus: this.clampBonus(profile.rangedBonus),
                    maxHit: Math.max(0, Math.trunc(profile.maxHit)),
                    meleeBonusIndex: 1,
                };
            case AttackType.Magic:
                return {
                    effectiveAttack:
                        Math.max(0, Math.trunc(profile.magicLevel)) + NPC_EFFECTIVE_LEVEL_BONUS,
                    attackBonus: this.clampBonus(profile.magicBonus),
                    maxHit: Math.max(0, Math.trunc(profile.maxHit)),
                    meleeBonusIndex: 1,
                };
            case AttackType.Melee:
            default:
                return {
                    effectiveAttack:
                        Math.max(0, Math.trunc(profile.attackLevel)) + NPC_EFFECTIVE_LEVEL_BONUS,
                    attackBonus: this.clampBonus(profile.attackBonus),
                    maxHit: Math.max(0, Math.trunc(profile.maxHit)),
                    meleeBonusIndex: 1,
                };
        }
    }

    private buildDefenceProfile(
        attack: CombatAttack,
        target: CombatEntity,
        meleeBonusIndex: number,
    ): { effectiveDefence: number; defenceBonus: number } {
        if (target instanceof NpcState) {
            const profile = target.combat;
            const effectiveDefence =
                attack.traits.type === AttackType.Magic
                    ? Math.floor(
                          Math.max(0, profile.magicLevel) * 0.7 +
                              Math.max(0, profile.defenceLevel) * 0.3,
                      ) + NPC_EFFECTIVE_LEVEL_BONUS
                    : Math.max(0, Math.trunc(profile.defenceLevel)) + NPC_EFFECTIVE_LEVEL_BONUS;
            const defenceBonus =
                attack.traits.type === AttackType.Magic
                    ? profile.defenceMagic
                    : attack.traits.type === AttackType.Ranged
                      ? profile.defenceRanged
                      : meleeBonusIndex === 0
                        ? profile.defenceStab
                        : meleeBonusIndex === 2
                          ? profile.defenceCrush
                          : profile.defenceSlash;
            if (attack.traits.type === AttackType.Magic) {
                return {
                    effectiveDefence,
                    defenceBonus: this.resolveMagicDefenceBonus(target, defenceBonus),
                };
            }
            return { effectiveDefence, defenceBonus: this.clampBonus(defenceBonus) };
        }

        const bonuses = this.options.getEquipmentBonuses(target);
        const stance = this.resolveStanceBonuses(
            this.resolvePlayerAttackStyle(target),
            target.getCurrentAttackType() ?? AttackType.Melee,
        );
        if (attack.traits.type === AttackType.Magic) {
            const prayedDefence = Math.floor(
                this.getBoostedLevel(target, SkillId.Defence) *
                    this.getPrayerMultiplier(target, "defence"),
            );
            const prayedMagic = Math.floor(
                this.getBoostedLevel(target, SkillId.Magic) *
                    this.getPrayerMultiplier(target, "magic"),
            );
            return {
                effectiveDefence:
                    Math.floor(prayedMagic * 0.7 + (prayedDefence + stance.defence) * 0.3) +
                    PLAYER_EFFECTIVE_LEVEL_BONUS,
                defenceBonus: this.resolveMagicDefenceBonus(
                    target,
                    this.bonusAt(bonuses, MAGIC_DEFENCE_BONUS_INDEX),
                ),
            };
        }

        const defenceBonusIndex =
            attack.traits.type === AttackType.Ranged
                ? RANGED_DEFENCE_BONUS_INDEX
                : STAB_DEFENCE_BONUS_INDEX + Math.max(0, Math.min(2, meleeBonusIndex));
        return {
            effectiveDefence: this.playerEffectiveLevel(
                this.getBoostedLevel(target, SkillId.Defence),
                this.getPrayerMultiplier(target, "defence"),
                stance.defence,
            ),
            defenceBonus: this.bonusAt(bonuses, defenceBonusIndex),
        };
    }

    private resolveMagicDefenceBonus(target: CombatEntity, baseBonus: number): number {
        const base = this.clampBonus(baseBonus);
        const drain = Math.max(
            0,
            Math.floor(target.combatAttributes.get(CombatAttributes.MAGIC_DEFENCE_BONUS_DRAIN)),
        );
        const drainableBonus = Math.max(0, base - drain);
        target.combatAttributes.set(
            CombatAttributes.MAGIC_DEFENCE_BONUS_CURRENT,
            drainableBonus,
        );
        return drain > 0 ? drainableBonus : base;
    }

    private calculatePlayerMagicMaxHit(
        attack: CombatAttack,
        player: PlayerState,
        effectiveMagic: number,
        bonuses: readonly number[],
    ): number {
        const magicLevel = this.getBoostedLevel(player, SkillId.Magic);
        const spellId = attack.traits.spellId;
        let baseDamage: number | undefined;

        if (spellId !== undefined && spellId > 0) {
            const spell = getSpellData(spellId);
            if (spell) {
                baseDamage = resolveElementalSpellBaseMaxHit(spellId, magicLevel, spell.baseMaxHit);
            }
        }

        if (baseDamage === undefined && attack.traits.weaponId !== undefined) {
            const poweredStaff = getPoweredStaffSpellData(attack.traits.weaponId);
            if (poweredStaff) {
                baseDamage = calculatePoweredStaffBaseDamage(
                    magicLevel,
                    poweredStaff.maxHitFormula,
                );
            }
        }

        baseDamage ??= Math.max(0, Math.floor(effectiveMagic / 3));
        return this.applyMagicDamageBonuses(baseDamage, player, bonuses);
    }

    private applyMagicDamageBonuses(
        baseDamage: number,
        player: PlayerState,
        bonuses: readonly number[],
    ): number {
        const equipmentPercent = Math.max(0, this.bonusAt(bonuses, MAGIC_DAMAGE_BONUS_INDEX));
        const prayerPercent = Math.max(
            0,
            (this.getPrayerMultiplier(player, "magic_damage") - 1) * 100,
        );
        return Math.floor(Math.max(0, baseDamage) * (1 + (equipmentPercent + prayerPercent) / 100));
    }

    private resolveMeleeBonusIndex(player: PlayerState, bonuses: readonly number[]): number {
        const mapped = player.getCurrentMeleeBonusIndex();
        if (mapped !== undefined && mapped >= 0 && mapped <= 2) return Math.trunc(mapped);

        let bestIndex = 1;
        let bestBonus = Number.NEGATIVE_INFINITY;
        for (let index = 0; index <= 2; index++) {
            const value = this.bonusAt(bonuses, index);
            if (value > bestBonus) {
                bestBonus = value;
                bestIndex = index;
            }
        }
        return bestIndex;
    }

    private resolvePlayerAttackStyle(player: PlayerState): CombatAttackStyle | null {
        try {
            const style = getWeaponAttackStyle(
                player.combat.weaponItemId > 0 ? player.combat.weaponItemId : 0,
                player.combat.styleSlot,
            );
            switch (style) {
                case "accurate":
                case "aggressive":
                case "controlled":
                case "defensive":
                case "rapid":
                case "longrange":
                    return style;
                default:
                    return null;
            }
        } catch {
            return null;
        }
    }

    private resolveStanceBonuses(
        style: CombatAttackStyle | null,
        attackType: AttackType,
    ): StanceBonuses {
        switch (style) {
            case "accurate":
                return {
                    accuracy: 3,
                    strength: attackType === AttackType.Ranged ? 3 : 0,
                    defence: 0,
                };
            case "aggressive":
                return { accuracy: 0, strength: 3, defence: 0 };
            case "controlled":
                return { accuracy: 1, strength: 1, defence: 1 };
            case "defensive":
                return { accuracy: 0, strength: 0, defence: 3 };
            case "longrange":
                return { accuracy: 1, strength: 1, defence: 3 };
            case "rapid":
            default:
                return { accuracy: 0, strength: 0, defence: 0 };
        }
    }

    private playerEffectiveLevel(level: number, prayerMultiplier: number, stance: number): number {
        return (
            Math.floor(Math.max(0, level) * Math.max(0, prayerMultiplier)) +
            Math.trunc(stance) +
            PLAYER_EFFECTIVE_LEVEL_BONUS
        );
    }

    private getBoostedLevel(player: PlayerState, skillId: SkillId): number {
        const skill = player.skillSystem.getSkill(skillId);
        return Math.max(0, Math.trunc(skill.baseLevel + skill.boost));
    }

    private getPrayerMultiplier(player: PlayerState, stat: PrayerCombatStat): number {
        let multiplier = 1;
        for (const prayer of player.prayer.activePrayers) {
            if (!PRAYER_NAME_SET.has(prayer as PrayerName)) continue;
            const value = getPrayerDefinition(prayer as PrayerName).combatMultipliers?.[stat];
            if (value !== undefined && value > multiplier) multiplier = value;
        }
        return multiplier;
    }

    private bonusAt(bonuses: readonly number[], index: number): number {
        return this.clampBonus(bonuses[index] ?? 0);
    }

    private clampBonus(value: number): number {
        return Math.max(-64, Number.isFinite(value) ? Math.trunc(value) : 0);
    }

    private nextRandom(): number {
        const value = this.random();
        if (!Number.isFinite(value) || value < 0 || value >= 1) {
            throw new RangeError(`Combat random source must return [0, 1); received ${value}`);
        }
        return value;
    }

    private invalid(
        attack: CombatAttack,
        reason: "attacker_not_found" | "target_not_found",
        attacker?: CombatEntity,
    ): CombatHitEvaluation {
        return Object.freeze({
            valid: false,
            attack,
            attacker,
            attackRoll: 0,
            defenceRoll: 0,
            hitChance: 0,
            maxHit: 0,
            landed: false,
            damage: 0,
            reason,
        });
    }
}
