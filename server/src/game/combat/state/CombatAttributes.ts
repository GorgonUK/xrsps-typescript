import type { CombatEntityRef } from "../model/CombatEntityRef";
import { OverheadType } from "../../prayer/OverheadType";
import { combatAttribute } from "./CombatAttribute";

/**
 * Canonical combat state keys shared by players and NPCs.
 *
 * All clock values are absolute logical game ticks. In particular,
 * ATTACK_DELAY follows RSMod's `actionDelay` semantics: an entity is delayed
 * while ATTACK_DELAY is greater than the current map clock.
 */
export const CombatAttributes = Object.freeze({
    COMBAT_TARGET: combatAttribute<CombatEntityRef | null>("combat.target", () => null),
    ATTACK_DELAY: combatAttribute<number>("combat.attack_delay", () => -1),
    FOOD_DELAY: combatAttribute<number>("combat.food_delay", () => -1),
    POTION_DELAY: combatAttribute<number>("combat.potion_delay", () => -1),
    AUTO_RETALIATE_ENABLED: combatAttribute<boolean>("combat.auto_retaliate_enabled", () => true),
    SPECIAL_ATTACK_ENERGY: combatAttribute<number>("combat.special_attack_energy", () => 100),
    SPECIAL_ATTACK_ACTIVE: combatAttribute<boolean>("combat.special_attack_active", () => false),
    AUTOCAST_SPELL_ID: combatAttribute<number | null>("combat.autocast_spell_id", () => null),
    ACTIVE_OVERHEAD_PRAYER: combatAttribute<OverheadType>(
        "combat.active_overhead_prayer",
        () => OverheadType.NONE,
    ),
    PRAYER_POINTS_CURRENT: combatAttribute<number>("combat.prayer_points_current", () => 0),
    LAST_ATTACK_CLOCK: combatAttribute<number>("combat.last_attack_clock", () => 0),
    LAST_COMBAT_CLOCK: combatAttribute<number>("combat.last_combat_clock", () => 0),
    LAST_PVP_COMBAT_CLOCK: combatAttribute<number>("combat.last_pvp_combat_clock", () => 0),
    LAST_HIT_SOURCE: combatAttribute<CombatEntityRef | null>("combat.last_hit_source", () => null),
    LAST_HIT_TARGET: combatAttribute<CombatEntityRef | null>("combat.last_hit_target", () => null),
    FREEZE_UNTIL_CLOCK: combatAttribute<number>("combat.freeze_until_clock", () => 0),
    FREEZE_IMMUNITY_UNTIL_CLOCK: combatAttribute<number>(
        "combat.freeze_immunity_until_clock",
        () => 0,
    ),
    IS_DEAD: combatAttribute<boolean>("combat.is_dead", () => false),
});
