# drag-live-preview — Implementation Plan

## Overview

While a Planner is mid-drag (move or resize) on an Allocation block, the block
itself should visibly track the projected result in real time, snapping to
whole-day increments as it goes — not just jumping to the new position/size
after drop. This slice (S-03) closes the one remaining gap: the move gesture's
in-drag visual feedback is currently a raw, unsnapped pixel-for-pixel follow of
the pointer. The resize gesture already got a day-snapped live preview as part
of a same-day fix to `drag-allocation-resize` (commit `8405956`), so this plan
also formalizes and validates that existing behavior as part of S-03's
delivered scope rather than re-implementing it.

## Current State Analysis

Both prerequisite slices are implemented and merged on top of F-01
(`dnd-context-wiring`):

- **Move** (`drag-allocation-move`, S-01): `DraggableAllocBlock`
  (`src/components/timeline/Timeline.tsx:123–181`) calls
  `useDraggable({ id })` on the block's own outer div and applies dnd-kit's
  live `transform` directly as a CSS transform:
  `transform: CSS.Transform.toString(transform ? { ...transform, y: 0 } : null)`
  (`Timeline.tsx:145`). `transform.x` is the raw, continuous pointer delta in
  pixels — it moves the block sub-pixel-smoothly with the pointer during the
  drag, with **no day-boundary snapping until drop**. Snapping only happens in
  `handleDragEnd` (`Timeline.tsx:270–347`), which computes
  `dayOffset = Math.round(event.delta.x / DAY_WIDTH)` once, at the moment of
  release.
- **Resize** (`drag-allocation-resize`, S-02): `ResizeHandle`
  (`Timeline.tsx:101–121`) is a second, independent `useDraggable` per edge
  (`resize-left-<id>` / `resize-right-<id>`). Unlike the block itself, the
  handle does not use its own `transform` for visual feedback — instead,
  `Timeline`'s `handleDragMove` (`Timeline.tsx:245–264`, wired via
  `DndContext`'s `onDragMove` at `Timeline.tsx:459`) computes a **day-snapped**
  `dayOffset` from `event.delta.x` and stores it in a `resizePreview` state
  (`Timeline.tsx:217–219`) at the `Timeline` component level. This state is
  read back in the render loop (`Timeline.tsx:723–737`) to compute
  `previewLeft`/`previewWidth` for the one matching block, clamped to a
  one-day minimum (`minWidth = DAY_WIDTH - 4`, matching
  `getAllocationStyle`'s `-4` inter-block gap). The preview is cleared in both
  `handleDragEnd` (`Timeline.tsx:272`) and `handleDragCancel`
  (`Timeline.tsx:351`).
- `resizePreview` updates are deduplicated to fire only when the *snapped* day
  offset changes (`Timeline.tsx:259–263`), not on every raw pointer-move
  event — this bounds the state-update (and full-tree re-render) frequency to
  at most once per day-boundary crossing, regardless of pointer sampling rate.
- Both `handleDragEnd` branches (move and resize) persist via
  `supabase.from('allocations').update(...)` and call `onRefresh()`
  (`Timeline.tsx:270–347`); the displayed position/size is authoritative only
  after the post-drop refetch settles (no optimistic update anywhere in this
  file — an explicit, already-established choice from S-01/S-02).
- `getAllocationStyle` (`src/lib/utils.ts:23–45`) is pure geometry derived
  from `start_date`/`end_date`; it is unaware of in-progress drags. Preview
  math (both existing resize preview and the move snapping this plan adds)
  lives entirely in `Timeline.tsx`, layered on top of `getAllocationStyle`'s
  output.
- No automated test suite; `pnpm build` (TypeScript + ESLint) is the only
  automated gate, same as S-01/S-02.
- `context/changes/drag-allocation-move/change.md` currently shows
  `status: implementing` / `plan_stage: 3/5`, which is stale relative to the
  actual code — the move gesture is fully present and merged in
  `Timeline.tsx` on `main`. This plan treats the code as ground truth and does
  not attempt to reconcile that metadata (out of scope for `rs-plan`).

### Key discoveries

- `Timeline.tsx:145` — the move block's CSS transform passes dnd-kit's raw
  `transform.x` straight through with no rounding; this is the one gap
  between current behavior and the roadmap's "snaps to day boundaries in real
  time" acceptance criterion for move.
- `Timeline.tsx:217–264` — the resize preview mechanism already satisfies the
  same acceptance criterion for resize, including day-snapping and dedup'd
  state updates. This is the pattern to be consistent with, not a gap to
  close.
- `Timeline.tsx:270–347` (`handleDragEnd`) already computes the persisted
  day-offset via `Math.round(delta.x / DAY_WIDTH)` for both move and resize —
  identical math to what a snapped preview needs. Visual snapping introduces
  no new date arithmetic, only a rounding step applied earlier (during the
  drag) instead of solely at drop.
- `Timeline.tsx:372–376` (`handleScroll`) already calls `setVisibleDate` on
  every scroll event, forcing a full `Timeline` re-render (including the
  `rowData` map over every person/allocation/day cell) at high frequency
  during panning. This is useful context for the roadmap's jank-risk
  callout: the existing resize-preview mechanism's occasional full-tree
  re-render (at most once per day-boundary crossed, per
  `Timeline.tsx:259–263`) is strictly less frequent than what scrolling
  already triggers today, and that scroll-driven re-render pattern is already
  accepted at this codebase's scale. This grounds the decision below to reuse
  the existing per-component-state approach rather than introduce new
  cross-cutting memoization as part of this slice.
- The move block's own `useDraggable` call already lives inside
  `DraggableAllocBlock` (`Timeline.tsx:136`) — the component already
  re-renders on every raw pointer-move tick as dnd-kit updates `transform`
  internally. Rounding that value before building the CSS string is a purely
  local computation with no new state and no new re-render cost beyond what
  already happens today.

## Desired End State

When this change ships:

- While dragging a block's body (move), the block's visual position advances
  in whole-day increments in real time — it jumps from one day-column-aligned
  position to the next as the pointer crosses each day boundary, the same way
  the resize preview already behaves, instead of following the pointer
  pixel-for-pixel.
- While dragging a block's edge (resize), the block's visual size continues
  to grow/shrink in day-snapped increments in real time, exactly as it does
  today (no behavior change — validated, not modified).
- In both cases, the preview is the block itself (no separate ghost/outline
  DOM element) — consistent with how S-01 and S-02 already give drag feedback
  by moving/resizing the real block. The visually-previewed state always
  matches what `handleDragEnd` will actually persist for the same pointer
  position.
- On drop, the preview state clears and the block settles into its final
  persisted position/size once the write completes and `onRefresh` brings
  back the new dates — unchanged from today.
- Dragging (move or resize) at a realistic dataset size (a full team's worth
  of people, allocations, and the existing ~730-day rendered range) does not
  introduce perceptible jank beyond what background panning already exhibits
  in this codebase today.

## What we're NOT doing

- No separate ghost/outline overlay element — the dragged block itself is the
  preview, matching the established pattern from S-01/S-02.
- No change to the resize preview's implementation — it already meets the
  acceptance criteria; this plan only adds a manual validation pass to
  confirm that continues to hold when reviewed alongside the new move-preview
  code.
- No optimistic update, and no attempt to eliminate the brief flicker between
  drop and the post-refetch settle (the preview clears immediately in
  `handleDragEnd`/`handleDragCancel`, before the awaited Supabase write and
  `onRefresh` resolve) — this is the same accepted refetch-based data flow
  established in S-01/S-02; closing that gap would require introducing
  optimistic UI, explicitly rejected in the S-01 plan.
- No cross-row drag (person reassignment) — out of scope per PRD Non-Goals.
- No changes to `handleDragEnd`'s persistence logic, date math, or clamping —
  this slice is visual-only during the drag; what gets written on drop is
  unchanged.
- No changes to `TimelineClient.tsx`, `AllocationModal`, `supabase-schema.sql`,
  or any auth/RLS policy.
- No touch or tablet sensor.
- No reconciliation of the stale `plan_stage`/`status` metadata in
  `drag-allocation-move/change.md`.

## Implementation Approach

The gap is narrow and purely visual: snap the move gesture's live CSS
transform to the nearest day-width increment, the same way the resize
preview already snaps.

**Where the snap lives.** Unlike resize (where the handle and the block it
resizes are separate sibling components, so the in-progress delta has to be
lifted to a shared ancestor — `Timeline`'s `handleDragMove` — to reach the
block), the move gesture's `useDraggable` call and the CSS transform it
drives both live in the same component, `DraggableAllocBlock`
(`Timeline.tsx:123–181`). No new Timeline-level state is needed: the snap is
a local computation on the `transform` value `useDraggable` already returns
for that block. This is simpler than, and doesn't need to match, the
resize preview's architecture — it's cheaper (no full-tree re-render) and
requires no new dnd-kit event wiring (`onDragMove` already exists for
resize and needs no changes).

**Snap formula.** `snappedX = transform ? Math.round(transform.x / DAY_WIDTH) * DAY_WIDTH : 0`,
applied in place of the raw `transform.x` when building the CSS transform
string. This mirrors `handleDragEnd`'s existing
`Math.round(event.delta.x / DAY_WIDTH)` exactly (`transform.x` during an
active drag and `event.delta.x` at drop are the same dnd-kit-provided pixel
delta), so the live preview always matches what will actually be persisted
for the same pointer position — no new date arithmetic, just the same
rounding applied earlier.

**No change to resize.** The existing `resizePreview` mechanism already
delivers a day-snapped live preview and already dedups state updates to one
per day-boundary crossing. It is left as-is; this plan's only obligation
toward resize is manual validation (below) that it still behaves correctly
and that its full-`Timeline`-re-render-per-day-crossing cost remains
acceptable, using the existing scroll-driven re-render behavior
(`handleScroll` → `setVisibleDate`) as the accepted performance baseline for
this codebase.

## Phase 1: Snap the move gesture's live preview to day boundaries

### Overview

Round the move block's in-drag CSS transform to the nearest day-width
increment, and manually validate both move and resize previews for
correctness and jank at a realistic dataset size.

### Required changes

#### 1. `Timeline.tsx` — day-snap the move block's live transform

- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: In `DraggableAllocBlock` (`Timeline.tsx:136–146`), round the
  horizontal component of dnd-kit's `transform` to the nearest multiple of
  `DAY_WIDTH` before rendering it as the block's CSS transform, so the block
  visibly advances in whole-day increments during a move drag instead of
  following the pointer continuously.
- **Contract**: The vertical component stays fixed at `0` (unchanged — a
  move never shifts lanes). `scaleX`/`scaleY` are untouched (always `1`,
  dnd-kit's default, no scaling in this codebase). `handleDragEnd`'s
  drop-time date math and the Supabase write payload are unchanged — this is
  a rendering-only change layered on top of the existing `transform` value;
  no new state, no new dnd-kit event handlers.

### Success criteria

#### Automated
- `pnpm build` completes with no new TypeScript errors and no new ESLint
  errors.

#### Manual
- Dragging a block's body (move) shows the block jumping to each successive
  day-column position as the pointer crosses a day boundary, rather than
  following the pointer's raw pixel position.
- The block's visually-previewed position during a move drag always matches
  the position it settles into after drop (same day offset in both).
- Dragging a block's edge (resize) still shows the existing day-snapped
  grow/shrink preview, unchanged from before this phase.
- Releasing a move or resize drag clears the preview and the block settles
  into its final position/size once the write and refetch complete (matching
  pre-existing S-01/S-02 behavior — no new flicker introduced).
- With a realistically-sized dataset loaded (a full team's worth of people
  and allocations across the existing ~730-day range), dragging a block
  (move or resize) feels smooth, with no visibly dropped frames or stutter
  beyond what background drag-to-pan already exhibits in this codebase.
- A short pointer movement (< 5 px) still opens `AllocationModal`, and
  background drag-to-pan, lane stacking, filters, and time-off rendering are
  all unaffected.
- No console errors related to `@dnd-kit` during normal use.

## Testing Strategy

No new automated tests are introduced (the project has no test suite, same
as S-01/S-02). The automated gate is `pnpm build`. All behavioral and
performance verification is manual, per the success criteria above.

If a test suite is added later, the key unit under test is the snap
function itself: given a raw `transform.x`/`delta.x` and `DAY_WIDTH`, the
snapped value must equal `handleDragEnd`'s persisted `dayOffset * DAY_WIDTH`
for the same input, across positive, negative, and near-boundary (0.5-day)
values.

## Performance Notes

The roadmap flags a specific risk for this slice: "Continuous preview
rendering during drag may cause jank on large Timelines." Two different
mechanisms are involved and each is bounded differently:

- **Move**: the snap is a local computation inside the single dragged
  block's own component, using a value (`transform`) that already drives a
  re-render of that one component on every dnd-kit pointer-move tick today.
  Rounding adds no new state and no new re-render beyond what S-01 already
  does.
- **Resize**: the snap lives in `Timeline`-level state (`resizePreview`)
  because the resize handle and the block it previews are sibling
  components. Each update re-renders the whole `Timeline` tree, but updates
  are deduplicated to fire only once per day-boundary crossing
  (`Timeline.tsx:259–263`), not on every pointer-move tick. This is already
  shipped (PR #39) and is no more frequent than the full-tree re-renders
  `handleScroll` already triggers on every scroll frame during background
  panning — an already-accepted cost at this codebase's scale. No
  refactor is planned; the manual success criteria above validate this holds
  at a realistic dataset size rather than re-architecting a working,
  shipped mechanism.

## Migration Notes

No schema or data changes. No migration required. This slice is visual-only;
it does not change what gets written to the `allocations` table or when.

## References

- Roadmap slice S-03 (`context/foundation/roadmap.md`, S-03 block)
- PRD FR-003 (`context/prd/prd.md`) — live preview, nice-to-have
- Prerequisite plans (both implemented):
  `context/changes/drag-allocation-move/plan.md` (S-01),
  `context/changes/drag-allocation-resize/plan.md` (S-02)
- Fix that added the resize live preview ahead of this slice:
  commit `8405956`, "fix(drag-allocation-resize): live block preview while
  resizing"
- Timeline root: `src/components/timeline/Timeline.tsx`
- Allocation geometry: `src/lib/utils.ts` (`getAllocationStyle`)
- @dnd-kit/core docs: https://docs.dndkit.com/api-documentation/draggable
- @dnd-kit/utilities docs: https://docs.dndkit.com/api-documentation/utilities

## Progress

### Phase 1: Snap the move gesture's live preview to day boundaries
#### Automated
- [x] 1.1 `pnpm build` completes with no new TypeScript errors and no new ESLint errors
#### Manual
- [ ] 1.2 Move drag shows the block jumping to each successive day-column position as the pointer crosses a day boundary, rather than following the pointer's raw pixel position
- [ ] 1.3 The block's visually-previewed position during a move drag always matches the position it settles into after drop
- [ ] 1.4 Resize drag still shows the existing day-snapped grow/shrink preview, unchanged
- [ ] 1.5 Releasing a move or resize drag clears the preview and the block settles into its final position/size after write + refetch, with no new flicker introduced
- [ ] 1.6 With a realistically-sized dataset loaded, dragging (move or resize) feels smooth, with no visibly dropped frames or stutter beyond existing background pan behavior
- [ ] 1.7 Short pointer movement (<5 px) still opens AllocationModal; background pan, lane stacking, filters, and time-off rendering are unaffected
- [ ] 1.8 No `@dnd-kit` console errors during normal use
