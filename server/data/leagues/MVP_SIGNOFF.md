# MVP League Tasks — Sign-Off

**Date:** 2026-05-27  
**Scope:** 63 imported MVP tasks (`taskId` 0–62, `structId` 90000–90062)

---

## Task 40 — `Reach Total Level 2376` (updated)

| Source | Value |
|--------|--------|
| `tasks.csv` id 40 | `Reach Total Level 2376`, Master, 400 pts |
| OSRS cache (archived) | Used 2277 (23×99 pre-Sailing); **this server uses 2376** (24×99) |
| MVP trigger | `total_level_reach`, `minTotalLevel: 2376` |

**Verdict:** Updated from OSRS 2277 to **2376** to match 24-skill max on this server. `::master` completes task 40 exactly at cap.

---

## Commands run

| Command | Purpose | Result |
|---------|---------|--------|
| `npm run leagues:verify-mvp` | Static enum/struct/trigger checks | **PASS** |
| `npm run leagues:verify-mvp` (re-run after task 40 review) | Confirm no regression | **PASS** |

### Static verify output (latest)

```
MVP verify: PASS
OK enum 5728 count = 63
OK triggers = 63
```

### Not run in this session (manual / in-game)

| Command / action | Purpose |
|------------------|---------|
| `npm run server:dev` | Server boot + `LeagueTaskManager` 63/63 parsed |
| Client → Leagues task UI | 63 tasks, no CS2 errors |
| `::ltask verify` | In-game static check |
| `::ltask list` | Spot-check ids / completion flags |
| `::ltask reset all` → `::ltask sim skill` | Level milestones after `::master` |
| `::ltask sim npc_kill <id>` | NPC kill tasks (see `mvp-manifest.json`) |
| `::ltask complete 0` ×2 | No double award |
| Logout / login | Completion persists |

Full procedure: [`MVP_VERIFICATION.md`](./MVP_VERIFICATION.md)

---

## PASS / FAIL summary

| Gate | Status |
|------|--------|
| Static preflight (`leagues:verify-mvp`) | **PASS** |
| Task 40 total level threshold | **PASS** (set to 2376 = 24×99) |
| In-game UI load | **Not run** — manual |
| Trigger end-to-end (all 63) | **Not run** — manual |
| Double-complete guard | **Not run** — manual |
| Relog persistence | **Not run** — manual |

**Overall MVP sign-off:** **Conditional PASS** — safe to proceed with hook work after manual in-game checklist.

---

## Manual tests still needed

1. Open league tasks UI — exactly **63** entries, no client errors.
2. Confirm tier/points on samples (Easy 10, Medium 30, Hard 80, Elite 200, Master 400).
3. `::ltask reset all` then `::master` → level tasks 0–39 + 40 complete; no wrong tasks.
4. One **npc_kill** sim (e.g. `::ltask sim npc_kill 6618` → only task 49).
5. One **item_obtain** sim (e.g. log chop id from manifest → single task).
6. `::ltask complete 1` twice — second attempt no toast / no extra points.
7. Complete any task, restart server, relog — still complete.

---

## Known issues

| Issue | Severity | Notes |
|-------|----------|--------|
| Area column not mapped | Low | MVP rows use `area: 0`; CSV region names not in struct params yet |
| Only 63 tasks in enum | Expected | Full 1766-task list deferred; see `skipped-tasks.json` |
| Task 40 | — | Requires 2376 total (24 skills × 99); aligns with `::master` |
| `::ltask reset` | Info | Clears completion bit; does not reverse league points varps |
| Count/progress tasks | N/A | No multi-count triggers in MVP 63 |

---

## Artifacts

| File | Description |
|------|-------------|
| `src/shared/leagues/leagueTasks.data.ts` | 63 live tasks |
| `src/shared/leagues/leagueTaskTriggers.data.ts` | Explicit triggers |
| `src/shared/leagues/leagueTasksEnumOverride.ts` | Enum 5728 override |
| `server/data/leagues/mvp-manifest.json` | Source id ↔ MVP id map |
| `server/data/leagues/skipped-tasks.json` | 1703 deferred tasks |
| `server/data/leagues/hook-roadmap.json` | 1056 `need_hook` grouped by hook type |
| `server/data/leagues/archive/leagueTasks.data.full.ts` | Pre-MVP cache backup |
