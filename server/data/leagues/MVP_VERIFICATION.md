# MVP League Tasks — End-to-End Verification Plan

63 tasks (`taskId` 0–62, `structId` 90000–90062). Source: `tasks.csv` + `validate-tasks-latest.csv` (status `ready` only).

## Pre-flight (no client)

Run before logging in:

```bash
npx tsx server/scripts/leagues/verify-mvp-static.ts
```

Checks:

- `LEAGUE_TASKS.length === 63`
- `taskId` 0–62 contiguous
- `structId === 90000 + taskId` for each row
- Enum override length === 63 and matches struct list
- Every `taskId` has an entry in `leagueTaskTriggers.data.ts`
- No duplicate `taskId` / `structId`

---

## 1. Task list loads (client + server)

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1.1 | Start server, connect client, open Leagues / task UI (side journal tab 4) | No console errors (client or server) |
| 1.2 | Server log on startup | `[LeagueTaskManager] Index built: 63/63 tasks parsed` (or `parsed=63`) |
| 1.3 | Scroll task list | Exactly **63** entries visible (not 1800+ cache tasks) |
| 1.4 | `::ltask verify` in-game | Chat reports enum=63, tasks=63, triggers=63 |

**Fail signals:** CS2 errors on `ENUM_GETOUTPUTCOUNT` / `STRUCT_PARAM`, blank list, wrong count, cache task names appearing.

---

## 2. Enum override count

| Check | Expected |
|-------|----------|
| `getMvpLeagueTaskEnumCountOverride(5728)` | `63` |
| Enum keys `0..62` | Valid struct ids |
| Key `63` | `-1` (out of range) |

Verified by `verify-mvp-static.ts` and `::ltask verify`.

---

## 3. taskId ↔ structId mapping

| taskId | structId |
|--------|----------|
| 0 | 90000 |
| … | … |
| 62 | 90062 |

Formula: `structId = 90000 + taskId`.

`::ltask list` prints both columns for manual spot-check.

---

## 4. Display metadata (name, description, area, difficulty, points)

MVP rows use `area: 0` / `category: 0` in data (UI may show “General” from CS2 area enum 0). Verify per tier:

| Difficulty | Points | Example taskId |
|------------|--------|----------------|
| Easy | 10 | 0 (First Level Up) |
| Medium | 30 | 6 (First Level 30) |
| Hard | 80 | 12 (First Level 60) |
| Elite | 200 | 17 (First Level 85) |
| Master | 400 | 19 (First Level 95) |

| Step | Action | Pass |
|------|--------|------|
| 4.1 | Open tasks UI, note task 0 | Name matches CSV; tier icon Easy; **10** points |
| 4.2 | Spot-check task 43 (Willow chop), 49 (Crazy Archaeologist) | Name + points match `mvp-manifest.json` |
| 4.3 | Task 40 | “Reach Total Level 2376” (24 skills × 99). Completes at total ≥ 2376 (`::master`) |

Description column: shown when `description` set on row (e.g. skill reqs on chop tasks).

---

## 5. Trigger completes intended task

Use `::ltask sim` or natural gameplay. After each test: `::ltask progress <id>` → complete, toast once.

### 5a. Skill level / total level (41 tasks)

| taskId | Trigger | How to test |
|--------|---------|-------------|
| 0 | `firstLevelUp` | `::levelup` once |
| 1–20 | `level_reach` anySkill | `::master` or skill to threshold |
| 21–39 | `level_reach` allSkills | `::master` (all 99) |
| 40 | `total_level_reach` 2376 | `::master` (24×99) or natural max progress |

Bulk: `::master` then `::ltask sim skill` — should complete all applicable level tasks.

### 5b. Item obtain / craft (9 tasks)

| taskId | Test |
|--------|------|
| 41–46 | `::ltask sim item_obtain <logItemId>` or chop tree in-game |
| 47 | `::ltask sim item_craft 5609` or cook chicken |
| 48 | `::ltask sim item_obtain 6695` or catch lizard |

### 5c. NPC kill (14 tasks)

| taskId | NPC (from manifest) | Test |
|--------|---------------------|------|
| 49–54, 58–62 | See `mvp-manifest.json` | `::npc <typeId>` then kill, or `::ltask sim npc_kill <typeId>` |

### 5d. Simulation command matrix

```
::ltask sim skill
::ltask sim npc_kill <npcTypeId>
::ltask sim item_obtain <itemId> [count]
::ltask sim item_equip <itemId>
::ltask sim item_craft <itemId> [count]
```

---

## 6. No cross-completion (wrong task)

| Step | Action | Pass |
|------|--------|------|
| 6.1 | `::ltask reset all` (or reset 0–62) | All incomplete |
| 6.2 | `::ltask sim npc_kill 6618` only | **Only** task 49 completes (Crazy Archaeologist) |
| 6.3 | `::ltask sim item_obtain 8173` only | **Only** task 41 (Chop a Tree) |
| 6.4 | `::ltask sim skill` after fresh account | Only level-milestone tasks; not NPC kills |
| 6.5 | Kill goblin (not in MVP list) | No MVP task completes |

Indexed triggers use specific `npcIds` / `itemIds` — wrong ids must not complete unrelated tasks.

---

## 7. No double award

| Step | Action | Pass |
|------|--------|------|
| 7.1 | Note `VARP_LEAGUE_POINTS_CURRENCY` (or UI points) | Value P |
| 7.2 | `::ltask complete 0` twice | Second call: no toast; points stay P |
| 7.3 | Repeat kill/sim for same task | `LeagueTaskService` returns `changed: false` |
| 7.4 | Server log | No duplicate “Completed task” spam |

---

## 8. Progress / count persistence

**MVP note:** All 63 ready triggers use `count: 1` (no multi-step kill/obtain counts). Progress map is used internally but not required for MVP completion.

| Step | Action | Pass |
|------|--------|------|
| 8.1 | N/A for MVP | Document when adding “Kill 10 X” tasks |
| 8.2 | Optional | `::ltask progress` after partial (future) — verify `player-state.json` `leagueTaskProgress` |

Logout test (any completed task):

1. Complete task 0
2. Log out / restart server / log in
3. Task 0 still shows complete; points unchanged

---

## Debug commands (admin)

| Command | Description |
|---------|-------------|
| `::ltask list` | All 63 tasks: id, structId, name, complete?, progress |
| `::ltask verify` | Static consistency checks |
| `::ltask complete <id>` | Force complete (queues varps + toast) |
| `::ltask reset <id>` | Clear completion bit + progress |
| `::ltask reset all` | Reset all 63 |
| `::ltask progress [id]` | Show progress for one or all |
| `::ltask sim skill` | `syncSkillProgressTasks` |
| `::ltask sim npc_kill <npcId>` | Fire `onNpcKill` |
| `::ltask sim item_obtain <itemId> [n]` | Fire `onItemObtain` |
| `::ltask sim item_equip <itemId>` | Fire `onItemEquip` |
| `::ltask sim item_craft <itemId> [n]` | Fire `onItemCraft` |

Requires admin permission (same gate as `::master`).

---

## Sign-off checklist

- [ ] Pre-flight script passes
- [ ] UI shows 63 tasks, no errors
- [ ] Enum count 63
- [ ] structId mapping spot-checked
- [ ] Metadata spot-checked (5+ tasks across tiers)
- [ ] Each trigger category tested (level, obtain, craft, npc_kill)
- [ ] Cross-completion test passed
- [ ] Double-complete test passed
- [ ] Persistence after relog (≥1 task)
- [ ] Task 40 total level threshold reviewed / fixed if wrong

---

## Known MVP caveats

1. **Task 40** — Requires total level **2376** (24 skills × 99), matching this server’s max.
2. **Area column** — stored as `0`; regional CSV area not mapped to cache area ids yet.
3. **Full list replacement** — only 63 tasks in enum; old cache tasks not shown (intentional MVP).
