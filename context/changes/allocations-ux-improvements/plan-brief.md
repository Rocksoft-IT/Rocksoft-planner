# Allocations & Timeline UX Improvements — Plan Brief
Full plan: `context/changes/allocations-ux-improvements/plan.md`
Change identity: `context/changes/allocations-ux-improvements/change.md`

## What & why
Five independent UX fixes to the RS Planner allocations/timeline view, all from
ClickUp (parent `869de3y2n`). Each ships on its own; ordered low-risk-first.

| Phase | ClickUp | Pri | Delivers |
|---|---|---|---|
| P1 | 869e5gwa8 | normal | Left column: separate name from stats so they stop blending |
| P2 | 869e6vum3 | normal | Tighter, more compact per-person project stacking |
| P3 | 869e5gvne | normal | Live searchbar over the project picker when assigning |
| P4 | 869e6rn52 | high | Project name stays visible on blocks that start off-screen-left |
| P5 | 869e6vp54 | normal | One add popup: pick projekt OR urlop (mutually exclusive) |

## Implemented
`Timeline.tsx` (P1/P2/P4) + `AllocationModal.tsx` (P3/P5). `npm run build` green.
Standalone eslint shows only pre-existing project-wide issues; this change adds
zero new lint problems. Manual UX checks need a dev Supabase (delivering session).

## Key decisions
- P1: name gets `mb-1.5`, stats `mt-1.5`, `calcRowHeight` floor 44 → 50.
- P2: `LANE_HEIGHT` 28 → 24, `ROW_PADDING` 4 → 3 (LANE_GAP stays 2).
- P3: search input + filtered list inside the modal (mirrors `ProjectFilter`).
- P4: track `scrollLeft` in `handleScroll`; label `paddingLeft = 8 + max(0, min(scrollLeft - left, width - 96))`.
- P5: `kind` toggle (projekt/urlop) in create mode; branch insert allocations vs time_off.

## Scope out
Timeline/scroll/drag redesign; schema/RLS changes; server-side search; removing
`TimeOffModal`; new deps/tests; audit-stamping changes.
