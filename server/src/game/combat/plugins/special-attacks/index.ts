import type { WeaponCombatProfile } from "../WeaponCombatProfile";
import { DRAGON_DAGGER_SPECIAL_ATTACK_PROFILE } from "./DragonDaggerSpecialAttack";
import { GRANITE_MAUL_SPECIAL_ATTACK_PROFILE } from "./GraniteMaulSpecialAttack";
import { MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILES } from "./MagicShortbowSpecialAttack";
import { TOXIC_BLOWPIPE_PROFILE } from "./ToxicBlowpipeSpec";
import { SARADOMIN_GODSWORD_PROFILE } from "./SaradominGodswordSpec";

export { ANCIENT_GODSWORD_SPEC, AncientGodswordSpec } from "./AncientGodswordSpec";
export { ANCIENT_MACE_SPEC, AncientMaceSpec } from "./AncientMaceSpec";
export { ABYSSAL_WHIP_SPEC, AbyssalWhipSpec } from "./AbyssalWhipSpec";
export { ACCURSED_SCEPTRE_SPEC, AccursedSceptreSpec } from "./AccursedSceptreSpec";
export { ARCLIGHT_SPEC, ArclightSpec } from "./ArclightSpec";
export { BANDOS_GODSWORD_SPEC, BandosGodswordSpec } from "./BandosGodswordSpec";
export {
    BARRELCHEST_ANCHOR_SPEC,
    BarrelchestAnchorSpec,
} from "./BarrelchestAnchorSpec";
export {
    BONE_DAGGER_SPEC,
    BONE_DAGGER_VARIANT_SPECS,
    BoneDaggerSpec,
} from "./BoneDaggerSpec";
export { BRINE_SABRE_SPEC, BrineSabreSpec } from "./BrineSabreSpec";
export { DARKLIGHT_SPEC, DarklightSpec } from "./DarklightSpec";
export {
    DORGESHUUN_CROSSBOW_SPEC,
    DorgeshuunCrossbowSpec,
} from "./DorgeshuunCrossbowSpec";
export { DINHS_BULWARK_SPEC, DinhsBulwarkSpec } from "./DinhsBulwarkSpec";
export {
    ELDRITCH_NIGHTMARE_STAFF_SPEC,
    EldritchNightmareStaffSpec,
} from "./EldritchNightmareStaffSpec";
export {
    ELDER_MAUL_ORNAMENTED_SPEC,
    ELDER_MAUL_SPEC,
    ELDER_MAUL_SPECS,
    ElderMaulSpec,
} from "./ElderMaulSpec";
export { EYE_OF_AYAK_SPEC, EyeOfAyakSpec } from "./EyeOfAyakSpec";
export { EMBERLIGHT_SPEC, EmberlightSpec } from "./EmberlightSpec";
export { EXCALIBUR_SPEC, ExcaliburSpec } from "./ExcaliburSpec";
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
    DRAGON_BATTLEAXE_SPEC,
    DragonBattleaxeSpec,
} from "./DragonBattleaxeSpec";
export { DRAGON_CROSSBOW_SPEC, DragonCrossbowSpec } from "./DragonCrossbowSpec";
export {
    DRAGON_SCIMITAR_SPEC,
    DragonScimitarSpec,
} from "./DragonScimitarSpec";
export {
    CRYSTAL_HALBERD_SPEC,
    DRAGON_HALBERD_SPEC,
    DragonHalberdSpec,
} from "./DragonHalberdSpec";
export { DRAGON_2H_SWORD_SPEC, Dragon2hSwordSpec } from "./Dragon2hSwordSpec";
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
export {
    MORRIGANS_THROWING_AXE_BH_SPEC,
    MorrigansThrowingAxeBhSpec,
} from "./MorrigansThrowingAxeBhSpec";
export { VOIDWAKER_SPEC, VoidwakerSpec } from "./VoidwakerSpec";
export {
    TOXIC_BLOWPIPE_PROFILE,
    TOXIC_BLOWPIPE_SPEC,
    ToxicBlowpipeSpec,
} from "./ToxicBlowpipeSpec";
export {
    TOXIC_STAFF_OF_THE_DEAD_SPEC,
    ToxicStaffOfTheDeadSpec,
} from "./ToxicStaffOfTheDeadSpec";
export {
    TONALZTICS_OF_RALOS_SPEC,
    TonalzticsOfRalosSpec,
} from "./TonalzticsOfRalosSpec";
export { PURGING_STAFF_SPEC, PurgingStaffSpec } from "./PurgingStaffSpec";
export { RUNE_THROWNAXE_SPEC, RuneThrownaxeSpec } from "./RuneThrownaxeSpec";
export {
    VESTAS_SPEAR_DEADMAN_SPEC,
    VestasSpearDeadmanSpec,
} from "./VestasSpearDeadmanSpec";
export {
    SARADOMIN_GODSWORD_PROFILE,
    SARADOMIN_GODSWORD_SPECS,
    SaradominGodswordSpec,
} from "./SaradominGodswordSpec";
export { SEERCULL_SPEC, SeercullSpec } from "./SeercullSpec";
export {
    STATIUS_WARHAMMER_BH_SPEC,
    StatiusWarhammerBhSpec,
} from "./StatiusWarhammerBhSpec";
export { STAFF_OF_THE_DEAD_SPEC, StaffOfTheDeadSpec } from "./StaffOfTheDeadSpec";
export { STAFF_OF_LIGHT_SPEC, StaffOfLightSpec } from "./StaffOfLightSpec";
export { STAFF_OF_BALANCE_SPEC, StaffOfBalanceSpec } from "./StaffOfBalanceSpec";
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
