import { VARP_SPECIAL_ATTACK, VARP_SPECIAL_ENERGY } from "../../../../../client/common/vars";
import { EquipmentSlot } from "../../../../../client/rs/config/player/Equipment";
import type { TickFrame } from "../../../network/wsServerTypes";
import { logger } from "../../../utils/logger";
import type { ServerServices } from "../../ServerServices";
import { getProjectileParams } from "../../data/ProjectileParamsProvider";
import { NpcState } from "../../npc";
import { PlayerState } from "../../player";
import {
    type PoweredStaffSpellData,
    type SpellDataEntry,
    getPoweredStaffSpellData,
    getSpellData,
    resolveMagicCastSpotAnimHeight,
} from "../../spells/SpellDataProvider";
import { AttackType } from "../AttackType";
import { type EnchantedBoltEffect, getEnchantedBoltEffect } from "../AmmoSystem";
import { DamageType, damageTracker } from "../DamageTracker";
import { multiCombatSystem } from "../MultiCombatZones";
import { getNpcPoisonConfig, hasVenomImmunityEquipment } from "../PoisonVenomSystem";
import type { CombatAttack } from "../model/CombatAttack";
import {
    type CombatEntityRef,
    CombatEntityType,
    npcCombatEntityRef,
    playerCombatEntityRef,
} from "../model/CombatEntityRef";
import { CombatPluginRegistry } from "../plugins/CombatPluginRegistry";
import { SpecialAttackContainer } from "../plugins/SpecialAttackContainer";
import {
    type WeaponCombatContext,
    type WeaponCombatProfile,
    type WeaponGraphicProfile,
    type WeaponProjectileProfile,
    type WeaponSpecialAttack,
    resolveWeaponProfileValue,
} from "../plugins/WeaponCombatProfile";
import {
    clearWeaponSpecialAttackTraitOverrides,
    setWeaponSpecialAttackAttacker,
    getWeaponSpecialAttackTraitOverrides,
    markWeaponSpecialAttackExecuted,
    wasWeaponSpecialAttackExecuted,
} from "../plugins/WeaponSpecialAttackScript";
import {
    ANCIENT_GODSWORD_BLOOD_SACRIFICE_PROFILE_ID,
    applyAncientGodswordBloodSacrificeHeal,
    createAncientGodswordBloodSacrificeAttack,
    getAncientGodswordBloodSacrificeDamage,
    takeDueAncientGodswordBloodSacrifices,
} from "../plugins/special-attacks/AncientGodswordSpec";
import { CombatAttributes } from "../state/CombatAttributes";
import { SkillId } from "../../../../../client/rs/skill/skills";
import {
    type CombatHitEvaluation,
    type CombatHitEvaluator,
    createCombatHitEvaluator,
} from "./CombatHitEvaluator";
import type { CombatRetaliationEngine } from "./CombatRetaliationEngine";
import type { CombatEntity } from "./CombatTargetResolver";
import {
    type AppliedCombatHit,
    DeferredHitQueue,
    DeferredHitsplatType,
    type PendingCombatHit,
} from "./DeferredHitQueue";

interface CombatVisualDefinition {
    readonly attackAnimation?: number;
    readonly castGraphic?: WeaponGraphicProfile;
    readonly impactGraphic?: WeaponGraphicProfile;
    readonly splashGraphic?: WeaponGraphicProfile;
    readonly projectile?: WeaponProjectileProfile;
    readonly spellData?: SpellDataEntry;
}

const TOXIC_BLOWPIPE_ITEM_ID = 12926;
const STAFF_OF_THE_DEAD_ITEM_ID = 11791;
const TOXIC_STAFF_OF_THE_DEAD_CHARGED_ITEM_ID = 12904;
const STAFF_OF_LIGHT_ITEM_ID = 22296;
const STAFF_OF_BALANCE_ITEM_ID = 24144;
const POWER_OF_DEATH_STAFF_ITEM_IDS = new Set([
    STAFF_OF_THE_DEAD_ITEM_ID,
    TOXIC_STAFF_OF_THE_DEAD_CHARGED_ITEM_ID,
    STAFF_OF_LIGHT_ITEM_ID,
    STAFF_OF_BALANCE_ITEM_ID,
]);
const SERPENTINE_HELM_IDS = new Set([12931, 13197, 13199]);
const AVAS_ATTRACTOR_ITEM_ID = 10498;
const AVAS_ASSEMBLER_ITEM_IDS = new Set([22109, 27374]);
const AVAS_ACCUMULATOR_ITEM_IDS = new Set([10499, 9756, 9757, 13342]);

export interface CombatHitProcessingResult {
    readonly processedAttacks: number;
    readonly queuedHits: number;
    readonly rejectedAttacks: number;
}

/** Converts prepared attack cycles into visuals, rolls, and deferred hits. */
export class CombatHitProcessor {
    private readonly evaluator: CombatHitEvaluator;
    private readonly deferredHits: DeferredHitQueue;

    constructor(
        private readonly services: ServerServices,
        private readonly plugins: CombatPluginRegistry = CombatPluginRegistry.shared,
        private readonly retaliationEngine?: CombatRetaliationEngine,
    ) {
        SpecialAttackContainer.initialize();
        this.evaluator = createCombatHitEvaluator(this.services);
        this.deferredHits = new DeferredHitQueue({
            resolveEntity: (reference) => this.resolveEntity(reference),
            transformDamage: (pending, target, source) =>
                this.transformIncomingDamage(pending, target, source),
            onHitApplied: (hit, frame) => this.onHitApplied(hit, frame),
        });
    }

    processPreparedAttacks(
        attacks: readonly CombatAttack[],
        currentMapClock: number,
    ): CombatHitProcessingResult {
        const clock = this.mapClock(currentMapClock);
        let processedAttacks = 0;
        let queuedHits = 0;
        let rejectedAttacks = 0;

        for (const attack of attacks) {
            const attacker = this.resolveEntity(attack.attacker);
            const target = this.resolveEntity(attack.target);
            if (
                !attacker ||
                !target ||
                !this.isAlive(attacker, clock) ||
                !this.isAlive(target, clock)
            ) {
                rejectedAttacks++;
                continue;
            }

            const distanceTiles = this.distanceBetween(attacker, target);
            const profile = this.resolveWeaponProfile(attack, attacker);
            const context: WeaponCombatContext = Object.freeze({
                attack,
                attacker,
                target,
                currentMapClock: clock,
                distanceTiles,
            });

            if (
                attacker instanceof PlayerState &&
                attack.traits.weaponId === TOXIC_BLOWPIPE_ITEM_ID &&
                attack.traits.type === AttackType.Ranged &&
                !this.consumeToxicBlowpipeShot(attacker, clock)
            ) {
                rejectedAttacks++;
                continue;
            }

            this.invokePlugin(profile.id, "onAttack", () => profile.onAttack?.(context));

            const specialAttack = this.resolveSpecialAttack(profile, context);
            if (specialAttack?.skipAttack) {
                processedAttacks++;
                continue;
            }
            const enchantedBoltEffect = this.rollEnchantedBoltEffect(attacker, attack, specialAttack);
            const rollSpecial = this.applyEnchantedBoltRollModifiers(
                specialAttack,
                enchantedBoltEffect,
            );
            const rawEvaluations = rollSpecial
                ? this.evaluator.evaluateSpecialAttack(attack, rollSpecial)
                : [this.evaluator.evaluate(attack)];
            if (rawEvaluations.some((evaluation) => !evaluation.valid)) {
                rejectedAttacks++;
                continue;
            }
            const evaluations = rawEvaluations.map((evaluation) =>
                this.normalizeEvaluation(this.invokeTransform(profile, evaluation, context)),
            );
            if (evaluations.some((evaluation) => !evaluation.valid)) {
                rejectedAttacks++;
                continue;
            }
            const travelDelayTicks = this.resolveTravelDelay(profile, context);
            const visuals = this.resolveVisuals(profile, context, specialAttack);

            this.playAttackVisuals(context, profile, visuals, travelDelayTicks, specialAttack);

            for (const evaluation of evaluations) {
                this.deferredHits.enqueue({
                    attack,
                    source: attack.attacker,
                    target: attack.target,
                    damage: evaluation.damage,
                    maxHit: evaluation.maxHit,
                    landed: evaluation.landed,
                    hitsplatType: evaluation.landed
                        ? DeferredHitsplatType.Normal
                        : DeferredHitsplatType.Block,
                    attackType: specialAttack?.damageType ?? attack.traits.type,
                    revealClock: clock + travelDelayTicks,
                    profileId: profile.id,
                    enchantedBoltEffect,
                });

                this.invokePlugin(profile.id, "onHitEvaluated", () =>
                    profile.onHitEvaluated?.(evaluation, context),
                );
            }
            processedAttacks++;
            queuedHits += evaluations.length;
            queuedHits += this.queueAncientAreaHits(
                attack,
                attacker,
                target,
                profile,
                clock,
                travelDelayTicks,
            );
        }

        return { processedAttacks, queuedHits, rejectedAttacks };
    }

    processDeferredHits(currentMapClock: number, frame: TickFrame): readonly AppliedCombatHit[] {
        this.queueDueAncientGodswordBloodSacrifices(currentMapClock);
        return this.deferredHits.processTick(currentMapClock, frame);
    }

    getPendingHitCount(): number {
        return this.deferredHits.size();
    }

    private resolveEntity(reference: CombatEntityRef): CombatEntity | undefined {
        return reference.type === CombatEntityType.Player
            ? this.services.players?.getById(reference.id)
            : this.services.npcManager?.getById(reference.id);
    }

    private queueAncientAreaHits(
        primaryAttack: CombatAttack,
        attacker: CombatEntity,
        primaryTarget: CombatEntity,
        profile: WeaponCombatProfile,
        currentMapClock: number,
        travelDelayTicks: number,
    ): number {
        const spellId = primaryAttack.traits.spellId;
        if (primaryAttack.traits.type !== AttackType.Magic || spellId === undefined) return 0;

        const spell = getSpellData(spellId);
        if (spell?.spellbook !== "ancient" || (spell.maxTargets ?? 1) <= 1) return 0;
        if (!this.isAncientAreaCombatAllowed(attacker, primaryTarget)) {
            return 0;
        }

        let queuedHits = 0;
        for (const secondaryTarget of this.findAncientAreaTargets(
            attacker,
            primaryTarget,
            currentMapClock,
            9,
        )) {
            const secondaryAttack: CombatAttack = Object.freeze({
                ...primaryAttack,
                target: this.entityReference(secondaryTarget),
                traits: Object.freeze({ ...primaryAttack.traits }),
            });
            const context: WeaponCombatContext = Object.freeze({
                attack: secondaryAttack,
                attacker,
                target: secondaryTarget,
                currentMapClock,
                distanceTiles: this.distanceBetween(attacker, secondaryTarget),
            });
            const rawEvaluation = this.evaluator.evaluate(secondaryAttack);
            if (!rawEvaluation.valid) continue;

            const evaluation = this.normalizeEvaluation(
                this.invokeTransform(profile, rawEvaluation, context),
            );
            if (!evaluation.valid) continue;

            const visuals = this.resolveVisuals(profile, context);
            if (visuals.projectile) {
                this.queueProjectile(
                    context,
                    visuals.projectile,
                    visuals.spellData,
                    travelDelayTicks,
                );
            }

            this.deferredHits.enqueue({
                attack: secondaryAttack,
                source: secondaryAttack.attacker,
                target: secondaryAttack.target,
                damage: evaluation.damage,
                maxHit: evaluation.maxHit,
                landed: evaluation.landed,
                hitsplatType: evaluation.landed
                    ? DeferredHitsplatType.Normal
                    : DeferredHitsplatType.Block,
                attackType: secondaryAttack.traits.type,
                revealClock: currentMapClock + travelDelayTicks,
                profileId: profile.id,
            });
            this.invokePlugin(profile.id, "onHitEvaluated", () =>
                profile.onHitEvaluated?.(evaluation, context),
            );
            queuedHits++;
        }
        return queuedHits;
    }

    private findAncientAreaTargets(
        attacker: CombatEntity,
        primaryTarget: CombatEntity,
        currentMapClock: number,
        limit: number,
    ): CombatEntity[] {
        const candidates: CombatEntity[] = [];
        if (primaryTarget instanceof PlayerState) {
            candidates.push(...(this.services.players?.getAllPlayersForSync() ?? []));
        } else {
            this.services.npcManager?.forEach((npc) => candidates.push(npc));
        }

        return candidates
            .filter((candidate) =>
                this.isValidAncientAreaTarget(attacker, primaryTarget, candidate, currentMapClock),
            )
            .sort((first, second) => first.id - second.id)
            .slice(0, Math.max(0, Math.trunc(limit)));
    }

    private isAncientAreaCombatAllowed(
        attacker: CombatEntity,
        primaryTarget: CombatEntity,
    ): boolean {
        return (
            multiCombatSystem.isMultiCombat(attacker.tileX, attacker.tileY, attacker.level) &&
            multiCombatSystem.isMultiCombat(
                primaryTarget.tileX,
                primaryTarget.tileY,
                primaryTarget.level,
            )
        );
    }

    private isValidAncientAreaTarget(
        attacker: CombatEntity,
        primaryTarget: CombatEntity,
        candidate: CombatEntity,
        currentMapClock: number,
    ): boolean {
        if (candidate === attacker || candidate === primaryTarget) return false;
        if (!this.isAlive(candidate, currentMapClock)) return false;
        if (candidate.level !== primaryTarget.level) return false;
        if (candidate.worldViewId !== primaryTarget.worldViewId) return false;
        if (Math.abs(candidate.tileX - primaryTarget.tileX) > 1) return false;
        if (Math.abs(candidate.tileY - primaryTarget.tileY) > 1) return false;
        if (!multiCombatSystem.isMultiCombat(candidate.tileX, candidate.tileY, candidate.level)) {
            return false;
        }

        if (candidate instanceof NpcState) {
            if (candidate.isPlayerFollower()) return false;
            if (candidate.getCombatLevel() <= 0) return false;
            if (this.services.npcManager?.hasNpcOption(candidate, "Attack") !== true) {
                return false;
            }
        } else if (!candidate.canBeAttacked()) {
            return false;
        }

        return multiCombatSystem.canAttack(attacker, candidate, currentMapClock).allowed;
    }

    private entityReference(entity: CombatEntity): CombatEntityRef {
        return entity instanceof PlayerState
            ? playerCombatEntityRef(entity.id)
            : npcCombatEntityRef(entity.id);
    }

    private resolveWeaponProfile(
        attack: CombatAttack,
        attacker: CombatEntity,
    ): WeaponCombatProfile {
        return this.plugins.resolve({
            weaponId: attack.traits.weaponId,
            categoryId:
                attacker instanceof PlayerState ? attacker.combat.weaponCategory : undefined,
        });
    }

    private resolveSpecialAttack(
        profile: WeaponCombatProfile,
        context: WeaponCombatContext,
    ): WeaponSpecialAttack | undefined {
        if (context.attack.traits.specialAttack !== true) return undefined;
        if (!(context.attacker instanceof PlayerState)) return undefined;

        const player = context.attacker;
        if (!player.combatAttributes.get(CombatAttributes.SPECIAL_ATTACK_ACTIVE)) {
            return undefined;
        }

        const weaponId = context.attack.traits.weaponId;
        const script = weaponId === undefined ? undefined : SpecialAttackContainer.get(weaponId);
        clearWeaponSpecialAttackTraitOverrides(context.attack);
        setWeaponSpecialAttackAttacker(context.attack, player);

        let profileSpecial: WeaponSpecialAttack | null = null;
        if (profile.handleSpecialAttack) {
            try {
                profileSpecial = profile.handleSpecialAttack(
                    context.attacker,
                    context.target,
                    context.attack,
                );
            } catch (error) {
                logger.warn(`[combat-plugin:${profile.id}] handleSpecialAttack failed`, error);
            }
        }

        if (!script && !profileSpecial) {
            player.specEnergy.setActivated(false);
            this.syncSpecialAttackUi(player);
            return undefined;
        }

        if (script) {
            try {
                script.modifyAttackTraits(context.attack);
            } catch (error) {
                logger.warn(`[special-attack:${script.itemId}] modifyAttackTraits failed`, error);
                clearWeaponSpecialAttackTraitOverrides(context.attack);
                player.specEnergy.setActivated(false);
                this.syncSpecialAttackUi(player);
                return undefined;
            }
        }

        const overrides = getWeaponSpecialAttackTraitOverrides(context.attack);
        const energyCost = Math.max(
            0,
            Math.min(100, Math.trunc(script?.energyCost ?? profileSpecial?.energyCostPercent ?? 0)),
        );
        if (script?.onSpecialActivated) {
            if (player.specEnergy.getPercent() < energyCost) {
                clearWeaponSpecialAttackTraitOverrides(context.attack);
                player.specEnergy.setActivated(false);
                this.services.messagingService.queueChatMessage({
                    messageType: "game",
                    text: "You do not have enough special attack energy.",
                    targetPlayerIds: [player.id],
                });
                this.syncSpecialAttackUi(player);
                return undefined;
            }

            try {
                if (script.onSpecialActivated(player, context.target, context.currentMapClock) === false) {
                    clearWeaponSpecialAttackTraitOverrides(context.attack);
                    player.specEnergy.setActivated(false);
                    this.syncSpecialAttackUi(player);
                    return undefined;
                }
            } catch (error) {
                logger.warn(`[special-attack:${script.itemId}] onSpecialActivated failed`, error);
                clearWeaponSpecialAttackTraitOverrides(context.attack);
                player.specEnergy.setActivated(false);
                this.syncSpecialAttackUi(player);
                return undefined;
            }
        }
        if (!player.specEnergy.consume(energyCost)) {
            clearWeaponSpecialAttackTraitOverrides(context.attack);
            this.services.messagingService.queueChatMessage({
                messageType: "game",
                text: "You do not have enough special attack energy.",
                targetPlayerIds: [player.id],
            });
            this.syncSpecialAttackUi(player);
            return undefined;
        }

        if (script) markWeaponSpecialAttackExecuted(context.attack);
        this.syncSpecialAttackUi(player);
        return Object.freeze({
            ...profileSpecial,
            energyCostPercent: energyCost,
            hitCount: overrides?.hitCount ?? profileSpecial?.hitCount ?? 1,
            accuracyMultiplier:
                overrides?.accuracyMultiplier ?? profileSpecial?.accuracyMultiplier ?? 1,
            damageMultiplier: overrides?.damageMultiplier ?? profileSpecial?.damageMultiplier ?? 1,
            guaranteedHit: overrides?.guaranteedHit ?? profileSpecial?.guaranteedHit,
            rollAttackType: overrides?.rollAttackType ?? profileSpecial?.rollAttackType,
            damageType: overrides?.damageType ?? profileSpecial?.damageType,
            maximumHitSource: overrides?.maximumHitSource ?? profileSpecial?.maximumHitSource,
            visibleMagicMaximumHit:
                overrides?.visibleMagicMaximumHit ?? profileSpecial?.visibleMagicMaximumHit,
            minimumDamageMultiplier:
                overrides?.minimumDamageMultiplier ?? profileSpecial?.minimumDamageMultiplier,
            maximumDamageMultiplier:
                overrides?.maximumDamageMultiplier ?? profileSpecial?.maximumDamageMultiplier,
            enchantedBoltEffectChanceMultiplier:
                overrides?.enchantedBoltEffectChanceMultiplier ??
                profileSpecial?.enchantedBoltEffectChanceMultiplier,
            skipAttack: overrides?.skipAttack ?? profileSpecial?.skipAttack,
        });
    }

    private syncSpecialAttackUi(player: PlayerState): void {
        const activeValue = player.specEnergy.isActivated() ? 1 : 0;
        const energyValue = player.specEnergy.getPercent() * 10;
        player.varps.setVarpValue(VARP_SPECIAL_ATTACK, activeValue);
        player.varps.setVarpValue(VARP_SPECIAL_ENERGY, energyValue);
        this.services.variableService.queueVarp(player.id, VARP_SPECIAL_ATTACK, activeValue);
        this.services.variableService.queueVarp(player.id, VARP_SPECIAL_ENERGY, energyValue);
        this.services.queueCombatState(player);
    }

    private resolveTravelDelay(profile: WeaponCombatProfile, context: WeaponCombatContext): number {
        const custom = resolveWeaponProfileValue(profile.travelDelayTicks, context);
        if (custom !== undefined) {
            return this.nonNegativeInteger(custom, "weapon travel delay");
        }

        const distance = Math.max(0, Math.trunc(context.distanceTiles));
        switch (context.attack.traits.type) {
            case AttackType.Magic:
                return Math.max(1, 1 + Math.floor((1 + distance) / 3));
            case AttackType.Ranged:
                return Math.max(1, 1 + Math.floor((3 + distance) / 6));
            case AttackType.Melee:
            default:
                return 0;
        }
    }

    private resolveVisuals(
        profile: WeaponCombatProfile,
        context: WeaponCombatContext,
        specialAttack?: WeaponSpecialAttack,
    ): CombatVisualDefinition {
        const attack = context.attack;
        const spellData =
            attack.traits.type === AttackType.Magic &&
            attack.traits.spellId !== undefined &&
            attack.traits.spellId > 0
                ? getSpellData(attack.traits.spellId)
                : undefined;
        const poweredStaff =
            attack.traits.type === AttackType.Magic &&
            !spellData &&
            attack.traits.weaponId !== undefined
                ? getPoweredStaffSpellData(attack.traits.weaponId)
                : undefined;

        return {
            attackAnimation:
                context.attacker instanceof NpcState
                    ? undefined
                    : (specialAttack?.attackAnimation ??
                      resolveWeaponProfileValue(profile.attackAnimation, context) ??
                      spellData?.castAnimId ??
                      this.resolveDefaultPlayerAttackAnimation(context.attacker)),
            castGraphic:
                specialAttack?.castGraphic ??
                resolveWeaponProfileValue(profile.castGraphic, context) ??
                this.resolveSpellCastGraphic(spellData, poweredStaff),
            impactGraphic:
                resolveWeaponProfileValue(profile.impactGraphic, context) ??
                this.resolveSpellImpactGraphic(spellData, poweredStaff, true),
            splashGraphic:
                resolveWeaponProfileValue(profile.splashGraphic, context) ??
                this.resolveSpellImpactGraphic(spellData, poweredStaff, false),
            projectile:
                resolveWeaponProfileValue(profile.projectile, context) ??
                this.resolveSpellProjectile(spellData, poweredStaff),
            spellData,
        };
    }

    private playAttackVisuals(
        context: WeaponCombatContext,
        profile: WeaponCombatProfile,
        visuals: CombatVisualDefinition,
        travelDelayTicks: number,
        specialAttack?: WeaponSpecialAttack,
    ): void {
        if (context.attacker instanceof NpcState) {
            const definition = this.services.combatDataService.getNpcDefinition(context.attacker);
            const attackAnimation = definition.animations.attack;
            if (attackAnimation > 0) {
                this.services.combatEffectService.broadcastNpcSequence(
                    context.attacker,
                    attackAnimation,
                );
            }
        } else {
            const attackAnimation = visuals.attackAnimation;
            if (attackAnimation !== undefined && attackAnimation > 0) {
                context.attacker.queueOneShotSeq(attackAnimation, 0);
            }
        }

        if (visuals.castGraphic) {
            this.enqueueGraphic(context.attacker, visuals.castGraphic, context.currentMapClock);
        }
        if (visuals.projectile) {
            const projectileCount = Math.max(
                1,
                Math.min(
                    16,
                    this.nonNegativeInteger(
                        specialAttack?.projectileCount ?? 1,
                        "special attack projectile count",
                    ),
                ),
            );
            for (let projectileIndex = 0; projectileIndex < projectileCount; projectileIndex++) {
                const releaseDelay = specialAttack?.projectileReleaseDelaysTicks?.[projectileIndex];
                const projectile =
                    releaseDelay === undefined
                        ? visuals.projectile
                        : {
                              ...visuals.projectile,
                              startDelayTicks: this.nonNegativeNumber(
                                  releaseDelay,
                                  `special attack projectile ${projectileIndex + 1} release delay`,
                              ),
                          };
                this.queueProjectile(context, projectile, visuals.spellData, travelDelayTicks);
            }
        }

        const spellCastSound = visuals.spellData?.castSoundId;
        const attackSound = specialAttack?.attackSoundId ?? spellCastSound;
        if (attackSound !== undefined && attackSound > 0) {
            if (spellCastSound === attackSound && context.attacker instanceof PlayerState) {
                // Direct spell sounds are full-volume for the caster. The sound
                // packet's omitted volume field uses the client's 255 default.
                this.services.soundService.sendSound(context.attacker, attackSound, {
                    delayMs: 0,
                });
            } else {
                this.queueSound(attackSound, context.attacker);
            }
        } else {
            const profileAttackSound = resolveWeaponProfileValue(profile.attackSoundId, context);
            if (profileAttackSound !== undefined && profileAttackSound > 0) {
                this.queueSound(profileAttackSound, context.attacker);
                return;
            }

            if (!(context.attacker instanceof NpcState)) return;
            const npcAttackSound = this.services.combatDataService.getNpcAttackSoundId(
                context.attacker,
            );
            if (npcAttackSound !== undefined && npcAttackSound > 0) {
                this.queueSound(npcAttackSound, context.attacker);
            }
        }
    }

    private queueProjectile(
        context: WeaponCombatContext,
        projectile: WeaponProjectileProfile,
        spellData: SpellDataEntry | undefined,
        travelDelayTicks: number,
    ): void {
        if (!(projectile.id > 0)) return;
        const system = this.services.projectileSystem;
        const timingService = this.services.projectileTimingService;
        if (!system || !timingService) return;

        const defaults = this.safeProjectileDefaults(projectile.id);
        const syntheticSpell: SpellDataEntry = {
            ...(spellData ?? {
                id: context.attack.traits.spellId ?? -projectile.id,
                baseMaxHit: 0,
            }),
            projectileId: projectile.id,
            projectileStartHeight: projectile.startHeight ?? defaults?.startHeight,
            projectileEndHeight: projectile.endHeight ?? defaults?.endHeight,
            projectileSlope: projectile.slope ?? defaults?.slope,
            projectileSteepness: projectile.steepness ?? defaults?.steepness,
            projectileStartDelay: projectile.startDelayTicks ?? defaults?.startDelay,
        };
        const startDelay = Math.max(0, projectile.startDelayTicks ?? defaults?.startDelay ?? 0);
        // travelDelayTicks is the impact deadline. A delayed projectile uses
        // the remaining portion of that window so it still arrives with the hit.
        // ProjectileSystem guarantees at least one client cycle of flight.
        const travelTime = Math.max(0, travelDelayTicks - startDelay);
        let launch;

        if (context.attacker instanceof PlayerState && context.target instanceof NpcState) {
            if (context.attack.traits.type === AttackType.Ranged && !spellData) {
                launch = timingService.buildPlayerRangedProjectileLaunch({
                    player: context.attacker,
                    npc: context.target,
                    projectile: {
                        projectileId: projectile.id,
                        startHeight: projectile.startHeight ?? defaults?.startHeight,
                        endHeight: projectile.endHeight ?? defaults?.endHeight,
                        slope: projectile.slope ?? defaults?.slope,
                        steepness: projectile.steepness ?? defaults?.steepness,
                        startDelay,
                        lifeModel: projectile.lifeModel ?? defaults?.lifeModel,
                        sourceHeightOffset: defaults?.sourceHeightOffset,
                    },
                    timing: { startDelay, travelTime },
                });
            } else {
                launch = system.buildSpellProjectileLaunch({
                    player: context.attacker,
                    targetNpc: context.target,
                    spellData: syntheticSpell,
                    projectileDefaults: defaults,
                    timing: { startDelay, travelTime },
                });
            }
        } else if (
            context.attacker instanceof PlayerState &&
            context.target instanceof PlayerState
        ) {
            launch = system.buildSpellProjectileLaunch({
                player: context.attacker,
                targetPlayer: context.target,
                spellData: syntheticSpell,
                projectileDefaults: defaults,
                timing: { startDelay, travelTime },
            });
        } else if (context.attacker instanceof NpcState && context.target instanceof PlayerState) {
            launch = system.buildNpcSpellProjectileLaunch({
                npc: context.attacker,
                targetPlayer: context.target,
                spellData: syntheticSpell,
                projectileDefaults: defaults,
                timing: { startDelay, travelTime },
            });
        }

        if (launch) timingService.queueProjectileForViewers(launch);
    }

    private onHitApplied(hit: AppliedCombatHit, frame: TickFrame): void {
        this.playImpactVisuals(hit);
        this.applyEnchantedBoltEffect(hit);
        this.applyAncientGodswordBloodSacrificeHeal(hit);
        this.applyWeaponSpecialAttackScript(hit);
        this.applyToxicBlowpipeVenom(hit);
        this.applyAncientMagicEffects(hit);
        this.playBlockAnimation(hit);
        this.recordLootDamage(hit);
        this.updateCombatState(hit);
        this.awardCombatExperience(hit, frame);
        this.handleDeath(hit);

        const profile = this.plugins.getById(hit.pending.profileId);
        if (!profile?.onHitApplied || !hit.source) return;
        const context: WeaponCombatContext = Object.freeze({
            attack: hit.pending.attack,
            attacker: hit.source,
            target: hit.target,
            currentMapClock: hit.appliedClock,
            distanceTiles: this.distanceBetween(hit.source, hit.target),
        });
        this.invokePlugin(profile.id, "onHitApplied", () => profile.onHitApplied?.(hit, context));
    }

    private transformIncomingDamage(
        pending: PendingCombatHit,
        target: CombatEntity,
        source: CombatEntity | undefined,
    ): number {
        let damage = pending.damage;
        if (
            pending.attackType === AttackType.Melee &&
            target instanceof PlayerState &&
            pending.revealClock < target.combatAttributes.get(CombatAttributes.POWER_OF_DEATH_UNTIL_CLOCK)
        ) {
            const weaponId = target.appearance.equip[EquipmentSlot.WEAPON] ?? -1;
            if (POWER_OF_DEATH_STAFF_ITEM_IDS.has(weaponId)) damage = Math.max(0, Math.floor(damage * 0.5));
        }

        const effect = pending.enchantedBoltEffect;
        if (!effect || !pending.landed || !source) return damage;
        if (effect.effectType === "hp_drain") {
            const currentHitpoints = target instanceof PlayerState
                ? target.skillSystem.getHitpointsCurrent()
                : target.getHitpoints();
            return Math.min(100, Math.max(0, Math.floor(currentHitpoints * Math.max(0, effect.damageMultiplier ?? 0))));
        }
        if (effect.effectType === "lightning" && source instanceof PlayerState) {
            const ranged = source.skillSystem.getSkill(SkillId.Ranged);
            const visibleRangedLevel = Math.max(0, ranged.baseLevel + ranged.boost);
            damage += Math.floor(visibleRangedLevel * 0.1);
        }
        return Math.max(0, Math.floor(damage + (effect.flatDamageBonus ?? 0)));
    }

    /** Rolls once at fire time, so delayed impacts retain the fired ammunition's effect. */
    private rollEnchantedBoltEffect(attacker: CombatEntity, attack: CombatAttack, specialAttack: WeaponSpecialAttack | undefined): EnchantedBoltEffect | undefined {
        if (!(attacker instanceof PlayerState) || attack.traits.type !== AttackType.Ranged) return undefined;
        const ammoId = attacker.appearance.equip[EquipmentSlot.AMMO] ?? -1;
        const effect = getEnchantedBoltEffect(ammoId);
        if (!effect) return undefined;
        const specialMultiplier = Math.max(0, specialAttack?.enchantedBoltEffectChanceMultiplier ?? 1);
        return Math.random() < Math.min(1, effect.activationChance * specialMultiplier) ? effect : undefined;
    }

    /** Applies pre-hit bolt rules, including diamond bolts' defence bypass. */
    private applyEnchantedBoltRollModifiers(specialAttack: WeaponSpecialAttack | undefined, effect: EnchantedBoltEffect | undefined): WeaponSpecialAttack | undefined {
        if (!effect) return specialAttack;
        const base: WeaponSpecialAttack = specialAttack ?? { energyCostPercent: 0, hitCount: 1, accuracyMultiplier: 1, damageMultiplier: 1 };
        return Object.freeze({
            ...base,
            guaranteedHit: effect.effectType === "defense_drain" ? true : base.guaranteedHit,
            damageMultiplier: Math.max(0, base.damageMultiplier * (effect.effectType === "hp_drain" ? 1 : (effect.damageMultiplier ?? 1))),
        });
    }

    private applyEnchantedBoltEffect(hit: AppliedCombatHit): void {
        const effect = hit.pending.enchantedBoltEffect;
        const attacker = hit.source;
        if (!effect || !attacker || !hit.pending.landed) return;
        if (effect.graphicId !== undefined) this.enqueueGraphic(hit.target, { id: effect.graphicId }, hit.appliedClock);
        if (effect.effectType === "poison" && hit.amount > 0) {
            if (hit.target instanceof PlayerState) hit.target.skillSystem.inflictPoison(5, hit.appliedClock);
            else hit.target.inflictPoison(5, hit.appliedClock);
        }
        if (effect.effectType === "magic_drain" && hit.target instanceof PlayerState && hit.amount > 0) {
            const magic = hit.target.skillSystem.getSkill(SkillId.Magic);
            hit.target.skillSystem.setSkillBoost(SkillId.Magic, Math.max(0, magic.baseLevel + magic.boost - hit.amount));
        }
        if (effect.effectType === "life_leech" && attacker instanceof PlayerState && hit.amount > 0) {
            attacker.skillSystem.applyHitpointsHeal(Math.floor(hit.amount * Math.max(0, effect.leechPercent ?? 0)));
        }
        if (effect.effectType === "hp_drain" && attacker instanceof PlayerState && hit.amount > 0) {
            const selfDamage = Math.floor(
                attacker.skillSystem.getHitpointsCurrent() * Math.max(0, effect.selfDamagePercent ?? 0),
            );
            if (selfDamage > 0) attacker.skillSystem.applyHitpointsDamage(selfDamage);
        }
    }

    private applyWeaponSpecialAttackScript(hit: AppliedCombatHit): void {
        if (!hit.source) return;
        if (!wasWeaponSpecialAttackExecuted(hit.pending.attack)) return;

        const weaponId = hit.pending.attack.traits.weaponId;
        if (weaponId === undefined) return;
        const script = SpecialAttackContainer.get(weaponId);
        if (!script) return;

        try {
            script.onHitApplied(
                hit.source,
                hit.target,
                hit.pending.damage,
                hit.appliedClock,
            );
        } catch (error) {
            logger.warn(`[special-attack:${script.itemId}] onHitApplied failed`, error);
        }
    }

    private consumeToxicBlowpipeShot(player: PlayerState, currentMapClock: number): boolean {
        const state = player.equipment.getBlowpipeChargeState();
        if (state.scales <= 0 || state.dartCount <= 0 || state.dartId <= 0) {
            player.combatAttributes.set(CombatAttributes.COMBAT_TARGET, null);
            this.services.messagingService.queueChatMessage({
                messageType: "game",
                text:
                    state.scales <= 0
                        ? "Your toxic blowpipe has no Zulrah's scales left."
                        : "Your toxic blowpipe has no darts left.",
                targetPlayerIds: [player.id],
            });
            return false;
        }

        const capeId = player.appearance.equip[EquipmentSlot.CAPE] ?? -1;
        const dartRoll = Math.random();
        const dartRetrieved = AVAS_ASSEMBLER_ITEM_IDS.has(capeId)
            ? dartRoll < 0.8
            : AVAS_ACCUMULATOR_ITEM_IDS.has(capeId)
              ? dartRoll < 0.72
              : capeId === AVAS_ATTRACTOR_ITEM_ID
                ? dartRoll < 0.6
                : false;
        const dartDropped = !dartRetrieved
            ? AVAS_ACCUMULATOR_ITEM_IDS.has(capeId)
                ? dartRoll < 0.92
                : capeId === AVAS_ATTRACTOR_ITEM_ID
                  ? dartRoll < 0.9
                  : !AVAS_ASSEMBLER_ITEM_IDS.has(capeId) && dartRoll < 0.8
            : false;
        const dartConsumed = !dartRetrieved;
        const scaleConsumed = Math.random() >= 1 / 3;

        player.equipment.setBlowpipeChargeState({
            scales: state.scales - (scaleConsumed ? 1 : 0),
            dartId: state.dartId,
            dartCount: state.dartCount - (dartConsumed ? 1 : 0),
        });
        if (dartDropped) {
            this.services.groundItems.spawn(
                state.dartId,
                1,
                { x: player.tileX, y: player.tileY, level: player.level },
                currentMapClock,
                { ownerId: player.id, privateTicks: 100 },
                player.worldViewId,
            );
        }
        return true;
    }

    private applyToxicBlowpipeVenom(hit: AppliedCombatHit): void {
        if (!hit.pending.landed) return;
        if (!(hit.source instanceof PlayerState)) return;
        if (hit.pending.attack.traits.weaponId !== TOXIC_BLOWPIPE_ITEM_ID) return;

        const attackerHead = hit.source.appearance.equip[EquipmentSlot.HEAD] ?? -1;
        const chance =
            hit.target instanceof NpcState && SERPENTINE_HELM_IDS.has(attackerHead) ? 1 : 0.25;
        if (Math.random() >= chance) return;

        if (hit.target instanceof PlayerState) {
            const targetHead = hit.target.appearance.equip[EquipmentSlot.HEAD] ?? -1;
            if (hasVenomImmunityEquipment(targetHead)) return;
            hit.target.skillSystem.inflictVenom(6, hit.appliedClock);
            return;
        }

        if (getNpcPoisonConfig(hit.target.typeId).venomImmune) return;
        hit.target.inflictVenom(6, hit.appliedClock);
    }

    private queueDueAncientGodswordBloodSacrifices(currentMapClock: number): void {
        for (const sacrifice of takeDueAncientGodswordBloodSacrifices(currentMapClock)) {
            const attack = createAncientGodswordBloodSacrificeAttack(
                sacrifice.attacker,
                sacrifice.target,
                currentMapClock,
            );
            const damage = getAncientGodswordBloodSacrificeDamage();
            this.deferredHits.enqueue({
                attack,
                source: attack.attacker,
                target: attack.target,
                damage,
                maxHit: damage,
                landed: true,
                hitsplatType: DeferredHitsplatType.Normal,
                attackType: AttackType.Magic,
                revealClock: currentMapClock,
                profileId: ANCIENT_GODSWORD_BLOOD_SACRIFICE_PROFILE_ID,
            });
        }
    }

    private applyAncientGodswordBloodSacrificeHeal(hit: AppliedCombatHit): void {
        if (hit.pending.profileId !== ANCIENT_GODSWORD_BLOOD_SACRIFICE_PROFILE_ID) return;
        if (!(hit.source instanceof PlayerState)) return;
        applyAncientGodswordBloodSacrificeHeal(hit.source, hit.target, hit.amount, hit.hpMax);
    }

    private applyAncientMagicEffects(hit: AppliedCombatHit): void {
        if (!hit.pending.landed || hit.hpCurrent <= 0) return;
        const spellId = hit.pending.attack.traits.spellId;
        if (spellId === undefined || spellId <= 0) return;

        const spell = getSpellData(spellId);
        if (spell?.spellbook !== "ancient" || !(spell.freezeDuration && spell.freezeDuration > 0)) {
            return;
        }

        const freezeUntil = hit.target.combatAttributes.get(CombatAttributes.FREEZE_UNTIL_CLOCK);
        if (hit.appliedClock < freezeUntil) {
            return;
        }

        const immunityUntil = hit.target.combatAttributes.get(
            CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK,
        );
        if (hit.appliedClock < immunityUntil) {
            return;
        }

        const durationTicks = spell.name === "Ice Barrage" ? 32 : Math.trunc(spell.freezeDuration);
        hit.target.applyFreeze(durationTicks, hit.appliedClock);
    }

    private playBlockAnimation(hit: AppliedCombatHit): void {
        if (hit.hpCurrent <= 0) return;

        if (hit.target instanceof NpcState) {
            const definition = this.services.combatDataService.getNpcDefinition(hit.target);
            const defenceAnimation = definition.animations.defence;
            if (defenceAnimation > 0) {
                this.services.combatEffectService.broadcastNpcSequence(
                    hit.target,
                    defenceAnimation,
                    { yieldToExisting: true },
                );
            }
            return;
        }

        if (hit.target.hasPendingSeq()) return;
        const blockSequence = this.services.playerCombatService?.pickBlockSequence(hit.target);
        if (blockSequence !== undefined && blockSequence > 0) {
            hit.target.queueOneShotSeq(blockSequence, 0, { interruptible: true });
        }
    }

    private recordLootDamage(hit: AppliedCombatHit): void {
        if (!(hit.amount > 0) || !(hit.source instanceof PlayerState)) return;
        if (!(hit.target instanceof NpcState)) return;

        const damageType: DamageType = hit.pending.attackType;
        damageTracker.recordDamage(
            hit.source,
            hit.target,
            hit.amount,
            damageType,
            hit.appliedClock,
        );
        multiCombatSystem.recordEngagement(hit.source, hit.target, hit.appliedClock);
    }

    private playImpactVisuals(hit: AppliedCombatHit): void {
        const profile = this.plugins.getById(hit.pending.profileId);
        const source = hit.source;
        const target = hit.target;
        if (!profile || !source) return;

        const context: WeaponCombatContext = Object.freeze({
            attack: hit.pending.attack,
            attacker: source,
            target,
            currentMapClock: hit.appliedClock,
            distanceTiles: this.distanceBetween(source, target),
        });
        const visuals = this.resolveVisuals(profile, context);
        const graphic = hit.pending.landed ? visuals.impactGraphic : visuals.splashGraphic;
        if (graphic) this.enqueueGraphic(target, graphic, hit.appliedClock);

        // This callback runs from DeferredHitQueue only after revealClock is
        // reached, so positional impact audio stays locked to the hitsplat tick.
        const impactSound = hit.pending.landed
            ? (visuals.spellData?.impactSoundId ??
              resolveWeaponProfileValue(profile.impactSoundId, context))
            : resolveWeaponProfileValue(profile.impactSoundId, context);
        if (impactSound !== undefined && impactSound > 0) {
            this.queueSound(impactSound, target);
        } else if (source instanceof PlayerState) {
            const sound = this.services.playerCombatService?.pickCombatSound(
                source,
                hit.pending.landed,
            );
            if (sound !== undefined && sound > 0) this.queueSound(sound, target);
        }
    }

    private updateCombatState(hit: AppliedCombatHit): void {
        const source = hit.source;
        const target = hit.target;

        if (target instanceof PlayerState) {
            target.refreshActiveCombatTimer();
            target.interruptWeakQueues();
            if (source) target.setLastHitBy(source);
            this.services.combatEffectService.tryActivateRedemption(target);
        }

        this.retaliationEngine?.intercept(target, hit.pending.source, hit.appliedClock);

        if (source instanceof PlayerState) {
            source.setLastHit(target);
        }
    }

    private awardCombatExperience(hit: AppliedCombatHit, frame: TickFrame): void {
        if (!(hit.amount > 0) || !(hit.source instanceof PlayerState)) return;
        this.services.skillService.awardCombatXp(
            hit.source,
            hit.amount,
            {
                attackType: hit.pending.attack.traits.type,
                attackStyleMode: hit.pending.attack.traits.style ?? "accurate",
                spellId: hit.pending.attack.traits.spellId,
            },
            frame.actionEffects,
        );
    }

    private handleDeath(hit: AppliedCombatHit): void {
        if (hit.hpCurrent > 0) return;
        if (hit.target instanceof NpcState) {
            // A fatal hitsplat ends combat immediately. The NPC object and index
            // are reused on respawn, so retaining either target representation
            // would make attackers resume following the newly spawned NPC.
            hit.target.disengageCombat();
            this.services.players?.clearInteractionsWithNpc(hit.target.id);

            if (hit.source instanceof PlayerState) {
                this.services.npcManager?.scheduleDeathProcessing(
                    hit.target.id,
                    hit.source.id,
                    hit.appliedClock + 1,
                );
            }
            return;
        }

        this.services.playerDeathService?.startPlayerDeath(hit.target, {
            killer: hit.source instanceof PlayerState ? hit.source : undefined,
        });
    }

    private resolveDefaultPlayerAttackAnimation(attacker: PlayerState): number | undefined {
        return this.services.playerCombatService?.pickAttackSequence(attacker);
    }

    private resolveSpellCastGraphic(
        spell: SpellDataEntry | undefined,
        powered: PoweredStaffSpellData | undefined,
    ): WeaponGraphicProfile | undefined {
        const id = spell?.castSpotAnim ?? powered?.castSpotAnim;
        if (id === undefined || id < 0) return undefined;
        return {
            id,
            height: resolveMagicCastSpotAnimHeight(spell, powered),
        };
    }

    private resolveSpellImpactGraphic(
        spell: SpellDataEntry | undefined,
        powered: PoweredStaffSpellData | undefined,
        landed: boolean,
    ): WeaponGraphicProfile | undefined {
        const id = landed
            ? (spell?.impactSpotAnim ?? powered?.impactSpotAnim)
            : (spell?.splashSpotAnim ?? powered?.splashSpotAnim);
        if (id === undefined || id < 0) return undefined;
        return {
            id,
            height: landed
                ? (spell?.impactSpotAnimHeight ?? powered?.impactSpotAnimHeight)
                : (spell?.splashSpotAnimHeight ?? powered?.splashSpotAnimHeight),
        };
    }

    private resolveSpellProjectile(
        spell: SpellDataEntry | undefined,
        powered: PoweredStaffSpellData | undefined,
    ): WeaponProjectileProfile | undefined {
        const id = spell?.projectileId ?? powered?.projectileId;
        if (id === undefined || id <= 0) return undefined;
        return {
            id,
            startHeight: spell?.projectileStartHeight,
            endHeight: spell?.projectileEndHeight,
            slope: spell?.projectileSlope,
            steepness: spell?.projectileSteepness,
            startDelayTicks: spell?.projectileStartDelay,
            lifeModel: "magic",
        };
    }

    private enqueueGraphic(
        target: CombatEntity,
        graphic: WeaponGraphicProfile,
        currentMapClock: number,
    ): void {
        if (!(graphic.id >= 0)) return;
        this.services.broadcastService.enqueueSpotAnimation({
            tick: currentMapClock,
            playerId: target instanceof PlayerState ? target.id : undefined,
            npcId: target instanceof NpcState ? target.id : undefined,
            spotId: graphic.id,
            delay: Math.max(0, Math.trunc(graphic.delayTicks ?? 0)),
            height: graphic.height,
        });
    }

    private queueSound(soundId: number, source: CombatEntity): void {
        this.services.broadcastService.queueBroadcastSound({
            soundId,
            x: source.tileX,
            y: source.tileY,
            level: source.level,
        });
    }

    private safeProjectileDefaults(projectileId: number) {
        try {
            return getProjectileParams(projectileId);
        } catch (error) {
            logger.warn(`[combat-hit] projectile defaults unavailable for ${projectileId}`, error);
            return undefined;
        }
    }

    private invokeTransform(
        profile: WeaponCombatProfile,
        evaluation: CombatHitEvaluation,
        context: WeaponCombatContext,
    ): CombatHitEvaluation {
        if (!profile.transformHit) return evaluation;
        try {
            return profile.transformHit(evaluation, context);
        } catch (error) {
            logger.warn(`[combat-plugin:${profile.id}] transformHit failed`, error);
            return evaluation;
        }
    }

    private normalizeEvaluation(evaluation: CombatHitEvaluation): CombatHitEvaluation {
        const maxHit = this.nonNegativeInteger(evaluation.maxHit, "maximum hit");
        const landed = evaluation.landed === true;
        const damage = landed
            ? Math.min(maxHit, this.nonNegativeInteger(evaluation.damage, "damage"))
            : 0;
        return Object.freeze({ ...evaluation, maxHit, landed, damage });
    }

    private invokePlugin(profileId: string, hook: string, callback: () => void): void {
        try {
            callback();
        } catch (error) {
            logger.warn(`[combat-plugin:${profileId}] ${hook} failed`, error);
        }
    }

    private isAlive(entity: CombatEntity, currentMapClock: number): boolean {
        if (entity instanceof PlayerState) {
            return entity.skillSystem.getHitpointsCurrent() > 0;
        }
        return entity.getHitpoints() > 0 && !entity.isDead(currentMapClock);
    }

    private distanceBetween(first: CombatEntity, second: CombatEntity): number {
        const firstSize = Math.max(1, Math.trunc(first.size));
        const secondSize = Math.max(1, Math.trunc(second.size));
        const firstMaxX = first.tileX + firstSize - 1;
        const firstMaxY = first.tileY + firstSize - 1;
        const secondMaxX = second.tileX + secondSize - 1;
        const secondMaxY = second.tileY + secondSize - 1;
        const dx = Math.max(0, Math.max(second.tileX - firstMaxX, first.tileX - secondMaxX));
        const dy = Math.max(0, Math.max(second.tileY - firstMaxY, first.tileY - secondMaxY));
        return Math.max(dx, dy);
    }

    private mapClock(value: number): number {
        if (!Number.isFinite(value)) {
            throw new RangeError(`Combat hit clock must be finite; received ${value}`);
        }
        return Math.trunc(value);
    }

    private nonNegativeInteger(value: number, field: string): number {
        if (!Number.isFinite(value)) {
            throw new RangeError(`Combat ${field} must be finite; received ${value}`);
        }
        return Math.max(0, Math.trunc(value));
    }

    private nonNegativeNumber(value: number, field: string): number {
        if (!Number.isFinite(value)) {
            throw new RangeError(`Combat ${field} must be finite; received ${value}`);
        }
        return Math.max(0, value);
    }
}
