# drag-allocation-resize — Plan Brief

→ Full plan: [`plan.md`](./plan.md)
→ Roadmap slice: S-02 in `context/foundation/roadmap.md`
→ PRD refs: FR-002, FR-004, FR-005 in `context/discovery/discovery-notes.md`
→ Prerequisite: `dnd-context-wiring` (F-01, done)
→ Sibling slice: S-01 `drag-allocation-move` (already implemented — shares the
  same `DndContext`/sensor and block component)

## What & why

A Planner can grab the left or right edge of an Allocation block and drag it to
change the Allocation's duration. The grabbed edge's date changes; the
opposite edge stays fixed. The Allocation can never be inverted or made
shorter than one day. On drop, the changed date snaps to a whole-day boundary,
persists, and the person's utilization recomputes. This completes the pair of
core direct-manipulation gestures (move + resize) that the roadmap's north
star introduced with S-01.

## Starting point

- `src/components/timeline/Timeline.tsx` — S-01 already added a `DndContext` +
  `PointerSensor` (5 px activation distance), a `DraggableAllocBlock`
  component (`Timeline.tsx:98–154`) whose whole body is a dnd-kit draggable
  (drives move), and a `handleDragEnd` (`Timeline.tsx:215–240`) that currently
  assumes every drag is a move (shifts both dates by the same offset).
- `getAllocationStyle` (`src/lib/utils.ts:23–45`) derives each block's pixel
  geometry from its dates — no changes needed; the block will reposition
  automatically once new dates come back through `onRefresh`.
- ISO `'yyyy-MM-dd'` date strings already compare correctly with `<`/`>` in
  this codebase (used in lane assignment) — no new date-math imports needed.
- No automated test suite; `pnpm build` is the only automated gate.

## Desired end state

Each block gets an 8 px grab zone on its left and right edges (in addition to
the existing full-body move-drag). Dragging the right edge changes only
`end_date`; dragging the left edge changes only `start_date`. Duration can
shrink to one day minimum but never invert. On drop, the one changed field is
persisted and `onRefresh()` runs. Move (S-01), click-to-edit, background pan,
lane stacking, and utilization are all unaffected.

## Key decisions made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Resize handle drag-id scheme | Prefixed ids: `resize-left-<id>` / `resize-right-<id>`; the block's own move id stays unprefixed | Lets `handleDragEnd` branch cleanly without touching the working S-01 move code path | Plan |
| Preventing double drag-activation | Edge handle wraps `listeners.onPointerDown` with `event.stopPropagation()` before calling it | Handle is nested inside the block's own draggable DOM node; without stopping propagation, one gesture could try to activate both the block's move-drag and the handle's resize-drag | Plan |
| Click-on-edge-zone behavior | No special-casing — a plain click still bubbles to the block's `onClick` and opens the modal | `stopPropagation` is only applied to `pointerdown`, not the native `click` event; matches "click anywhere on the block opens the modal" guardrail | Plan |
| Edge hit-target width | 8 px | Roadmap left this as an implementer default (non-blocking); narrow enough to leave a single-day (44 px) block's middle clickable/movable, wide enough to grab reliably | Plan (resolves roadmap Unknown) |
| Clamping (no invert / min 1 day) | String-compare ISO dates; clamp the grabbed edge against the fixed opposite edge (`newEnd = max(newEnd, start)`, `newStart = min(newStart, end)`) | Enforces the DB's `end_date >= start_date` constraint client-side; ISO date strings already compare correctly elsewhere in this file | Research |
| What gets written | Only the one changed date field (`end_date` or `start_date`), not both | A resize by definition holds the opposite edge fixed; matches PRD FR-002 | PRD |
| Live preview during drag | None — block resizes visually only after drop + refetch | Consistent with S-01's no-optimistic-update choice; live preview is explicitly deferred to S-03 (`drag-live-preview`) | Roadmap (S-03 scope) |

## Scope

**In:**
- Two additional `useDraggable` calls per block (left/right edge handles) in
  `DraggableAllocBlock` (`Timeline.tsx`)
- `ew-resize` cursor affordance on each handle
- `handleDragEnd` branch: resize (single-field, clamped) vs. existing move
- Reuse of the existing `dragError` state for resize write failures

**Out:**
- Live ghost/preview during resize — S-03
- Cross-row (person reassignment) drag — later increment
- Optimistic update — refetch is sufficient at this scale (matches S-01)
- Touch/tablet sensors
- Resize affordance on time-off blocks
- Changes to `TimelineClient.tsx`, `AllocationModal`, schema, or RLS

## Architecture / Approach

Single-file change: `src/components/timeline/Timeline.tsx`. Add two edge-handle
sub-elements inside `DraggableAllocBlock`, each with its own `useDraggable`
call using a prefixed id. Extend `handleDragEnd` to branch on the id prefix:
resize ids resolve to a single clamped date update; anything else falls
through to the existing move logic untouched.

## Phases at a glance

| Phase | Delivers | Key risk |
|---|---|---|
| 1 — Edge handles + resize branch in drag-end | Both edges independently resizable, clamped, persisted | Nested draggables double-activating on one pointer-down — mitigated by `stopPropagation` on the handle's `onPointerDown` |

**Prerequisites:** F-01 (`dnd-context-wiring`, done). Parallel with S-01
(already implemented) — this slice only adds to the same file, doesn't modify
S-01's move code path.

## Open risks & assumptions

- **Edge zone discoverability vs. block-body click**: 8 px is a reasonable
  default per the roadmap's own framing of this as a non-blocking unknown;
  may need visual tuning (width, hover affordance) after real usage.
- **Nested draggable pointer conflict**: mitigated via `stopPropagation` on the
  handle's `onPointerDown`; must be confirmed manually that a resize drag
  never also nudges the block via the move handler.
- **Very short (1-day) blocks**: at `DAY_WIDTH = 44px`, two 8px edge zones
  leave a 28px movable middle — expected to be enough, but worth a manual
  check on the narrowest real allocations.
- **No tests**: `pnpm build` is the only automated gate; all behavioral
  verification is manual.

## Success criteria (summary)

- `pnpm build` passes with no new TypeScript or ESLint errors.
- Each edge, dragged independently, changes only its own date, snapped to a
  whole day, with the opposite edge fixed.
- Duration can shrink to one day but never inverts; persists across reload;
  utilization bar updates.
- Click-to-edit, drag-to-move, background pan, lane stacking, filters, and
  time-off rendering are all unaffected.
- No `@dnd-kit` console errors during normal use.
