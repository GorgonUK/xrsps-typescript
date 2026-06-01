# Phase 3D Bounds Research Backlog

Slice 1 imported only areas with proven `Boundary.java` rectangles.  
**No imports until one required proof source exists for each candidate.**

| Area | CSV | Task | Status | Required proof |
|------|-----|------|--------|----------------|
| Dwarven Mines | 784 | Enter the Dwarven Mines. | **Blocked** | Boundary constant **OR** cache region export **OR** walk-test matrix |
| Rogues' Den | 833 | Enter the Rogues' Den. | **Blocked** | Boundary constant **OR** cache export (instanced plane 1 lobby) **OR** walk-test matrix |
| Asgarnian Ice Dungeon | 786 | Enter the Asgarnian Ice Dungeon. | **Blocked** | Boundary constant **OR** cache export **OR** walk-test matrix |
| Hardwood Grove | 736 | Enter the Hardwood Grove. | **Blocked** | Boundary constant **OR** cache export (fence bounds) **OR** walk-test matrix |
| Fishing Platform | 765 | Enter the Fishing Platform Area. | **Blocked** | Boundary constant **OR** cache export **OR** walk-test matrix |
| White Wolf Mountain Pass | 807 | Enter the White Wolf Mountain Pass. | **Blocked** | Boundary constant(s) **OR** cache export **OR** walk-test matrix (likely multi-polygon) |

## Proof acceptance criteria

### Boundary constant
- Identical or documented rectangle in reference server code (e.g. RuneRogue / ShadowRealm `Boundary.java`).
- Document: minX, minY, maxX, maxY, plane, source file + line.

### Cache export
- Region/tile export showing walkable bounds for the area.
- Document: region IDs, coordinate span, plane(s).

### Walk-test matrix
- Script or manual log using `leagueTaskDebug` / `verify-phase3d-*-matrices.ts` pattern:
  - Outside → inside completes task
  - Remaining inside does not re-complete
  - Login inside does not auto-complete
  - ≥2 nearby false-positive tiles outside area do not trigger

## Notes per area (planning reference)

- **Dwarven Mines:** Multi-chamber underground; spawn hints ~2998–3043 × 9793–9844 plane 0 only.
- **Rogues' Den:** Lobby plane 1 (~3042–3051 × 4962–4977); maze is instanced (mapid -1).
- **Asgarnian Ice Dungeon:** Wyvern cluster ~3025–3078 × 9541–9590; surface entrance separate.
- **Hardwood Grove:** Murcaily @ 2816,3083; fenced grove — fence coords not codified.
- **Fishing Platform:** Bailey/fishermen ~2763–2774 × 3273–3291; small offshore island.
- **White Wolf Mountain Pass:** ShadowRealm uses 22-rectangle polygon; task may mean surface pass vs White Wolf Tunnel (y≈9871).

## Slice 1 (complete)

| CSV | Task | areaKey | Bounds | Proof |
|-----|------|---------|--------|-------|
| 779 | Enter the Crafting Guild. | `crafting_guild` | 2925,3274 → 2944,3292 plane 0 | `CRAFTING_GUILD_BOUNDARY` |
| 781 | Enter the Warriors' Guild. | `warriors_guild` | 2833,3531 → 2878,3558 plane 0 | `WARRIORS_GUILD` |
