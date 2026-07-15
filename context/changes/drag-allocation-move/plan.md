# drag-allocation-move — Implementation Plan

## Overview

This change wires the drag-to-move gesture for Allocation blocks on the Timeline:
a Planner grabs the body of a block and drags it left or right to shift both its
start and end dates by the same number of days (duration is invariant). On drop
the block snaps to whole-day boundaries, the new dates persist to the database,
and the person's utilization recomputes. The AllocationModal never opens during
or after the drag. This is the north-star slice (S-01) — the highest-value
gesture and the one that de-risks gesture arbitration end-to-end.

## Current State Analysis

The Timeline renders Allocation blocks as absolutely positioned divs inside each
person's row (`src/components/timeline/Timeline.tsx:461–498`). Each block carries
a `data-block` attribute (`Timeline.tsx:463`) that already gates the background
drag-to-pan gesture: `handleMouseDown` returns early when the pointer lands on a
`[data-block]` element (`Timeline.tsx:134`). Clicking a block opens
`AllocationModal` via `openEdit(item)` guarded by `if (!didDrag.current)`
(`Timeline.tsx:464`).

`@dnd-kit/core ^6.3.1` is already a declared dependency (installed, not yet
imported). Prerequisite F-01 (`dnd-context-wiring`) places a `DndContext` +
`PointerSensor` (activation distance 5 px) around the Timeline JSX and provides
empty `onDragStart`, `onDragEnd`, `onDragCancel` stubs that this slice replaces.

Date math uses `date-fns` (`^4.2.1`), which is already imported in `Timeline.tsx`
(`addDays`, `differenceInCalendarDays`). Post-drop persistence goes to the
`allocations` Supabase table via `supabase.from('allocations').update(payload).eq('id', id)`,
the same pattern used by `AllocationModal` (`AllocationModal.tsx:80–82`). After
a successful update, the `onRefresh` callback (`Timeline.tsx:78`, wired from
`TimelineClient.tsx:21–29`) re-fetches allocations and drives a re-render.

The scroll container converts a pointer's X pixel position to a date via
`differenceInCalendarDays` plus the `viewStart` reference date
(`Timeline.tsx:116–130`). Each day column is `DAY_WIDTH` pixels wide; the
day-offset for the drag can therefore be computed as
`Math.round(dragDeltaPixels / DAY_WIDTH)`.

No existing automated tests. The only automated gate is `pnpm build`
(TypeScript + ESLint).

### Key discoveries

- `src/components/timeline/Timeline.tsx:133–134` — `handleMouseDown` already
  excludes `[data-block]` elements from pan; allocation blocks remain out of the
  pan gesture with zero code change.
- `src/components/timeline/Timeline.tsx:461–468` — allocation block outer div:
  `data-block` attribute at line 463, `onClick` guard at line 464.
- `src/components/timeline/Timeline.tsx:110–113` — `isDragging`, `dragStartX`,
  `dragStartScrollLeft`, `didDrag` refs for the pan gesture; unaffected by
  dnd-kit drag state.
- `src/components/timeline/Timeline.tsx:78` — `onRefresh: () => void` prop;
  wired to `TimelineClient.tsx:21–29` (re-fetches allocations + time-off).
- `src/components/timeline/Timeline.tsx:513–522` — `AllocationModal` render;
  `onSaved={onRefresh}`. Modal must not open during or after a drag.
- `src/components/timeline/AllocationModal.tsx:80–82` — update path:
  `supabase.from('allocations').update(payload).eq('id', id)`.
- `src/components/timeline/Timeline.tsx:6–9` — `addDays`, `differenceInCalendarDays`
  already imported from `date-fns`; no new imports for date math.
- `package.json:12` — `@dnd-kit/core ^6.3.1`; `@dnd-kit/utilities ^3.2.2` also
  available (CSS transform helpers if needed).
- F-01 (`dnd-context-wiring`) must be merged before this slice; it provides the
  `DndContext` ancestor and the typed handler stubs this slice replaces.

## Desired End State

When this change ships:

- The body of every Allocation block is a dnd-kit draggable (via `useDraggable`).
- Dragging a block left or right produces a translated visual position during the
  drag (the block moves with the pointer).
- On drop: the day offset is computed from the drag delta, both start and end
  dates are shifted by that offset, the dates persist to `allocations`, and
  `onRefresh` is called — the block settles at its new position with correct lane
  stacking and updated utilization bar.
- The block snaps to whole-day boundaries (no fractional-day positions).
- Duration is invariant: end minus start remains the same as before the drag.
- No modal opens during or after the drag.
- Click-on-block (pointer-up without crossing the 5 px activation distance from
  F-01) still opens `AllocationModal` as before.
- Background drag-to-pan still works (the `[data-block]` short-circuit at
  `Timeline.tsx:134` already excludes allocation blocks from pan).
- Time-off blocks, filters, lane stacking, utilization bars, and all other
  Timeline behavior are unchanged.

## What we're NOT doing

- No drag-to-resize (edge handles) — that is S-02 (`drag-allocation-resize`).
- No live ghost/preview during drag — that is S-03 (`drag-live-preview`); the
  block itself translates with the pointer as implicit feedback.
- No cross-row drag (person reassignment) — explicitly out of scope for this
  increment per PRD Non-Goals.
- No undo/redo — drop commits immediately; reverting is done by dragging back or
  editing in the modal.
- No optimistic UI update — the block snaps to its new position after
  `onRefresh` completes (the network call is fast for this internal tool;
  optimistic update adds complexity without meaningful UX gain given the
  small-team scale).
- No changes to `TimelineClient.tsx`, `AllocationModal`, `supabase-schema.sql`,
  or any auth/RLS policy.
- No touch or tablet sensor.
- No changes to time-off blocks or the OOO drag path.

## Implementation Approach

There are two structural choices for where `useDraggable` is called:

**Option A — inline in `Timeline.tsx`.** Call `useDraggable` inside the
allocation block render loop, replace the outer `div` with a `div` that receives
the dnd-kit `attributes`, `listeners`, and `transform` style. Handle `onDragEnd`
inside the same file where the blocks are rendered.

**Option B — extract `AllocationBlock` component.** Extract the allocation block
JSX into a separate `AllocationBlock.tsx` component that owns `useDraggable`
internally, keeping `Timeline.tsx` cleaner.

**Choice: Option A.** `Timeline.tsx` is self-contained (535 lines with no
existing sub-components for blocks); extracting a component is a refactor
orthogonal to this change. Keeping `useDraggable` inline preserves the current
code shape, matches the pattern established by F-01 (which modifies only
`Timeline.tsx`), and avoids scope creep. If `Timeline.tsx` grows further, a
component extract is a clean subsequent refactor.

**Implementation note (deviation from plan):** The implementation extracted a
`DraggableAllocBlock` function component within `Timeline.tsx` rather than
calling `useDraggable` inline in the render loop. The component stays in the
same file (no new file introduced), making the option a variant of Option A.
This was accepted as an improvement: pre-computing layout values in the outer
loop and passing them as props removed the conditional complexity from the
inner JSX. The architectural intent of Option A (no separate file, no scope
creep) is preserved.

The drag-end handler computes the day offset from the `delta.x` value provided
by dnd-kit's `DragEndEvent`, divides by the pixel width of a day column
(`DAY_WIDTH` constant already in the file), rounds to the nearest integer, then
calls `addDays` on both the allocation's `start_date` and `end_date` before
persisting. The `formatDate` utility (`src/components/timeline/utils.ts:125–127`)
converts `Date` back to `'yyyy-MM-dd'` strings for the Supabase payload.

**Optimistic update vs. refetch:** This plan chooses post-drop refetch via
`onRefresh`. Rationale: the Timeline already uses a refetch loop after all
mutations (modal saves, etc.); consistency matters more than the ~200ms wait
on an internal tool at small scale. The block will briefly flicker back to its
old position before the refetch settles, but this is acceptable for the
MVP gesture.

## Phase 1: Make allocation blocks draggable and wire drag-end handler

### Overview

Add `useDraggable` to each allocation block in `Timeline.tsx`, apply the
dnd-kit-provided transform as a CSS `translate` during the drag, and implement
the `onDragEnd` handler (replacing the F-01 stub) to compute the day offset,
update the database, and call `onRefresh`.

### Required changes

#### 1. `Timeline.tsx` — import useDraggable

- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: Import `useDraggable` and `DragEndEvent` from `@dnd-kit/core`. No
  other import changes needed (sensors/context already added by F-01).
- **Contract**: `useDraggable` is called once per allocation block inside the
  render loop; each call receives `id: String(item.id)` so dnd-kit can track
  which block is active.

#### 2. `Timeline.tsx` — allocation block outer div

- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: Spread dnd-kit's `attributes` and `listeners` onto the allocation
  block outer div, and apply the drag `transform` as an inline CSS `transform`
  property using `@dnd-kit/utilities`' `CSS.Transform.toString(transform)`.
  The `data-block` attribute must remain so the pan-gesture short-circuit
  (`Timeline.tsx:134`) continues to work.
- **Contract**: The outer div keeps all existing props (`data-block`, `onClick`
  guard, `style` for left/top/width/height). The `transform` style is additive —
  it has no effect when `transform` is `null` (i.e., when not dragging). The
  `CSS` helper from `@dnd-kit/utilities` is the canonical way to convert the
  dnd-kit transform object to a CSS string.

#### 3. `Timeline.tsx` — onDragEnd handler

- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: Replace the empty `onDragEnd` stub (added by F-01) with a handler
  that: (a) looks up the allocation whose id matches `event.active.id`, (b)
  computes `dayOffset = Math.round(event.delta.x / DAY_WIDTH)`, (c) exits early
  if `dayOffset === 0`, (d) calls `addDays` on both dates, (e) writes
  `{ start_date: newStart, end_date: newEnd }` to `supabase.from('allocations').update(...)`,
  (f) calls `onRefresh()` after the update resolves.
- **Contract**: The handler is `async`. It receives a `DragEndEvent` from
  dnd-kit. `event.active.id` is the allocation's `id` cast to string (matching
  the `id` passed to `useDraggable`). `event.delta.x` is the total horizontal
  displacement in pixels since drag start — dnd-kit provides this directly, no
  manual tracking needed. The Supabase update touches only `start_date` and
  `end_date`; all other fields (`person_id`, `project_id`, `hours_per_day`,
  `status`, `notes`) are left unchanged.

#### 4. `Timeline.tsx` — suppress modal on drag

- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: Ensure that dropping a block (a drag that covered more than 5 px)
  does not open `AllocationModal`. The existing `if (!didDrag.current)` guard
  on the `onClick` handler (`Timeline.tsx:464`) protects against the _pan_
  gesture's drag flag, but dnd-kit's pointer sensor claims the pointer events
  for blocks once the activation distance is crossed, which means the `onClick`
  on the block should never fire after a true drag anyway. Verify this during
  manual testing; add an explicit dnd-kit `isDragging` ref guard to `onClick`
  if needed.
- **Contract**: After a completed drag-to-move gesture, `AllocationModal` must
  not open. The existing `onClick` guard plus dnd-kit's pointer-event capture
  is expected to be sufficient; this item exists to ensure it is verified.

### Success criteria

#### Automated
- `pnpm build` completes with no new TypeScript errors and no new ESLint errors.

#### Manual
- Grab an allocation block body and drag it three days to the right; on drop,
  the block appears three days later and the utilization bar updates.
- Grab a block and drag it to the left; on drop, the block moves left by the
  correct number of days.
- Duration is unchanged after a move (end minus start same as before).
- A page reload after a drag confirms the new dates are persisted.
- A short pointer movement (less than 5 px) on a block still opens
  `AllocationModal` (click is preserved).
- Background drag-to-pan still scrolls the Timeline (grabbing empty space between
  blocks still pans).
- Time-off blocks, lane stacking of overlapping items, filters, and utilization
  bars are all unaffected.
- No console errors related to `@dnd-kit` during normal use.

## Testing Strategy

No new automated tests are introduced (the project has no test suite). The
automated gate is `pnpm build` (TypeScript + ESLint). All behavioral verification
is manual, following the success criteria above.

If a test suite is added in the future, the key unit under test is the day-offset
calculation: given a `delta.x` and `DAY_WIDTH`, the computed `dayOffset` must
round correctly (including negative values, zero, and boundary cases near 0.5
days).

## Migration Notes

No schema or data changes. No migration required. The `allocations` table shape
and the `end_date >= start_date` constraint are unchanged; the gesture simply
writes to the same `start_date`/`end_date` columns that the modal already writes.

## References

- Roadmap slice S-01 (`context/foundation/roadmap.md`, S-01 block)
- PRD FR-001, FR-004, FR-005, US-01 (`context/prd/prd.md`)
- Prerequisite F-01 plan: `context/changes/dnd-context-wiring/plan.md`
- Timeline root: `src/components/timeline/Timeline.tsx`
- AllocationModal: `src/components/timeline/AllocationModal.tsx`
- Timeline client shell: `src/app/(dashboard)/timeline/TimelineClient.tsx`
- Date utilities: `src/components/timeline/utils.ts`
- @dnd-kit/core docs: https://docs.dndkit.com/api-documentation/draggable
- @dnd-kit/utilities docs: https://docs.dndkit.com/api-documentation/utilities

## Progress

### Phase 1: Make allocation blocks draggable and wire drag-end handler
#### Automated
- [x] 1.1 `pnpm build` completes with no new TypeScript errors and no new ESLint errors
#### Manual
- [ ] 1.2 Dragging a block three days right moves it three days right; utilization bar updates
- [ ] 1.3 Dragging a block left moves it left by the correct number of days
- [ ] 1.4 Duration is unchanged after a move (end minus start same as before)
- [ ] 1.5 Page reload confirms new dates are persisted
- [ ] 1.6 Short pointer movement (<5 px) still opens AllocationModal (click preserved)
- [ ] 1.7 Background drag-to-pan still works (empty-space pan scrolls the Timeline)
- [ ] 1.8 Time-off blocks, lane stacking, filters, and utilization bars are unaffected
- [ ] 1.9 No `@dnd-kit` console errors during normal use
