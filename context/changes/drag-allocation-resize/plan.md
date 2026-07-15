# drag-allocation-resize — Implementation Plan

## Overview

This change adds the drag-to-resize gesture for Allocation blocks on the
Timeline: a Planner grabs the left or right edge of a block and drags it to
change the Allocation's duration. The grabbed edge's date changes; the opposite
edge stays fixed. The Allocation can never be inverted or made shorter than one
day. On drop, the changed date snaps to a whole-day boundary, persists to the
database, and the person's utilization recomputes. This slice (S-02) is
parallel with S-01 (`drag-allocation-move`, already implemented) — it shares
the F-01 drag context and sensor but targets a different part of the block.

## Current State Analysis

`drag-allocation-move` (S-01) is already implemented on top of F-01
(`dnd-context-wiring`). The relevant pieces already in `Timeline.tsx`:

- A single `DndContext` wraps the whole Timeline (`src/components/timeline/Timeline.tsx:348–353`)
  with one `PointerSensor` (`activationConstraint: { distance: 5 }`,
  `Timeline.tsx:197–199`) shared by every draggable in the tree.
- `handleDragStart` / `handleDragCancel` (`Timeline.tsx:207–213`, `242–244`) set
  and clear a generic `dragActiveRef`, used to gate the block's `onClick` so a
  completed drag never opens `AllocationModal` (`Timeline.tsx:627`:
  `if (!didDrag.current && !dragActiveRef.current) openEdit(item)`). This guard
  is drag-id-agnostic and needs no changes for resize.
- `DraggableAllocBlock` (`Timeline.tsx:98–154`) renders one allocation block. It
  calls `useDraggable({ id })` once for the whole block body — that call drives
  the move gesture. `id` is `String(item.id)` (the raw allocation id, no
  prefix), passed at the call site (`Timeline.tsx:617`).
- `handleDragEnd` (`Timeline.tsx:215–240`) currently assumes every drag is a
  move: it looks up the allocation by `String(a.id) === String(event.active.id)`,
  computes `dayOffset = Math.round(event.delta.x / DAY_WIDTH)`, shifts both
  `start_date` and `end_date` by that offset, and persists both fields via
  `supabase.from('allocations').update({ start_date, end_date }).eq('id', alloc.id)`,
  then calls `onRefresh()`. A `dragError` state (`Timeline.tsx:185`) drives an
  error banner (`Timeline.tsx:355–365`) on write failure.
- `DAY_WIDTH = 44` px (`Timeline.tsx:35`) is the pixel width of one day column;
  `getAllocationStyle` (`src/lib/utils.ts:23–45`) derives each block's `left`/
  `width` in pixels from `start_date`/`end_date` against the visible day range.
- Date strings are ISO `'yyyy-MM-dd'` throughout (`formatDate`,
  `src/lib/utils.ts:125–127`); the codebase already compares them with plain
  string comparison in lane assignment (`Timeline.tsx:51`,
  `alloc.start_date > end`), since ISO dates sort lexicographically.
- The DB constraint `end_date >= start_date` (per PRD/roadmap) is the
  authoritative invariant; the client must not submit a write that violates it.
- No automated test suite; `pnpm build` (TypeScript + ESLint) is the only
  automated gate, same as S-01.

### Key discoveries

- `Timeline.tsx:111` — the block's own `useDraggable({ id })` uses the raw
  allocation id with no prefix. Resize handles must use a *different* id shape
  so `handleDragEnd` can tell a resize drag apart from a move drag without
  ambiguity.
- `Timeline.tsx:113–125` — the block's outer div is the drag ref
  (`setNodeRef`) and receives `{...attributes} {...listeners}` directly,
  including `onPointerDown`. Any child element that also wants to be an
  independent dnd-kit draggable (the resize handles) sits inside this same DOM
  node; a pointer-down on the child will bubble to the parent's `onPointerDown`
  in the same tick unless stopped, which would let both the block's move-drag
  and the handle's resize-drag try to activate from one gesture.
- `Timeline.tsx:270–271` — the background pan gesture's `handleMouseDown`
  already skips any element under `[data-block]` via `.closest()`, which walks
  the DOM tree regardless of event propagation. A resize handle nested inside
  the block's `data-block` div is therefore already excluded from pan with no
  extra attribute needed.
- `Timeline.tsx:627` — the block's `onClick` guard checks `didDrag.current`
  (pan gesture) and `dragActiveRef.current` (any dnd-kit drag). A plain click
  on the edge zone (pointer down/up with no movement) is expected to still
  bubble up and open the modal, same as clicking anywhere else on the block —
  no special-casing needed there.
- `src/lib/utils.ts:23–45` (`getAllocationStyle`) is read-only geometry derived
  from `start_date`/`end_date`; once the resize write lands and `onRefresh`
  brings back the new dates, the block's `left`/`width` recompute automatically
  — matching how S-01 already relies on refetch rather than optimistic local
  state.

## Desired End State

When this change ships:

- Each Allocation block has a narrow (8 px) grab zone on its left edge and its
  right edge, in addition to the existing full-body move-drag.
- Dragging the right edge changes only `end_date`; `start_date` is untouched.
- Dragging the left edge changes only `start_date`; `end_date` is untouched.
- The edge being dragged cannot cross the fixed opposite edge: the Allocation's
  duration can shrink to a minimum of one day (`start_date === end_date`) but
  never invert or go to zero/negative length.
- On drop, the changed date snaps to a whole-day boundary (via the existing
  `Math.round(delta.x / DAY_WIDTH)` day-offset calculation), persists to
  `allocations`, and `onRefresh()` is called — the block settles at its new
  width/position with correct lane stacking and updated utilization.
- Edge zones show a `ew-resize` cursor on hover so they're discoverable without
  being visually obtrusive.
- Drag-to-move (S-01) keeps working unchanged: grabbing the block body between
  the two edge zones still moves it.
- Click-on-block (anywhere, including the edge zones, with movement under the
  5 px activation distance) still opens `AllocationModal`.
- Background drag-to-pan, lane stacking, filters, utilization bars, and
  time-off rendering are all unaffected.

## What we're NOT doing

- No live ghost/preview of the block resizing while dragging — that is S-03
  (`drag-live-preview`). The edge handle itself may translate slightly as
  visual feedback (consistent with how the move gesture already gives
  feedback via the block's own transform), but the block's width/position only
  updates after drop + refetch.
- No cross-row drag (person reassignment) — out of scope per PRD Non-Goals.
- No optimistic UI update — same choice as S-01, for the same reason
  (consistency with the existing refetch-after-mutation pattern at this
  project's scale).
- No changes to `person_id`, `project_id`, `hours_per_day`, `status`, or
  `notes` — a resize touches only the one date field on the grabbed edge.
- No changes to `TimelineClient.tsx`, `AllocationModal`, `supabase-schema.sql`,
  or any auth/RLS policy.
- No touch or tablet sensor.
- No resize affordance on time-off blocks — only Allocation blocks get edge
  handles.
- No new "can't shrink further" toast/feedback beyond the natural clamp (the
  block simply stops moving at the one-day-minimum position); this is a small
  enough interaction to leave for a later polish pass if it proves confusing.

## Implementation Approach

**Edge handle id scheme.** The block's own move draggable keeps its existing
id (`String(item.id)`, unchanged — no risk to the working S-01 code path). Each
resize handle gets its own `useDraggable` call with a prefixed id:
`resize-left-${item.id}` and `resize-right-${item.id}`. `handleDragEnd` branches
on the id's prefix: `resize-left-` / `resize-right-` → resize logic (strip the
prefix to recover the allocation id); anything else → the existing move logic,
untouched.

**Avoiding double drag-activation.** Because the edge handles are nested
inside the block's own draggable DOM node, a pointer-down on a handle would
otherwise bubble to the block's `onPointerDown` in the same tick and risk both
drags trying to activate from one gesture. Each handle wraps dnd-kit's
`listeners.onPointerDown` so it calls `event.stopPropagation()` before invoking
the original handler — this stops the pointerdown from reaching the block's
own listener, so only the handle's resize-drag activates. This does not affect
the native `click` event (a separate event type unaffected by stopping
propagation of `pointerdown`), so a plain click on the edge zone still bubbles
to the block's `onClick` and opens the modal, matching the "click anywhere on
the block" guardrail.

**Handle geometry.** Each handle is an 8 px-wide absolutely positioned strip at
`left: 0` / `right: 0` spanning the block's full height, with `cursor:
ew-resize`. 8 px is a reasonable default for the "edge hit-target size" the
roadmap left as an implementer decision (unblocking, tunable later) — it's
narrow enough to leave the middle of even a single-day block (44 px wide)
clickable/movable, and wide enough to be reliably grabbable with a mouse.

**Clamping (no invert, minimum one day).** Dates are ISO `'yyyy-MM-dd'`
strings, which already compare correctly with plain `<`/`>` (the codebase
already relies on this in lane assignment). For a right-edge drag: compute
`newEnd`, then clamp `newEnd = max(newEnd, alloc.start_date)`. For a left-edge
drag: compute `newStart`, then clamp `newStart = min(newStart, alloc.end_date)`.
This enforces the DB's `end_date >= start_date` constraint client-side and
caps duration loss at exactly one day (start === end), never below.

**Persistence.** Unlike the move handler (which always writes both dates), a
resize writes only the one field that changed: `{ end_date: newEnd }` for a
right-edge drag, `{ start_date: newStart }` for a left-edge drag. If the
clamped value equals the current value (drag didn't move it, or it was already
clamped to the limit), skip the write entirely (same early-exit pattern the
move handler already uses for `dayOffset === 0`).

**Error handling.** Reuse the existing `dragError` state and banner
(`Timeline.tsx:185`, `355–365`); a resize write failure sets a
resize-specific message via the same state, no new UI needed.

## Phase 1: Add resize edge handles and wire resize handling in drag-end

### Overview

Extend `DraggableAllocBlock` with two additional dnd-kit draggables (left and
right edge handles) and extend `handleDragEnd` to branch between move and
resize based on the dragged id's prefix, applying the correct clamped
single-field update.

### Required changes

#### 1. `Timeline.tsx` — edge handles inside `DraggableAllocBlock`

- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: Inside `DraggableAllocBlock` (`Timeline.tsx:98–154`), add a left
  and a right edge handle as children of the existing block div. Each calls
  `useDraggable({ id: 'resize-left-' + id })` / `useDraggable({ id:
  'resize-right-' + id })` and renders an 8 px-wide absolutely positioned
  strip (`left: 0` / `right: 0`, full height, `cursor: ew-resize`). Each
  handle's `onPointerDown` wraps dnd-kit's own `listeners.onPointerDown` with
  a `event.stopPropagation()` call first, so a grab on the handle doesn't also
  trigger the block's own move-drag. `attributes` and the wrapped
  `onPointerDown` are spread onto the handle's div; the block's own
  `{...attributes} {...listeners}` on the outer div are unchanged.
- **Contract**: The outer block div's existing move-drag, `data-block`
  attribute, and `onClick` guard are untouched. The two handles are visually
  and functionally additive — with `transform` `null` (not dragging) they have
  no layout effect beyond the 8 px hit zones.

#### 2. `Timeline.tsx` — `handleDragEnd` branch for resize

- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: At the top of `handleDragEnd` (`Timeline.tsx:215–240`), check
  `event.active.id`'s prefix. If it starts with `resize-right-` or
  `resize-left-`, strip the prefix to get the allocation id, look up the
  allocation, compute `dayOffset` the same way as today
  (`Math.round(event.delta.x / DAY_WIDTH)`), compute the new date for the
  grabbed edge only (`addDays` + `formatDate`, same utilities already
  imported), clamp it against the fixed opposite edge as described above,
  early-return if the clamped value is unchanged, then write only the one
  changed field to `supabase.from('allocations').update(...)` and call
  `onRefresh()` on success (mirroring the existing move handler's error
  handling via `dragError`). Otherwise, fall through to the existing move
  logic unchanged.
- **Contract**: `start_date`/`end_date` on the opposite (non-dragged) edge is
  never included in the resize update payload. The allocation can never be
  written with `end_date < start_date`. `person_id`, `project_id`,
  `hours_per_day`, `status`, and `notes` are untouched.

### Success criteria

#### Automated
- `pnpm build` completes with no new TypeScript errors and no new ESLint
  errors.

#### Manual
- Dragging a block's right edge rightward extends its end date; the start
  date is unchanged; the block reflects the new width after the refetch
  settles.
- Dragging a block's right edge leftward shortens its end date but cannot
  move it before the start date — the block stops shrinking once
  `start_date === end_date` (one-day minimum), and no invalid write is sent.
- Dragging a block's left edge leftward extends its start date earlier; the
  end date is unchanged.
- Dragging a block's left edge rightward shortens its start date but cannot
  cross the end date — same one-day-minimum clamp.
- After any resize, a page reload shows the persisted new dates.
- After any resize, the person's utilization bar reflects the new duration.
- A short pointer movement (< 5 px) anywhere on the block — including on an
  edge zone — still opens `AllocationModal`.
- Drag-to-move (S-01) still works: grabbing the block body between the two
  edge zones moves the whole block as before.
- Background drag-to-pan, lane stacking, filters, and time-off rendering are
  all unaffected.
- No console errors related to `@dnd-kit` during normal use.

## Testing Strategy

No new automated tests are introduced (the project has no test suite, same as
S-01). The automated gate is `pnpm build`. All behavioral verification is
manual, per the success criteria above.

If a test suite is added later, the key units under test are: the clamp
functions (right-edge and left-edge), given a `delta.x`/`DAY_WIDTH` and a
start/end pair, including the boundary case where the drag would invert or
zero out the duration; and the id-prefix branch in `handleDragEnd`.

## Migration Notes

No schema or data changes. No migration required. The `allocations` table
shape and the `end_date >= start_date` constraint are unchanged; the resize
gesture writes to the same `start_date`/`end_date` columns the modal and the
move gesture already write, one field at a time.

## References

- Roadmap slice S-02 (`context/foundation/roadmap.md`, S-02 block)
- PRD FR-002, FR-004, FR-005 (`context/discovery/discovery-notes.md`)
- Sibling slice S-01 plan (already implemented):
  `context/changes/drag-allocation-move/plan.md`
- Timeline root: `src/components/timeline/Timeline.tsx`
- Allocation geometry: `src/lib/utils.ts` (`getAllocationStyle`, `formatDate`)
- @dnd-kit/core docs: https://docs.dndkit.com/api-documentation/draggable
- @dnd-kit/utilities docs: https://docs.dndkit.com/api-documentation/utilities

## Progress

### Phase 1: Add resize edge handles and wire resize handling in drag-end
#### Automated
- [ ] 1.1 `pnpm build` completes with no new TypeScript errors and no new ESLint errors
#### Manual
- [ ] 1.2 Dragging the right edge rightward extends end date; start date unchanged
- [ ] 1.3 Dragging the right edge leftward shortens end date but clamps at start date (one-day minimum), no invalid write sent
- [ ] 1.4 Dragging the left edge leftward extends start date earlier; end date unchanged
- [ ] 1.5 Dragging the left edge rightward shortens start date but clamps at end date (one-day minimum)
- [ ] 1.6 Page reload after a resize confirms the persisted new dates
- [ ] 1.7 Utilization bar reflects the new duration after a resize
- [ ] 1.8 Short pointer movement (<5 px) anywhere on the block, including edge zones, still opens AllocationModal
- [ ] 1.9 Drag-to-move (S-01) still works: grabbing the block body between the edge zones moves it
- [ ] 1.10 Background drag-to-pan, lane stacking, filters, and time-off rendering are unaffected
- [ ] 1.11 No `@dnd-kit` console errors during normal use
