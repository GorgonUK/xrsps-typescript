import type { PathService } from "../../../pathfinding/PathService";
import { PlayerState } from "../../player";
import type { CombatAttackTraits } from "../model/CombatAttack";
import type { CombatEntityRef } from "../model/CombatEntityRef";
import { CombatAttributes } from "../state/CombatAttributes";
import {
    CombatInteractionProcessor,
    type CombatAttackTraitsResolver,
} from "./CombatInteractionProcessor";
import { CombatRangeValidator } from "./CombatRangeValidator";
import {
    type CombatEntity,
    type CombatEntityRegistry,
    CombatTargetResolver,
} from "./CombatTargetResolver";

export interface CombatRetaliationEngineOptions extends CombatEntityRegistry {
    readonly pathService: PathService;
    resolveAttackTraits(attacker: CombatEntity, target: CombatEntity): CombatAttackTraits | null;
}

/**
 * Claims an idle defender's combat target after a hit has been applied.
 *
 * Validation and reachability deliberately run through the same interaction
 * processor used by normal combat. This prevents retaliation from targeting a
 * dead/disconnected actor or creating an interaction that cannot be routed.
 * The engine never reads or writes ATTACK_DELAY, so the defender retains its
 * existing absolute weapon deadline.
 */
export class CombatRetaliationEngine {
    private readonly interactionProcessor: CombatInteractionProcessor;
    private readonly resolveAttackTraits: CombatAttackTraitsResolver;

    constructor(private readonly options: CombatRetaliationEngineOptions) {
        this.resolveAttackTraits = options.resolveAttackTraits;
        this.interactionProcessor = new CombatInteractionProcessor(
            new CombatTargetResolver(options),
            new CombatRangeValidator(options.pathService),
            options.pathService,
        );
    }

    intercept(
        defender: CombatEntity,
        attackerReference: CombatEntityRef,
        currentMapClock: number,
    ): boolean {
        if (defender.combatAttributes.get(CombatAttributes.COMBAT_TARGET) !== null) {
            return false;
        }
        if (
            defender instanceof PlayerState &&
            !defender.combatAttributes.get(CombatAttributes.AUTO_RETALIATE_ENABLED)
        ) {
            return false;
        }

        defender.combatAttributes.set(CombatAttributes.COMBAT_TARGET, attackerReference);
        const result = this.interactionProcessor.process(
            defender,
            this.mapClock(currentMapClock),
            this.resolveAttackTraits,
        );
        if (result.status === "ready" || result.status === "moving") {
            return true;
        }

        this.interactionProcessor.endInteraction(defender);
        return false;
    }

    private mapClock(value: number): number {
        if (!Number.isFinite(value)) {
            throw new RangeError(`Retaliation map clock must be finite; received ${value}`);
        }
        return Math.trunc(value);
    }
}
