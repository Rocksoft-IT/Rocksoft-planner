# drag-live-preview — Plan Brief

→ Full plan: [`plan.md`](./plan.md)
→ Roadmap slice: S-03 in `context/foundation/roadmap.md`
→ PRD refs: FR-003 in `context/prd/prd.md` (nice-to-have)
→ Prerequisites: `drag-allocation-move` (S-01), `drag-allocation-resize` (S-02)
  — both implemented and merged

## What & why

While a Planner is mid-drag on an Allocation block, the block should visibly
track the projected new position/size in real time, snapping to whole-day
increments as it goes, so the Planner has confidence in the result before
releasing. This is nice-to-have polish (FR-003) on top of the two core
gestures (move, resize), which already snap-on-drop without a live preview.

## Starting point

- `src/components/timeline/Timeline.tsx` already implements both move (S-01)
  and resize (S-02) gestures, merged on `main`.
- **Resize already has a day-snapped live preview.** A same-day fix to S-02
  (commit `8405956`) added `handleDragMove` + a `resizePreview` state
  (`Timeline.tsx:217–264`) that grows/shrinks the block in real time, snapped
  per day, ahead of this slice being planned.
- **Move does not yet.** `DraggableAllocBlock`'s CSS transform
  (`Timeline.tsx:145`) passes dnd-kit's raw, continuous `transform.x`
  straight through — the block follows the pointer pixel-for-pixel during a
  move, only snapping to a day boundary once, at drop.
- No automated test suite; `pnpm build` is the only automated gate.

## Desired end state

Both gestures show the block itself (no separate ghost overlay) advancing in
day-snapped increments in real time as the pointer moves, matching what will
actually be persisted at drop. Resize is unchanged (already correct); move
gets the same day-snapping resize already has.

## Key decisions made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Preview is the real block, not a separate ghost element | Continue moving/resizing the actual `DraggableAllocBlock`, no overlay DOM node | Matches the pattern S-01/S-02 already established; avoids a second render path that must be kept in sync with the real block's geometry | Plan (resolves roadmap Outcome wording "ghost or outline") |
| Where the move-preview snap lives | Local computation inside `DraggableAllocBlock`, using the `transform` value `useDraggable` already returns — no new Timeline-level state | Move's `useDraggable` and its CSS transform are in the same component (unlike resize, where handle and block are siblings); a local snap is simpler and cheaper than lifting state | Plan |
| Snap formula | `Math.round(transform.x / DAY_WIDTH) * DAY_WIDTH`, mirroring `handleDragEnd`'s existing `Math.round(delta.x / DAY_WIDTH)` | Guarantees the live preview always matches what gets persisted at drop for the same pointer position, with no new date arithmetic | Plan |
| Resize preview mechanism | Leave as-is; validate only | Already shipped (PR #39), already day-snapped, already dedups state updates to once per day-boundary crossing | Research |
| Jank-risk mitigation (roadmap's explicit Risk) | No refactor of resize's Timeline-level re-render; rely on existing dedup + note that `handleScroll` already triggers full-tree re-renders at higher frequency during panning | The existing pattern is already less frequent than an already-accepted cost elsewhere in this file; re-architecting a shipped mechanism is out of proportion for a nice-to-have polish slice | Research |
| Flicker between drop and refetch settle | Accepted, not fixed | Same no-optimistic-update tradeoff already made in S-01/S-02; fixing it would require optimistic UI, explicitly rejected before | Plan (carried from S-01) |

## Scope

**In:**
- Day-snapping the move gesture's live CSS transform (`DraggableAllocBlock`
  in `Timeline.tsx`)
- Manual validation that the existing resize live preview still behaves
  correctly and stays smooth at a realistic dataset size

**Out:**
- A separate ghost/outline overlay element
- Any change to `handleDragEnd`'s persistence logic, clamping, or date math
- Any change to the resize preview's implementation
- Optimistic UI / eliminating the drop-to-refetch flicker
- Cross-row drag, touch/tablet, schema/RLS changes

## Architecture / Approach

Single-file change: `src/components/timeline/Timeline.tsx`. Round the move
block's dnd-kit `transform.x` to the nearest `DAY_WIDTH` multiple before
building its CSS transform string — a local, stateless computation. No
changes to `handleDragMove`, `handleDragEnd`, or the resize path.

## Phases at a glance

| Phase | Delivers | Key risk |
|---|---|---|
| 1 — Snap move's live preview to day boundaries | Move and resize both show real-time, day-snapped visual feedback | Jank at realistic dataset size — mitigated by keeping the move snap local (no new re-render) and by resize's existing dedup'd, once-per-day-crossing update pattern |

**Prerequisites:** `drag-allocation-move` (S-01) and `drag-allocation-resize`
(S-02), both implemented and merged.

## Open risks & assumptions

- **Dataset-scale jank**: the roadmap explicitly calls this out as the risk
  to validate, not assume; manual testing at a realistic dataset size is a
  required success criterion, not optional polish.
- **Drop-to-refetch flicker**: both previews clear immediately at
  `handleDragEnd`/`handleDragCancel`, before the awaited Supabase write and
  `onRefresh` resolve — a brief visual reset-then-settle is expected and
  accepted, consistent with S-01/S-02.
- **Stale sibling metadata**: `drag-allocation-move/change.md` shows
  `status: implementing` even though the gesture is fully merged in
  `Timeline.tsx`; this plan treats the code as ground truth and does not
  attempt to reconcile that file.
- **No tests**: `pnpm build` is the only automated gate; all behavioral and
  performance verification is manual.

## Success criteria (summary)

- `pnpm build` passes with no new TypeScript or ESLint errors.
- Move drag visually advances in day-snapped increments, matching resize's
  existing behavior and matching what persists at drop.
- Resize's existing live preview is unchanged and confirmed still correct.
- Both gestures feel smooth at a realistic dataset size, with no jank beyond
  the existing background-pan re-render baseline.
- Click-to-edit, background pan, lane stacking, filters, and time-off
  rendering are all unaffected.
