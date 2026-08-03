import type { WeaponCombatProfile } from "../WeaponCombatProfile";
import { DRAGON_DAGGER_SPECIAL_ATTACK_PROFILE } from "./DragonDaggerSpecialAttack";
import { GRANITE_MAUL_SPECIAL_ATTACK_PROFILE } from "./GraniteMaulSpecialAttack";
import { MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILES } from "./MagicShortbowSpecialAttack";
import { TOXIC_BLOWPIPE_PROFILE } from "./ToxicBlowpipeSpec";
import { SARADOMIN_GODSWORD_PROFILE } from "./SaradominGodswordSpec";

export { ANCIENT_GODSWORD_SPEC, AncientGodswordSpec } from "./AncientGodswordSpec";
export { BANDOS_GODSWORD_SPEC, BandosGodswordSpec } from "./BandosGodswordSpec";
export {
    ELDRITCH_NIGHTMARE_STAFF_SPEC,
    EldritchNightmareStaffSpec,
} from "./EldritchNightmareStaffSpec";
export {
    DRAGON_DAGGER_SPECIAL_ATTACK_SCRIPTS,
    DragonDaggerSpecialAttackScript,
} from "./DragonDaggerSpecialAttack";
export { DRAGON_WARHAMMER_SPEC, DragonWarhammerSpec } from "./DragonWarhammerSpec";
export {
    DRAGON_AXE_SPEC,
    DRAGON_AXE_VARIANT_SPECS,
    DragonAxeSpec,
} from "./DragonAxeSpec";
export {
    DRAGON_HARPOON_SPEC,
    DRAGON_HARPOON_VARIANT_SPECS,
    DragonHarpoonSpec,
} from "./DragonHarpoonSpec";
export {
    DRAGON_PICKAXE_SPEC,
    DRAGON_PICKAXE_VARIANT_SPECS,
    DragonPickaxeSpec,
} from "./DragonPickaxeSpec";
export {
    GRANITE_MAUL_SPECIAL_ATTACK_SCRIPTS,
    GraniteMaulSpecialAttackScript,
} from "./GraniteMaulSpecialAttack";
export {
    MAGIC_SHORTBOW_SPECIAL_ATTACK_SCRIPTS,
    MagicShortbowSpecialAttackScript,
} from "./MagicShortbowSpecialAttack";
export { VOIDWAKER_SPEC, VoidwakerSpec } from "./VoidwakerSpec";
export {
    TOXIC_BLOWPIPE_PROFILE,
    TOXIC_BLOWPIPE_SPEC,
    ToxicBlowpipeSpec,
} from "./ToxicBlowpipeSpec";
export { PURGING_STAFF_SPEC, PurgingStaffSpec } from "./PurgingStaffSpec";
export {
    SARADOMIN_GODSWORD_PROFILE,
    SARADOMIN_GODSWORD_SPECS,
    SaradominGodswordSpec,
} from "./SaradominGodswordSpec";
export {
    KERIS_PARTISAN_OF_THE_SUN_SPEC,
    KerisPartisanOfTheSunSpec,
} from "./KerisPartisanOfTheSunSpec";

export const CORE_SPECIAL_ATTACK_PROFILES: readonly WeaponCombatProfile[] = Object.freeze([
    DRAGON_DAGGER_SPECIAL_ATTACK_PROFILE,
    GRANITE_MAUL_SPECIAL_ATTACK_PROFILE,
    ...MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILES,
    TOXIC_BLOWPIPE_PROFILE,
    SARADOMIN_GODSWORD_PROFILE,
]);

export {
    DRAGON_DAGGER_SPECIAL_ATTACK_PROFILE,
    GRANITE_MAUL_SPECIAL_ATTACK_PROFILE,
    MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILES,
};
