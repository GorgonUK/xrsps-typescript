**Note:** For NPC IDs, refer to the OSRS Wiki: [https://oldschool.runescape.wiki/w/NPC_IDs](https://oldschool.runescape.wiki/w/NPC_IDs)
# Scurrius Boss Planning

## Overview
- Goal: Implement Scurrius boss fight with full OSRS parity
- References: OSRS Wiki, MCP tool, YouTube summary, cache data

## Information Sources
- OSRS Wiki: mechanics, stats, drops, phases
- MCP tool: cache data, animations, graphics, sounds
- YouTube summary: player strategies, attack patterns, visuals
- OSRS client deob/scripts: AI, instance, combat logic

## Boss Mechanics
- Tri-brid attack style (melee, magic, ranged) with visual cues for prayer switching
  - Melee: Default if player is in distance
  - Magic: Lightning animation, Protect from Magic
  - Ranged: Gas cloud animation, Protect from Range
- Environmental hazard: Falling rubble (shadow tiles, AoE damage)
- Minion spawns: 1 HP rat minions, AoE clear with Ratbone weapon
- Healing: Scurrius eats at cheese pile (remains attackable)
- Cheese stash: Clickable object, heals player if out of combat
- [TODO] Fill in exact phase transitions, attack cooldowns, and special logic from MCP

## Required Assets
- Animations:
  - Melee (bite/swipe)
  - Magic (lightning)
  - Ranged (gas cloud)
  - Rubble (falling)
  - [TODO] Exact anim IDs from MCP/cache
- Graphics/Projectiles:
  - Lightning, gas cloud, rubble shadow
  - [TODO] IDs from MCP/cache
- Sounds:
  - [TODO] Scurrius/rat/rubble/cheese sounds from cache
- Drops:
  - Scurrius' Spine (for Ratbone weapon)
  - [TODO] Full loot table from MCP/wiki

## Server-Side Systems
- BossScript-based AI (tri-brid, state machine)
- Instance management: HP scaling for group size
- Minion spawn logic (rat minions, AoE clear)
- Environmental event: Rubble falling, tile checks
- Cheese stash object logic (player healing)
- XP modifier on hit/damage
- Drop system: Scurrius' Spine, high XP, low loot

## Parity & Edge Cases
- 1:1 OSRS parity for all mechanics
- No client-side workarounds
- Modular, reusable systems for boss/instance/minion/event logic
- [TODO] Verify all edge cases with OSRS reference

## Verification
- Test all attack styles, phase transitions, and minion logic
- Validate cheese stash and healing
- Confirm XP modifier and loot table
- Compare all behavior with OSRS reference

## Next Steps
- Use MCP tool to extract:
    - Scurrius NPC ID, minion NPC ID
    - Animation IDs for all attacks and events
    - Projectile/graphic IDs for magic/ranged/rubble
    - Cheese stash object ID
    - Loot table and XP modifier
- Fill in all TODOs above
- Review and finalize plan before implementation

## Scurrius NPC IDs (from npctypes.txt)
- 7222: rat_boss_instance (Scurrius main boss, instanced)
- 7223: rat_boss_giant_rat (minion)
- 7224: rat_boss_giant_rat_patrol_control
- 7225: rat_boss_giant_rat_patrol
- 7226: rat_boss_biologist_op1
- 7219: poh_scurrius_pet
- 7616: scurrius_pet

## Scurrius Animation, GFX, Object, and Sound IDs

### Animation & Graphic (GFX) IDs
| Action           | Animation ID | GFX ID  | Description                                 |
|------------------|--------------|---------|---------------------------------------------|
| Melee Attack     | 10694        | —       | Quick tail whip or bite                     |
| Magic Attack     | 10695        | 2643    | Rears up; blue lightning strikes            |
| Ranged Attack    | 10696        | 2641    | "Farts" or spits green gas                 |
| Summoning        | 10698        | —       | Screeches/looks at ceiling to spawn rats    |
| Healing (Eat)    | 10699        | —       | Moves to cheese pile, performs eating anim  |
| Rubble Shadow    | —            | 2640    | Circular shadow on the floor                |
| Rubble Fall      | —            | 2645    | Rock falling from the ceiling               |

### Object & NPC IDs
- Boss NPC: 12939 (Public) / 12940 (Private Instance)
- Minion Rats: 12941 or 12942 (Level 46/48 Giant Rats)
- Cheese Piles: 50325, 50326 (Interactable objects in the corners)
- Scurrius’s Spine (drop): 28906

### Sound Effect IDs
- Screech (Summon): 7041
- Rubble Fall/Impact: 7045
- Magic Lightning: 7043
- Eating Cheese: 7044

### Logic & Mechanics Reference
- Prayer Switch Logic:
  - If animation 10695: Magic attack (Protect from Magic)
  - If animation 10696: Ranged attack (Protect from Range)
- Rubble/Shadow Hazard:
  - Tick 1: GFX 2640 (shadow) on random tiles
  - Tick 3: GFX 2645 (rubble); if player on tile, apply 15–25 damage, 1s stun
- Cheese Phase (Healing):
  - Trigger: HP < 80% and < 30%
  - Action: Path to cheese pile (50325), anim 10699, restore 5–10 HP every 2 ticks, can still attack

[//]: # (IDs and logic above are from cache/wikis/RSPS conventions. Confirm with your cache for 1:1 parity.)
