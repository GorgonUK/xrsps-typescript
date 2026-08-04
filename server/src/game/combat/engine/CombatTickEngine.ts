import type { PathService } from "../../../pathfinding/PathService";
import { PlayerState } from "../../player";
import type { CombatAttack, CombatAttackTraits } from "../model/CombatAttack";
import { CombatAttributes } from "../state/CombatAttributes";
import { CombatPluginRegistry } from "../plugins/CombatPluginRegistry";
import { SpecialAttackContainer } from "../plugins/SpecialAttackContainer";
import { SpecialAttackTiming } from "../plugins/WeaponCombatProfile";
import { CombatAttackManager } from "./CombatAttackManager";
import {
    CombatInteractionProcessor,
    type CombatInteractionStatus,
} from "./CombatInteractionProcessor";
import { CombatRangeValidator } from "./CombatRangeValidator";
import {
    type CombatEntity,
    type CombatEntityRegistry,
    CombatTargetResolver,
} from "./CombatTargetResolver";

export interface CombatTickEngineOptions extends CombatEntityRegistry {
    readonly pathService: PathService;
    getCombatants(): Iterable<CombatEntity>;
    resolveAttackTraits(attacker: CombatEntity, target: CombatEntity): CombatAttackTraits | null;
    onAttackPrepared?(attack: CombatAttack): void;
}

export interface CombatTickResult {
    readonly currentMapClock: number;
    readonly activeInteractions: number;
    readonly preparedAttacks: readonly CombatAttack[];
    readonly statuses: ReadonlyMap<CombatInteractionStatus | "waiting", number>;
}

/** Single entry point for all active player and NPC combat interactions. */
export class CombatTickEngine {
    private readonly interactionProcessor: CombatInteractionProcessor;
    private readonly attackManager = new CombatAttackManager();

    constructor(
        private readonly options: CombatTickEngineOptions,
        private readonly plugins: CombatPluginRegistry = CombatPluginRegistry.shared,
    ) {
        const targetResolver = new CombatTargetResolver(options);
        const rangeValidator = new CombatRangeValidator(options.pathService);
        this.interactionProcessor = new CombatInteractionProcessor(
            targetResolver,
            rangeValidator,
            options.pathService,
        );
    }

    processTick(currentMapClock: number): CombatTickResult {
        const clock = this.mapClock(currentMapClock);
        const preparedAttacks: CombatAttack[] = [];
        const statuses = new Map<CombatInteractionStatus | "waiting", number>();
        let activeInteractions = 0;

        for (const attacker of this.options.getCombatants()) {
            if (!attacker.combatAttributes.get(CombatAttributes.COMBAT_TARGET)) {
                continue;
            }
            activeInteractions++;

            const interaction = this.interactionProcessor.process(
                attacker,
                clock,
                this.options.resolveAttackTraits,
            );
            if (interaction.status !== "ready" || !interaction.target || !interaction.traits) {
                this.incrementStatus(statuses, interaction.status);
                continue;
            }

            const prepared = this.attackManager.prepareAttack(
                attacker,
                interaction.target,
                interaction.traits,
                clock,
                {
                    bypassAttackDelay: this.isInstantSpecialAttack(
                        attacker,
                        interaction.traits,
                    ),
                },
            );
            if (!prepared) {
                this.incrementStatus(statuses, "waiting");
                continue;
            }

            preparedAttacks.push(prepared.attack);
            this.options.onAttackPrepared?.(prepared.attack);
            this.incrementStatus(statuses, "ready");
        }

        return {
            currentMapClock: clock,
            activeInteractions,
            preparedAttacks,
            statuses,
        };
    }

    stopCombat(entity: CombatEntity): void {
        this.interactionProcessor.endInteraction(entity);
    }

    private isInstantSpecialAttack(
        attacker: CombatEntity,
        traits: CombatAttackTraits,
    ): boolean {
        if (!(attacker instanceof PlayerState)) return false;
        if (!attacker.combatAttributes.get(CombatAttributes.SPECIAL_ATTACK_ACTIVE)) return false;
        if (traits.specialAttack !== true) return false;

        const profile = this.plugins.resolve({
            weaponId: traits.weaponId,
            categoryId: attacker.combat.weaponCategory,
        });
        if (profile.specialAttackTiming === SpecialAttackTiming.Instant) return true;

        const weaponId = traits.weaponId;
        return weaponId !== undefined && SpecialAttackContainer.get(weaponId)?.bypassAttackDelay === true;
    }

    private incrementStatus(
        statuses: Map<CombatInteractionStatus | "waiting", number>,
        status: CombatInteractionStatus | "waiting",
    ): void {
        statuses.set(status, (statuses.get(status) ?? 0) + 1);
    }

    private mapClock(value: number): number {
        if (!Number.isFinite(value)) {
            throw new RangeError(`Current map clock must be finite; received ${value}`);
        }
        return Math.trunc(value);
    }
}
