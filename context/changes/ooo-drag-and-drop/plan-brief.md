# OOO Drag & Drop — Plan Brief
Full plan: `context/changes/ooo-drag-and-drop/plan.md`
Change identity: `context/changes/ooo-drag-and-drop/change.md`

## What & why
Drag & drop on the Timeline currently works only for project allocations. This
change extends the same gestures to OOO blocks (urlop / L4 / nieobecność):
drag the body to move the whole absence, drag an edge to resize it. Planners get
one consistent interaction model instead of "drag projects, but open a modal for
absences."

## Starting point
Allocations are draggable via `DraggableAllocBlock` (`Timeline.tsx:123`) — move +
resize handles, live resize preview, click-vs-drag arbitration all solved. OOO
blocks render as a plain click-to-edit `<div>` (`Timeline.tsx:695`) with no
`useDraggable`, no handles, and no branch in `handleDragEnd`. Both kinds already
share lane layout (`assignLanesAll`) and positioning (`getAllocationStyle`), and
OOO persists to the `time_off` table via `TimeOffModal` (`TimeOffModal.tsx:59`).

## Desired end state
OOO blocks move and resize by drag exactly like allocations — snapped to whole
days, clamped to a minimum one-day span, persisted to `time_off`, with a live
grow/shrink preview during resize and click-to-edit preserved. Allocation
behavior, panning, filters, lane stacking, and utilization are untouched.

## Key decisions made
| Decision | Choice | Why |
|---|---|---|
| Gesture scope | Move + resize (full parity) | "Same as projects" implies both gestures |
| Code structure | New `DraggableOooBlock` sibling component | Keeps working allocation code untouched; matches house pattern |
| Drag-id namespace | `ooo-<id>`, `ooo-resize-left/right-<id>` | Lets handlers route OOO drags to `time_off` without touching allocation branches |
| Live resize preview | Yes, extend existing `resizePreview` | Full visual parity; mechanism already exists |
| Phasing | Two phases: move, then resize | Verify move before layering on resize |
| Persistence | Post-drop refetch via `onRefresh` (no optimistic UI) | Matches allocations; simplest correct path |

## Scope
**In:** body-move and edge-resize of OOO blocks; `time_off` persistence; live
resize preview; click-to-edit preserved.
**Out:** cross-row (person) reassignment; changing OOO type by drag; refactoring
`DraggableAllocBlock`; schema/RLS changes; optimistic UI; new test suite; touch
sensor.

## Architecture / Approach
Add `DraggableOooBlock` next to `DraggableAllocBlock` in `Timeline.tsx`, reusing
the existing kind-agnostic `ResizeHandle`. Namespace OOO drag ids with `ooo-` so
`handleDragEnd` / `handleDragMove` detect and handle them first (returning before
the allocation branches), routing writes to `supabase.from('time_off')`. Resize
clamps and day-offset math mirror the allocation path; `resizePreview` is
extended to distinguish an OOO target from an allocation with the same id.

## Phases at a glance
| Phase | Delivers | Key risk |
|---|---|---|
| 1 — OOO move | Body-drag moves both dates, persists, click-to-edit intact | Click/drag arbitration regressing for OOO |
| 2 — OOO resize + preview | Edge handles change one date; live grow/shrink | Shared id cross-driving the wrong block's preview |

**Prerequisites:** none — the `<DndContext>`, sensors, and allocation drag path
are already merged.

## Open risks & assumptions
- Assumes the `time_off` table enforces `end_date >= start_date` like
  `allocations`; the clamps respect it regardless.
- `supabase-schema.sql` is stale (missing `time_off` and `allocations.status`);
  the running DB is authoritative — no schema file edits in scope.
- Preview state must key on the namespaced id/kind so an allocation and an OOO
  row sharing a UUID can't cross-drive each other's preview.

## Success criteria (summary)
`pnpm build` clean (TS + ESLint) each phase. Manually: OOO blocks move and resize
by drag, snap to whole days, clamp to ≥ 1 day, persist across reload, show live
resize preview, still open the modal on a plain click — and allocations, panning,
filters, and utilization are unchanged.
