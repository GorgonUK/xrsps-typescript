# Phase 2C-A Batch 1 — Sign-Off

**Date:** 2026-05-29  
**Scope:** 19 imported skilling_action tasks (mvpTaskId 200–218). Live total **219 / 219 / 219**.

---

## Pre-import fixes

| CSV | Task | Fix |
|-----|------|-----|
| 201 | Cook Tuna. | Trigger `targetIds`: **362 → 361** (`cook_tuna` emits cooked tuna 361) |
| — | Firemaking hook | `SkillActionHandler` now calls `emitLeagueSkillingAction` after successful log burn |

---

## Static verification (PASS)

| Command | Result |
|---------|--------|
| `npx tsx server/scripts/leagues/verify-phase2c-skilling-emits.ts` | **8/8** emit paths wired |
| `npx tsx server/scripts/leagues/verify-phase2c-matrices.ts` | **All passed** (incl. tuna 361, stale 362 rejected) |
| `npx tsx server/scripts/leagues/validate-tasks.ts` | **219 ready**, 100% index parse |

---

## Smoke tests (admin simulation)

Use `::ltask reset all` then simulate one action per row. Each command should complete **only** the listed mvpTaskId.

| CSV | mvpTaskId | Task | Admin sim command |
|-----|-----------|------|-------------------|
| 658 | 209 | Burn Logs in Varrock. | `::ltask sim skilling_action firemaking burn 1511` |
| 656 | 200 | Fish Shrimp in Lumbridge. | `::ltask sim skilling_action fishing catch 317` |
| 685 | 214 | Cook Lobsters in Edgeville. | `::ltask sim skilling_action cooking cook 379` |
| 96 | 216 | Chop a Mahogany Tree | `::ltask sim skilling_action woodcutting chop 6332` |
| 201 | 69 | Cook Tuna. | `::ltask sim skilling_action cooking cook 361` |

**Tuna guard:** `::ltask sim skilling_action cooking cook 362` must **not** complete task 69.

Matrix script confirms all five without server boot (`verify-phase2c-matrices.ts`).

### In-game (manual, recommended before Batch 2)

1. Light a normal log in Varrock → CSV 658 completes.
2. Net shrimp at Lumbridge → CSV 656 completes.
3. Cook lobster at Edgeville range → CSV 685 completes.
4. Chop one mahogany → CSV 96 completes.
5. Cook raw tuna → CSV 201 completes (not raw tuna id 359).

---

## Batch 1 import set

**Imported (19):** 656, 801, 684, 941, 1333, 712, 791, 688, 760, 658, 845, 1035, 690, 800, 685, 803, 96, 99, 749

**Excluded (6):** 196 (no sardine cook recipe), 716 (tuna cook 362), 82/83/84/725 (sandstone/granite/gem mining content missing)

---

## Verdict

| Gate | Status |
|------|--------|
| Static emit paths | **PASS** |
| TargetId content check (imported scope) | **PASS** |
| Matrix / admin sim (658, 656, 685, 96, 201) | **PASS** (static matrix) |
| In-game smoke (5 actions) | **Pending manual** |

**Overall:** **Conditional PASS** — safe to plan Batch 2 after optional in-game smoke. Do not import Batch 2 until candidate list is verified (`plan-phase2c-batch2.ts`).
