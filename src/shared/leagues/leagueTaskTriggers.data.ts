import type { TaskTrigger } from "../../../server/src/game/leagues/triggers/TriggerTypes";

/** Live task triggers keyed by taskId (0..n-1). Generated — do not edit. */
export const LEAGUE_TASK_TRIGGER_BY_ID: Record<number, TaskTrigger> = {
  "0": {
    "type": "level_reach",
    "level": 1,
    "firstLevelUp": true
  },
  "1": {
    "type": "level_reach",
    "level": 5,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "2": {
    "type": "level_reach",
    "level": 10,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "3": {
    "type": "level_reach",
    "level": 15,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "4": {
    "type": "level_reach",
    "level": 20,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "5": {
    "type": "level_reach",
    "level": 25,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "6": {
    "type": "level_reach",
    "level": 30,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "7": {
    "type": "level_reach",
    "level": 35,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "8": {
    "type": "level_reach",
    "level": 40,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "9": {
    "type": "level_reach",
    "level": 45,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "10": {
    "type": "level_reach",
    "level": 50,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "11": {
    "type": "level_reach",
    "level": 55,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "12": {
    "type": "level_reach",
    "level": 60,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "13": {
    "type": "level_reach",
    "level": 65,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "14": {
    "type": "level_reach",
    "level": 70,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "15": {
    "type": "level_reach",
    "level": 75,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "16": {
    "type": "level_reach",
    "level": 80,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "17": {
    "type": "level_reach",
    "level": 85,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "18": {
    "type": "level_reach",
    "level": 90,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "19": {
    "type": "level_reach",
    "level": 95,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "20": {
    "type": "level_reach",
    "level": 99,
    "anySkill": true,
    "excludedSkillIds": []
  },
  "21": {
    "type": "level_reach",
    "level": 5,
    "allSkills": true
  },
  "22": {
    "type": "level_reach",
    "level": 10,
    "allSkills": true
  },
  "23": {
    "type": "level_reach",
    "level": 15,
    "allSkills": true
  },
  "24": {
    "type": "level_reach",
    "level": 20,
    "allSkills": true
  },
  "25": {
    "type": "level_reach",
    "level": 25,
    "allSkills": true
  },
  "26": {
    "type": "level_reach",
    "level": 30,
    "allSkills": true
  },
  "27": {
    "type": "level_reach",
    "level": 35,
    "allSkills": true
  },
  "28": {
    "type": "level_reach",
    "level": 40,
    "allSkills": true
  },
  "29": {
    "type": "level_reach",
    "level": 45,
    "allSkills": true
  },
  "30": {
    "type": "level_reach",
    "level": 50,
    "allSkills": true
  },
  "31": {
    "type": "level_reach",
    "level": 55,
    "allSkills": true
  },
  "32": {
    "type": "level_reach",
    "level": 60,
    "allSkills": true
  },
  "33": {
    "type": "level_reach",
    "level": 65,
    "allSkills": true
  },
  "34": {
    "type": "level_reach",
    "level": 70,
    "allSkills": true
  },
  "35": {
    "type": "level_reach",
    "level": 75,
    "allSkills": true
  },
  "36": {
    "type": "level_reach",
    "level": 80,
    "allSkills": true
  },
  "37": {
    "type": "level_reach",
    "level": 85,
    "allSkills": true
  },
  "38": {
    "type": "level_reach",
    "level": 90,
    "allSkills": true
  },
  "39": {
    "type": "level_reach",
    "level": 95,
    "allSkills": true
  },
  "40": {
    "type": "total_level_reach",
    "minTotalLevel": 2376
  },
  "41": {
    "type": "item_obtain",
    "itemIds": [
      8173
    ]
  },
  "42": {
    "type": "item_obtain",
    "itemIds": [
      8175
    ]
  },
  "43": {
    "type": "item_obtain",
    "itemIds": [
      8176
    ]
  },
  "44": {
    "type": "item_obtain",
    "itemIds": [
      8177
    ]
  },
  "45": {
    "type": "item_obtain",
    "itemIds": [
      8178
    ]
  },
  "46": {
    "type": "item_obtain",
    "itemIds": [
      8179
    ]
  },
  "47": {
    "type": "item_craft",
    "itemIds": [
      5609
    ]
  },
  "48": {
    "type": "item_obtain",
    "itemIds": [
      6695
    ]
  },
  "49": {
    "type": "npc_kill",
    "npcIds": [
      6618
    ]
  },
  "50": {
    "type": "npc_kill",
    "npcIds": [
      6619
    ]
  },
  "51": {
    "type": "npc_kill",
    "npcIds": [
      6615
    ]
  },
  "52": {
    "type": "npc_kill",
    "npcIds": [
      8713
    ]
  },
  "53": {
    "type": "npc_kill",
    "npcIds": [
      8195
    ]
  },
  "54": {
    "type": "npc_kill",
    "npcIds": [
      7806
    ]
  },
  "55": {
    "type": "npc_kill",
    "npcIds": [
      289
    ]
  },
  "56": {
    "type": "npc_kill",
    "npcIds": [
      414
    ]
  },
  "57": {
    "type": "npc_kill",
    "npcIds": [
      2853
    ]
  },
  "58": {
    "type": "npc_kill",
    "npcIds": [
      6604
    ]
  },
  "59": {
    "type": "npc_kill",
    "npcIds": [
      6619
    ]
  },
  "60": {
    "type": "npc_kill",
    "npcIds": [
      6618
    ]
  },
  "61": {
    "type": "npc_kill",
    "npcIds": [
      6615
    ]
  },
  "62": {
    "type": "npc_kill",
    "npcIds": [
      8609
    ]
  },
  "63": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      434
    ]
  },
  "64": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      440
    ]
  },
  "65": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      442
    ]
  },
  "66": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      453
    ]
  },
  "67": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1521
    ]
  },
  "68": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      54
    ]
  },
  "69": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      361
    ]
  },
  "70": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      331
    ]
  },
  "71": {
    "type": "skilling_action",
    "skill": "crafting",
    "action": "spin",
    "targetIds": [
      1777
    ]
  },
  "72": {
    "type": "skilling_action",
    "skill": "smithing",
    "action": "smith",
    "targetIds": [
      1205
    ]
  },
  "73": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      436
    ]
  },
  "74": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      438
    ]
  },
  "75": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      444
    ]
  },
  "76": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      447
    ]
  },
  "77": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      449
    ]
  },
  "78": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      451
    ]
  },
  "79": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      6333
    ]
  },
  "80": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      37
    ]
  },
  "81": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      48
    ]
  },
  "82": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      56
    ]
  },
  "83": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      60
    ]
  },
  "84": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      58
    ]
  },
  "85": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      64
    ]
  },
  "86": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      62
    ]
  },
  "87": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      68
    ]
  },
  "88": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      66
    ]
  },
  "89": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      72
    ]
  },
  "90": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      70
    ]
  },
  "91": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1519
    ]
  },
  "92": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1517
    ]
  },
  "93": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1515
    ]
  },
  "94": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1513
    ]
  },
  "95": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1511
    ],
    "count": 25
  },
  "96": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1511
    ],
    "count": 100
  },
  "97": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      317
    ]
  },
  "98": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      321
    ]
  },
  "99": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      327
    ]
  },
  "100": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      345
    ]
  },
  "101": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      335
    ]
  },
  "102": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      349
    ]
  },
  "103": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      359
    ]
  },
  "104": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      377
    ]
  },
  "105": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      371
    ]
  },
  "106": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      7944
    ]
  },
  "107": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      383
    ]
  },
  "108": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      377
    ],
    "count": 250
  },
  "109": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      371
    ],
    "count": 500
  },
  "110": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      315
    ]
  },
  "111": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      323
    ]
  },
  "112": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      347
    ]
  },
  "113": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      333
    ]
  },
  "114": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      351
    ]
  },
  "115": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      329
    ]
  },
  "116": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      379
    ]
  },
  "117": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      373
    ]
  },
  "118": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      7946
    ]
  },
  "119": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      385
    ]
  },
  "120": {
    "type": "skilling_action",
    "skill": "crafting",
    "action": "spin",
    "targetIds": [
      1777
    ],
    "count": 1000
  },
  "121": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      363
    ]
  },
  "122": {
    "type": "area_enter",
    "areaKeys": [
      "mole_lair"
    ]
  },
  "123": {
    "type": "area_enter",
    "areaKeys": [
      "nightmare_area"
    ]
  },
  "124": {
    "type": "area_enter",
    "areaKeys": [
      "revenant_caves"
    ]
  },
  "125": {
    "type": "area_enter",
    "areaKeys": [
      "catacombs_of_kourend"
    ]
  },
  "126": {
    "type": "area_enter",
    "areaKeys": [
      "wilderness"
    ]
  },
  "127": {
    "type": "area_enter",
    "areaKeys": [
      "rogues_castle"
    ]
  },
  "128": {
    "type": "area_enter",
    "areaKeys": [
      "corporeal_beast_lair"
    ]
  },
  "129": {
    "type": "wilderness_level",
    "minLevel": 10
  },
  "130": {
    "type": "wilderness_level",
    "minLevel": 20
  },
  "131": {
    "type": "wilderness_level",
    "minLevel": 30
  },
  "132": {
    "type": "wilderness_level",
    "minLevel": 50
  },
  "133": {
    "type": "combat_level_reach",
    "minCombatLevel": 10
  },
  "134": {
    "type": "combat_level_reach",
    "minCombatLevel": 20
  },
  "135": {
    "type": "combat_level_reach",
    "minCombatLevel": 30
  },
  "136": {
    "type": "combat_level_reach",
    "minCombatLevel": 40
  },
  "137": {
    "type": "combat_level_reach",
    "minCombatLevel": 50
  },
  "138": {
    "type": "combat_level_reach",
    "minCombatLevel": 60
  },
  "139": {
    "type": "combat_level_reach",
    "minCombatLevel": 70
  },
  "140": {
    "type": "combat_level_reach",
    "minCombatLevel": 80
  },
  "141": {
    "type": "combat_level_reach",
    "minCombatLevel": 90
  },
  "142": {
    "type": "combat_level_reach",
    "minCombatLevel": 100
  },
  "143": {
    "type": "combat_level_reach",
    "minCombatLevel": 110
  },
  "144": {
    "type": "combat_level_reach",
    "minCombatLevel": 120
  },
  "145": {
    "type": "combat_level_reach",
    "minCombatLevel": 126
  },
  "146": {
    "type": "spell_cast",
    "spellId": 3273
  },
  "147": {
    "type": "spell_cast",
    "spellId": 3275
  },
  "148": {
    "type": "spell_cast",
    "spellId": 3277
  },
  "149": {
    "type": "spell_cast",
    "spellId": 3279
  },
  "150": {
    "type": "spell_cast",
    "spellId": 3281
  },
  "151": {
    "type": "spell_cast",
    "spellId": 3285
  },
  "152": {
    "type": "spell_cast",
    "spellId": 3288
  },
  "153": {
    "type": "spell_cast",
    "spellId": 3291
  },
  "154": {
    "type": "spell_cast",
    "spellId": 3294
  },
  "155": {
    "type": "spell_cast",
    "spellId": 3297
  },
  "156": {
    "type": "spell_cast",
    "spellId": 3302
  },
  "157": {
    "type": "spell_cast",
    "spellId": 3307
  },
  "158": {
    "type": "spell_cast",
    "spellId": 3313
  },
  "159": {
    "type": "spell_cast",
    "spellId": 3315
  },
  "160": {
    "type": "spell_cast",
    "spellId": 3319
  },
  "161": {
    "type": "spell_cast",
    "spellId": 3321
  },
  "162": {
    "type": "spell_cast",
    "spellIdsAny": [
      21876,
      21877,
      21878,
      21879
    ]
  },
  "163": {
    "type": "spell_cast",
    "spellIdsAny": [
      4647,
      4648,
      4650,
      4651
    ]
  },
  "164": {
    "type": "spell_cast",
    "spellId": 3282
  },
  "165": {
    "type": "spell_cast",
    "spellId": 3283
  },
  "166": {
    "type": "spell_cast",
    "spellId": 3300
  },
  "167": {
    "type": "spell_cast",
    "spellId": 3322
  },
  "168": {
    "type": "spell_cast",
    "spellIdsAny": [
      9076,
      9077,
      9078,
      9079
    ]
  },
  "169": {
    "type": "spell_cast",
    "spellId": 9076
  },
  "170": {
    "type": "spell_cast",
    "spellCategory": "teleport"
  },
  "171": {
    "type": "spell_cast",
    "spellCategory": "teleport",
    "count": 10
  },
  "172": {
    "type": "spell_cast",
    "spellCategory": "teleport",
    "count": 100
  },
  "173": {
    "type": "spell_cast",
    "spellCategory": "teleport",
    "count": 1000
  },
  "174": {
    "type": "spell_cast",
    "teleportName": "Varrock Teleport"
  },
  "175": {
    "type": "spell_cast",
    "teleportName": "Lumbridge Teleport"
  },
  "176": {
    "type": "spell_cast",
    "teleportName": "Falador Teleport"
  },
  "177": {
    "type": "spell_cast",
    "teleportName": "Camelot Teleport"
  },
  "178": {
    "type": "spell_cast",
    "teleportName": "Ardougne Teleport"
  },
  "179": {
    "type": "spell_cast",
    "teleportName": "Barrows Teleport"
  },
  "180": {
    "type": "spell_cast",
    "teleportName": "Kourend Castle Teleport"
  },
  "181": {
    "type": "spell_cast",
    "anySpell": true,
    "count": 1000
  },
  "182": {
    "type": "spell_cast",
    "anySpell": true,
    "count": 10000
  },
  "183": {
    "type": "spell_cast",
    "spellId": 9110
  },
  "184": {
    "type": "spell_cast",
    "spellId": 9111
  },
  "185": {
    "type": "spell_cast",
    "spellIdsAny": [
      9110,
      9111
    ],
    "count": 100
  },
  "186": {
    "type": "spell_cast",
    "spellIdsAny": [
      9110,
      9111
    ],
    "count": 1000
  },
  "187": {
    "type": "spell_cast",
    "spellbook": "ancient"
  },
  "188": {
    "type": "spell_cast",
    "spellId": 4639,
    "areaKeys": [
      "wilderness"
    ]
  },
  "189": {
    "type": "spell_cast",
    "spellId": 4651,
    "areaKeys": [
      "wilderness"
    ]
  },
  "190": {
    "type": "collection_log",
    "milestone": "slot",
    "minSlots": 1
  },
  "191": {
    "type": "collection_log",
    "milestone": "slot",
    "minSlots": 10
  },
  "192": {
    "type": "collection_log",
    "milestone": "slot",
    "minSlots": 25
  },
  "193": {
    "type": "collection_log",
    "milestone": "slot",
    "minSlots": 50
  },
  "194": {
    "type": "collection_log",
    "milestone": "slot",
    "minSlots": 100
  },
  "195": {
    "type": "collection_log",
    "milestone": "page",
    "tabIndex": 0
  },
  "196": {
    "type": "collection_log",
    "milestone": "page",
    "tabIndex": 1
  },
  "197": {
    "type": "collection_log",
    "milestone": "page",
    "tabIndex": 2
  },
  "198": {
    "type": "collection_log",
    "milestone": "page",
    "tabIndex": 3
  },
  "199": {
    "type": "collection_log",
    "milestone": "page",
    "categoryStructId": 527
  },
  "200": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      317
    ]
  },
  "201": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      327
    ]
  },
  "202": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      335
    ]
  },
  "203": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      335
    ]
  },
  "204": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      335
    ]
  },
  "205": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      317
    ]
  },
  "206": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      434
    ]
  },
  "207": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      440
    ]
  },
  "208": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      440
    ]
  },
  "209": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1511
    ]
  },
  "210": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1521
    ]
  },
  "211": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1521
    ]
  },
  "212": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1519
    ]
  },
  "213": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1519
    ]
  },
  "214": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      379
    ]
  },
  "215": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      379
    ]
  },
  "216": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      6332
    ]
  },
  "217": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      19669
    ]
  },
  "218": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      331
    ]
  },
  "219": {
    "type": "skilling_action",
    "skill": "fletching",
    "action": "fletch",
    "targetIds": [
      52
    ]
  },
  "220": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      359
    ]
  },
  "221": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      377
    ]
  },
  "222": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      371
    ]
  },
  "223": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      379
    ]
  },
  "224": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      373
    ]
  },
  "225": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      444
    ]
  },
  "226": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      377
    ]
  },
  "227": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      447
    ]
  },
  "228": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      453
    ]
  },
  "229": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      447
    ]
  },
  "230": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      449
    ]
  },
  "231": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      377
    ]
  },
  "232": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      453
    ]
  },
  "233": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      447
    ]
  },
  "234": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      449
    ]
  },
  "235": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      377
    ]
  },
  "236": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      383
    ]
  },
  "237": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      385
    ]
  },
  "238": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      7944
    ]
  },
  "239": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1515
    ]
  },
  "240": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      451
    ]
  },
  "241": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      453
    ]
  },
  "242": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      447
    ]
  },
  "243": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      377
    ]
  },
  "244": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      383
    ]
  },
  "245": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      385
    ]
  },
  "246": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1517
    ]
  },
  "247": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1513
    ]
  },
  "248": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1515
    ]
  },
  "249": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      379
    ]
  },
  "250": {
    "type": "skilling_action",
    "skill": "fishing",
    "action": "catch",
    "targetIds": [
      383
    ]
  },
  "251": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      385
    ]
  },
  "252": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1513
    ]
  },
  "253": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1515
    ]
  },
  "254": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1513
    ]
  },
  "255": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1515
    ]
  },
  "256": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      451
    ]
  },
  "257": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      385
    ]
  },
  "258": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1513
    ]
  },
  "259": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      3014,
      3015,
      3106,
      3107,
      3108,
      3109,
      3110,
      3111,
      3112,
      3113,
      3261,
      3264,
      3265,
      3268,
      3298,
      3299,
      3652,
      6815,
      6818,
      6987,
      6988,
      6989,
      6990,
      6991,
      6992,
      10728,
      11053,
      11054,
      11057,
      11058,
      14920,
      14921
    ]
  },
  "260": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      3114,
      3243,
      3244,
      11918,
      11919,
      11920,
      11921,
      13228,
      13229,
      13230,
      13231,
      13232,
      13233,
      13234,
      13235,
      14751,
      14752,
      14753,
      14754,
      14773
    ]
  },
  "261": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      2540,
      2541
    ]
  },
  "262": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      3292
    ]
  },
  "263": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      5730,
      5731,
      5832,
      11940,
      11941,
      13236,
      13237,
      13238,
      13239,
      13240,
      13241,
      13242,
      13243,
      14755,
      14756,
      14757,
      14758
    ]
  },
  "264": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      397,
      398,
      399,
      400,
      1546,
      1547,
      1548,
      1549,
      1550,
      3010,
      3011,
      3254,
      3269,
      3270,
      3271,
      3272,
      3273,
      3274,
      3283,
      4522,
      4523,
      4524,
      4525,
      4526,
      5418,
      11092,
      11094,
      11096,
      11098,
      11100,
      11102,
      11104,
      11106,
      11911,
      11912,
      11913,
      11914,
      11915,
      11916,
      11917,
      11922,
      11923,
      11924,
      11937,
      11938,
      11939,
      11942,
      11943,
      11944,
      11945,
      11946,
      11947,
      13100,
      13101,
      13102,
      13103,
      13104,
      13105,
      13106,
      13107,
      13108,
      13109,
      13986,
      13987,
      13988,
      13989,
      13990,
      13991,
      13992,
      13993,
      13994,
      13995,
      14663,
      14664,
      14665,
      14666,
      14667,
      14668,
      14669,
      14670,
      14716,
      14717,
      14718,
      14719,
      14720,
      14721,
      14722,
      14723,
      14887,
      14888,
      14889,
      14890
    ]
  },
  "265": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      3937,
      3938,
      3939,
      3940,
      3941,
      3943,
      3944,
      3945,
      3946
    ]
  },
  "266": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      690,
      695
    ]
  },
  "267": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      3297,
      3300,
      8854,
      11902,
      11936
    ]
  },
  "268": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      3293,
      3294,
      8853,
      11901,
      11930,
      11931,
      11932,
      11933
    ]
  },
  "269": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      5130,
      6077,
      6078,
      6079,
      6086,
      6087,
      6094,
      6095,
      6096
    ]
  },
  "270": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      3295,
      11934,
      11935
    ]
  },
  "271": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      7682,
      7683,
      7684,
      7685,
      7686,
      7687
    ]
  },
  "272": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      3014,
      3015,
      3106,
      3107,
      3108,
      3109,
      3110,
      3111,
      3112,
      3113,
      3261,
      3264,
      3265,
      3268,
      3298,
      3299,
      3652,
      6815,
      6818,
      6987,
      6988,
      6989,
      6990,
      6991,
      6992,
      10728,
      11053,
      11054,
      11057,
      11058,
      14920,
      14921
    ]
  },
  "273": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      397,
      398,
      399,
      400,
      1546,
      1547,
      1548,
      1549,
      1550,
      3010,
      3011,
      3254,
      3269,
      3270,
      3271,
      3272,
      3273,
      3274,
      3283,
      4522,
      4523,
      4524,
      4525,
      4526,
      5418,
      11092,
      11094,
      11096,
      11098,
      11100,
      11102,
      11104,
      11106,
      11911,
      11912,
      11913,
      11914,
      11915,
      11916,
      11917,
      11922,
      11923,
      11924,
      11937,
      11938,
      11939,
      11942,
      11943,
      11944,
      11945,
      11946,
      11947,
      13100,
      13101,
      13102,
      13103,
      13104,
      13105,
      13106,
      13107,
      13108,
      13109,
      13986,
      13987,
      13988,
      13989,
      13990,
      13991,
      13992,
      13993,
      13994,
      13995,
      14663,
      14664,
      14665,
      14666,
      14667,
      14668,
      14669,
      14670,
      14716,
      14717,
      14718,
      14719,
      14720,
      14721,
      14722,
      14723,
      14887,
      14888,
      14889,
      14890
    ]
  },
  "274": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      5730,
      5731,
      5832,
      11940,
      11941,
      13236,
      13237,
      13238,
      13239,
      13240,
      13241,
      13242,
      13243,
      14755,
      14756,
      14757,
      14758
    ]
  },
  "275": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      3295,
      11934,
      11935
    ]
  },
  "276": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      3550
    ]
  },
  "277": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      3014,
      3015,
      3106,
      3107,
      3108,
      3109,
      3110,
      3111,
      3112,
      3113,
      3261,
      3264,
      3265,
      3268,
      3298,
      3299,
      3652,
      6815,
      6818,
      6987,
      6988,
      6989,
      6990,
      6991,
      6992,
      10728,
      11053,
      11054,
      11057,
      11058,
      14920,
      14921
    ]
  },
  "278": {
    "type": "skilling_action",
    "skill": "thieving",
    "action": "pickpocket",
    "targetIds": [
      5730,
      5731,
      5832,
      11940,
      11941,
      13236,
      13237,
      13238,
      13239,
      13240,
      13241,
      13242,
      13243,
      14755,
      14756,
      14757,
      14758
    ]
  },
  "279": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1515
    ]
  },
  "280": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      451
    ]
  },
  "281": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      449
    ]
  },
  "282": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1513
    ]
  },
  "283": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      453
    ]
  },
  "284": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1515
    ]
  },
  "285": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1515
    ]
  },
  "286": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      451
    ]
  },
  "287": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      379
    ]
  },
  "288": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      1515
    ]
  },
  "289": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      373
    ]
  },
  "290": {
    "type": "area_enter",
    "areaKeys": [
      "crafting_guild"
    ]
  },
  "291": {
    "type": "area_enter",
    "areaKeys": [
      "warriors_guild"
    ]
  },
  "292": {
    "type": "skilling_action",
    "skill": "mining",
    "action": "mine",
    "targetIds": [
      436
    ]
  },
  "293": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1511
    ]
  },
  "294": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1519
    ]
  },
  "295": {
    "type": "skilling_action",
    "skill": "cooking",
    "action": "cook",
    "targetIds": [
      361
    ]
  },
  "296": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      6333
    ]
  },
  "297": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      6332
    ]
  },
  "298": {
    "type": "skilling_action",
    "skill": "smithing",
    "action": "smith",
    "targetIds": [
      1115
    ]
  },
  "299": {
    "type": "skilling_action",
    "skill": "smithing",
    "action": "smith",
    "targetIds": [
      1143
    ]
  },
  "300": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1521
    ]
  },
  "301": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1519
    ]
  },
  "302": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1517
    ]
  },
  "303": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1515
    ]
  },
  "304": {
    "type": "skilling_action",
    "skill": "smithing",
    "action": "smith",
    "targetIds": [
      1143
    ]
  },
  "305": {
    "type": "skilling_action",
    "skill": "smithing",
    "action": "smith",
    "targetIds": [
      1123
    ]
  },
  "306": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1517
    ]
  },
  "307": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1515
    ]
  },
  "308": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1513
    ]
  },
  "309": {
    "type": "skilling_action",
    "skill": "smithing",
    "action": "smith",
    "targetIds": [
      1143
    ]
  },
  "310": {
    "type": "skilling_action",
    "skill": "smithing",
    "action": "smith",
    "targetIds": [
      1123
    ]
  },
  "311": {
    "type": "skilling_action",
    "skill": "smithing",
    "action": "smith",
    "targetIds": [
      1143
    ]
  },
  "312": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      6333
    ]
  },
  "313": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1513
    ]
  },
  "314": {
    "type": "skilling_action",
    "skill": "smithing",
    "action": "smith",
    "targetIds": [
      1123
    ]
  },
  "315": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1513
    ]
  },
  "316": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      1515
    ]
  },
  "317": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      6333
    ]
  },
  "318": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      6333
    ]
  },
  "319": {
    "type": "skilling_action",
    "skill": "woodcutting",
    "action": "chop",
    "targetIds": [
      6332
    ]
  },
  "320": {
    "type": "skilling_action",
    "skill": "firemaking",
    "action": "burn",
    "targetIds": [
      6332
    ]
  },
  "321": {
    "type": "area_enter",
    "areaKeys": [
      "woodcutting_guild"
    ]
  },
  "322": {
    "type": "area_enter",
    "areaKeys": [
      "taverley_dungeon"
    ]
  }
};
