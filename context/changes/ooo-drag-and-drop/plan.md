# OOO Drag & Drop — Implementation Plan

## Overview
Give OOO blocks (urlop / L4 / nieobecność) the same drag gestures allocations
already have on the Timeline: grab the body to move the whole absence, and drag
the left/right edge to change its start/end date. On drop the block snaps to
whole-day boundaries, the new dates persist to the `time_off` table, and the
person's utilization recomputes. Today only project allocations are draggable;
OOO blocks are click-to-edit only.

## Current State Analysis
Allocations and OOO blocks are rendered in the same row loop and already share
lane layout via `assignLanesAll` (`src/components/timeline/Timeline.tsx:64`), and
`getAllocationStyle` is generic over `{ start_date, end_date }`
(`src/lib/utils.ts:23`) — so positioning already works for both kinds and needs
no change.

Allocation blocks are draggable through `DraggableAllocBlock`
(`Timeline.tsx:123`), which wraps the block in dnd-kit `useDraggable({ id })` and
renders two `ResizeHandle`s (`Timeline.tsx:101`) with ids `resize-left-<id>` /
`resize-right-<id>`. A single `<DndContext>` wraps the whole timeline
(`Timeline.tsx:460`). Drag state flows through three handlers:

- `handleDragMove` (`Timeline.tsx:249`) — recognizes `resize-left-` /
  `resize-right-` ids and updates `resizePreview` (`Timeline.tsx:221`) so the
  block visibly grows/shrinks per whole-day step during a resize.
- `handleDragEnd` (`Timeline.tsx:274`) — branches on the active id: a
  `resize-*` prefix persists a start/end change, otherwise it looks the id up in
  `allocations` and persists a move. Both write via
  `supabase.from('allocations').update(...).eq('id', ...)` then call `onRefresh`.
- `handleDragCancel` (`Timeline.tsx:353`) — clears preview + drag-active state.

OOO blocks take none of this path. They render as a plain `<div>` with only an
`onClick` that opens `TimeOffModal` (`Timeline.tsx:695–713`) — no `useDraggable`,
no resize handles — and `handleDragEnd` has no `time_off` branch, so an OOO block
cannot be moved or resized by drag.

OOO data lives in the `time_off` table with columns `person_id, type,
start_date, end_date, notes`; `TimeOffModal` reads/writes it via
`supabase.from('time_off')` (`src/components/timeline/TimeOffModal.tsx:59–63`).
The `TimeOff` type is at `src/lib/types.ts:57`.

Click-vs-drag arbitration is already solved and reusable as-is: `PointerSensor`
activation distance is 5 px (`Timeline.tsx:236`), the background pan gesture
skips any `[data-block]` element (`Timeline.tsx:383`), and `dragActiveRef`
(`Timeline.tsx:243`) plus `didDrag` guard block clicks from firing after a drag.

**Assumptions to verify during build:** (1) the `time_off` table enforces a
`valid_date_range`-style `end_date >= start_date` check like `allocations`
(`supabase-schema.sql:71`) — the drag clamps must respect it regardless; (2)
`supabase-schema.sql` is stale (it omits both the `time_off` table and the
`allocations.status` column the code uses), so the **running database schema**,
not that file, is authoritative — no schema file edits are in scope.

## Desired End State
- The body of every OOO block is a dnd-kit draggable; dragging it left/right
  shifts both `start_date` and `end_date` by the same whole-day offset (duration
  invariant), persists to `time_off`, and refreshes.
- Each OOO block has left/right edge handles; dragging an edge changes only that
  date, snapped to whole days, clamped so the absence stays at least one day
  (start ≤ end), persists to `time_off`, and refreshes.
- During a resize the OOO block shows the same live grow/shrink preview
  allocations show.
- Clicking an OOO block (movement < 5 px) still opens `TimeOffModal`; no modal
  opens during or after a drag.
- Background drag-to-pan, allocation drag/resize, lane stacking, filters, and the
  utilization bar (incl. the "🏖️ N dni OOO" line) are all unchanged; utilization
  recomputes after an OOO drag because `calcUtilization` already counts OOO days
  (`src/lib/utils.ts:57`).

### Key discoveries
- `src/components/timeline/Timeline.tsx:695–713` — OOO block render: a plain
  `<div>` with `data-block` + `onClick` only; the swap point for the new
  draggable block.
- `src/components/timeline/Timeline.tsx:123–185` — `DraggableAllocBlock`, the
  structural template for `DraggableOooBlock` (snapped transform at line 140,
  handles wired at 181–182).
- `src/components/timeline/Timeline.tsx:101–121` — `ResizeHandle` takes an `id`
  prop and is kind-agnostic; reuse it directly with `ooo-resize-*` ids.
- `src/components/timeline/Timeline.tsx:274–351` — `handleDragEnd`; add an OOO
  branch that writes to `time_off` and mirrors the allocation move/resize clamps.
- `src/components/timeline/Timeline.tsx:249–268` — `handleDragMove`; extend to
  recognize `ooo-resize-*` and drive the live preview.
- `src/components/timeline/Timeline.tsx:221–223` — `resizePreview` state; extend
  so a preview can target an OOO item as well as an allocation.
- `src/components/timeline/TimeOffModal.tsx:59–63` — canonical `time_off`
  read/write pattern to mirror for persistence.
- `src/lib/utils.ts:23,57` — `getAllocationStyle` and `calcUtilization` already
  handle OOO; no change needed.
- `package.json` — `@dnd-kit/core ^6.3.1` + `@dnd-kit/utilities ^3.2.2` already
  installed; build gate is `pnpm build` (`next build`, TS + ESLint); no test
  suite.

## What we're NOT doing
- No cross-row drag (moving an absence to another person) — matches the
  allocation gesture scope.
- No change to OOO `type` (urlop/L4/nieobecność) via drag — type stays a modal
  concern.
- No refactor of `DraggableAllocBlock` into a shared component — the allocation
  code stays untouched; `DraggableOooBlock` is a sibling.
- No optimistic UI — the block settles after `onRefresh`, matching allocations.
- No schema, RLS, or `supabase-schema.sql` changes.
- No new automated test suite (project has none); no touch/tablet sensor.

## Implementation Approach
Add a sibling `DraggableOooBlock` component in `Timeline.tsx` modeled on
`DraggableAllocBlock`, and give OOO drags their own id namespace so
`handleDragEnd` / `handleDragMove` can tell them apart from allocation drags and
route persistence to the `time_off` table:

- move → `ooo-<id>`
- resize → `ooo-resize-left-<id>` / `ooo-resize-right-<id>`

This was chosen over generalizing one shared block component: the allocation
drag path is working and non-trivial (move + resize + live preview + click
arbitration), and a shared abstraction would touch it for no functional gain.
Duplicating a ~40-line block component keeps blast radius on the allocation code
at zero and matches the house pattern already set by `DraggableAllocBlock`.

Because OOO drags are namespaced with an `ooo-` prefix, the handlers check the
OOO cases first and return; the existing allocation branches are reached only for
non-`ooo-` ids and stay byte-for-byte the same. Date math reuses the in-file
helpers (`addDays`, `formatDate`, `Math.round(delta.x / DAY_WIDTH)`); persistence
mirrors `TimeOffModal`'s `supabase.from('time_off').update(...)`.

## Critical Implementation Details
- **Handler dispatch order.** In `handleDragEnd` and `handleDragMove`, test
  `activeId.startsWith('ooo-')` before the allocation branches. Within OOO,
  test the `ooo-resize-left-` / `ooo-resize-right-` prefixes before the plain
  `ooo-` move case (the move id is a prefix of the resize ids).
- **Resize clamps (mirror allocations).** Right edge: `newEnd` clamped to
  `≥ start_date`; left edge: `newStart` clamped to `≤ end_date`; skip the write
  when the clamped date equals the current one or `dayOffset === 0`.
- **Live preview.** `resizePreview` must distinguish an OOO target from an
  allocation with the same underlying id — carry the namespaced drag id (or an
  explicit `kind`) in the preview state and match on it in both the OOO render
  branch and the existing allocation render branch.
- **Click suppression.** The new block's `onClick` opens `TimeOffModal` only when
  `!didDrag.current && !dragActiveRef.current`, matching the allocation guard at
  `Timeline.tsx:756`.

## Phase 1: OOO move (drag the body)
### Overview
Make the OOO block a draggable that shifts both dates on drop and persists to
`time_off`, with click-to-edit preserved.

### Required changes
#### 1. `DraggableOooBlock` component
- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: Add a sibling to `DraggableAllocBlock` that renders the current OOO
  visual (striped background, emoji + label from `TIME_OFF_LABELS`) but wrapped
  in `useDraggable({ id: 'ooo-' + id })`, applying the same whole-day snapped
  transform as `DraggableAllocBlock` (`Timeline.tsx:140`). Keeps `data-block` and
  the `title`.
- **Contract**: Props carry the precomputed `left/width/laneTop` and display
  fields; `id` is the raw `TimeOff.id`; `onClick` fires only when not dragging.

#### 2. OOO render branch swap
- **File**: `src/components/timeline/Timeline.tsx` (`:695–713`)
- **Goal**: Replace the plain OOO `<div>` with `<DraggableOooBlock>`, passing the
  same computed layout values and an `onClick` guarded by `!didDrag.current &&
  !dragActiveRef.current` that calls `openEditOoo(item)`.
- **Contract**: Visual output is unchanged when not dragging; lane/position math
  is untouched.

#### 3. OOO move branch in `handleDragEnd`
- **File**: `src/components/timeline/Timeline.tsx` (`:274`)
- **Goal**: When `activeId` is `ooo-<id>` (and not a resize id), find the item in
  `timeOffs`, compute `dayOffset`, shift both dates by it, and write
  `{ start_date, end_date }` to `supabase.from('time_off').update(...).eq('id', id)`,
  then `onRefresh()`. Reuse the existing error banner (`setDragError`) with an
  OOO-appropriate message.
- **Contract**: `async`; returns early on `dayOffset === 0`; touches only
  `start_date`/`end_date`; allocation branches unchanged.

### Success criteria
#### Automated
- `pnpm build` completes with no new TypeScript or ESLint errors.
#### Manual
- Dragging an OOO block three days right moves it three days right and the
  "🏖️ N dni OOO" / utilization figures update.
- Dragging left moves it left by the correct number of days; duration unchanged.
- Page reload confirms the new dates persisted to `time_off`.
- A short click (< 5 px) still opens `TimeOffModal`; no modal opens after a drag.
- Allocation drag/move, background pan, filters, and lane stacking are unaffected.
- No `@dnd-kit` console errors.

<!-- After Phase 1, STOP for human confirmation of the manual checks before Phase 2. -->

## Phase 2: OOO resize (drag the edges) + live preview
### Overview
Add left/right edge handles to the OOO block and the live grow/shrink preview,
persisting a single changed date on drop.

### Required changes
#### 1. Edge handles on `DraggableOooBlock`
- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: Render two `ResizeHandle`s inside the OOO block with ids
  `ooo-resize-left-<id>` and `ooo-resize-right-<id>` (reusing the existing
  `ResizeHandle` component).
- **Contract**: Handles sit on the block edges exactly as for allocations; the
  `ew-resize` cursor and `stopPropagation` behavior come from the shared
  component unchanged.

#### 2. OOO resize branch in `handleDragEnd`
- **File**: `src/components/timeline/Timeline.tsx` (`:274`)
- **Goal**: For `ooo-resize-right-<id>` / `ooo-resize-left-<id>`, mirror the
  allocation resize logic against `timeOffs`: compute the new edge date, clamp
  (right ≥ start, left ≤ end), skip no-op writes, persist the single changed date
  to `time_off`, then `onRefresh()`.
- **Contract**: Right handle writes only `end_date`; left handle writes only
  `start_date`; minimum span one day.

#### 3. Live resize preview for OOO
- **File**: `src/components/timeline/Timeline.tsx` (`handleDragMove` `:249`,
  `resizePreview` `:221`, OOO render branch `:695`)
- **Goal**: Recognize `ooo-resize-*` in `handleDragMove` and set a preview that
  targets the OOO item; in the OOO render branch apply the same
  `previewLeft/previewWidth` grow/shrink logic used for allocations
  (`Timeline.tsx:729–741`), with a one-day minimum width.
- **Contract**: The preview state distinguishes OOO from allocation targets so a
  shared underlying id can't cross-drive the wrong block; `handleDragCancel`
  clears it (already generic).

### Success criteria
#### Automated
- `pnpm build` completes with no new TypeScript or ESLint errors.
#### Manual
- Dragging the right edge later/earlier changes only the end date; the block
  visibly grows/shrinks during the drag.
- Dragging the left edge changes only the start date, with live preview.
- Resizing below one day clamps to a single day (no inverted/zero-length block).
- Page reload confirms the resized dates persisted.
- Allocation resize + its live preview still behave identically.
- No `@dnd-kit` console errors.

## Testing Strategy
No automated test suite exists; the automated gate is `pnpm build` (TypeScript +
ESLint). All behavioral checks are manual per the success criteria. If tests are
added later, the day-offset rounding and the resize clamps are the units worth
covering.

## Migration Notes
No schema or data migration. Both gestures write only `start_date`/`end_date` on
existing `time_off` rows, the same columns `TimeOffModal` already writes. Revert
by dragging back or editing in the modal.

## References
- Change identity: `context/changes/ooo-drag-and-drop/change.md`
- Precedent — allocation move: `context/changes/drag-allocation-move/plan.md`
- Precedent — allocation resize: `context/changes/drag-allocation-resize/plan.md`
- Precedent — live preview: `context/archive/2026-07-15-drag-live-preview/plan.md`
- Precedent — dnd wiring: `context/archive/2026-06-16-dnd-context-wiring/plan.md`
- Timeline root: `src/components/timeline/Timeline.tsx`
- OOO modal / persistence: `src/components/timeline/TimeOffModal.tsx`
- Types: `src/lib/types.ts`; layout/util helpers: `src/lib/utils.ts`
- @dnd-kit draggable: https://docs.dndkit.com/api-documentation/draggable

## Progress

### Phase 1: OOO move (drag the body)
#### Automated
- [x] 1.1 `pnpm build` completes with no new TypeScript or ESLint errors — da8716f (via `npm run build`; no pnpm on host at the time); re-confirmed with `pnpm build` directly — clean compile, no new TS/ESLint errors
#### Manual
- [ ] 1.2 Dragging an OOO block three days right moves it three days right; OOO/utilization figures update
- [ ] 1.3 Dragging left moves it left by the correct number of days; duration unchanged
- [ ] 1.4 Page reload confirms the new dates persisted to time_off
- [ ] 1.5 Short click (<5 px) still opens TimeOffModal; no modal opens after a drag
- [ ] 1.6 Allocation drag/move, background pan, filters, and lane stacking are unaffected
- [ ] 1.7 No @dnd-kit console errors

### Phase 2: OOO resize (drag the edges) + live preview
#### Automated
- [ ] 2.1 `pnpm build` completes with no new TypeScript or ESLint errors
#### Manual
- [ ] 2.2 Dragging the right edge changes only the end date; block grows/shrinks live during drag
- [ ] 2.3 Dragging the left edge changes only the start date, with live preview
- [ ] 2.4 Resizing below one day clamps to a single day (no inverted/zero-length block)
- [ ] 2.5 Page reload confirms the resized dates persisted
- [ ] 2.6 Allocation resize and its live preview still behave identically
- [ ] 2.7 No @dnd-kit console errors
