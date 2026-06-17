# drag-allocation-move — Plan Brief

→ Full plan: [`plan.md`](./plan.md)
→ Roadmap slice: S-01 in `context/foundation/roadmap.md`
→ PRD refs: FR-001, FR-004, FR-005, US-01 in `context/prd/prd.md`
→ Prerequisite: `context/changes/dnd-context-wiring/plan.md` (F-01)

## What & why

A Planner can grab the body of an Allocation block and drag it left or right to
shift both its start and end dates by the same number of days (duration stays the
same). On drop, the block snaps to a whole-day boundary, the new dates persist to
the database, and the person's utilization bar recomputes. The modal never opens
during or after the drag. This is the north-star slice: it delivers the highest
value (direct manipulation of the core planning object) and de-risks gesture
arbitration end-to-end.

## Starting point

- `src/components/timeline/Timeline.tsx` — 535-line component owning all Timeline
  rendering, pan gesture, click handlers, and modal state. Allocation blocks are
  rendered at lines 461–498 with `data-block` on the outer div.
- `@dnd-kit/core ^6.3.1` and `@dnd-kit/utilities ^3.2.2` are installed but not
  yet imported in Timeline.
- F-01 (`dnd-context-wiring`) must be merged first; it wraps the Timeline JSX in
  `DndContext` + `PointerSensor` (activation distance 5 px) and leaves typed
  `onDragStart`/`onDragEnd`/`onDragCancel` stubs.
- Date math (`addDays`, `differenceInCalendarDays`) already imported from
  `date-fns ^4.2.1`.
- Post-mutation data flow: `onRefresh` prop (`TimelineClient.tsx:21–29`) refetches
  all allocations and drives a re-render.
- No automated test suite; `pnpm build` is the only automated gate.

## Desired end state

Every Allocation block body is a dnd-kit draggable. Dragging produces a visual
translate. On drop: day offset = `Math.round(delta.x / DAY_WIDTH)`, both dates
shift by that offset, Supabase update fires (`start_date` + `end_date` only),
`onRefresh` is called. Block settles at the new position with correct lanes and
utilization. Clicks under 5 px still open the modal. Pan gesture unaffected.

## Key decisions made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Where to call `useDraggable` | Inline inside `Timeline.tsx` render loop | Keeps code shape unchanged; extracting a component is orthogonal refactor; matches F-01 single-file pattern | Plan |
| Post-drop state update | Refetch via `onRefresh` (not optimistic) | Consistent with all existing mutations in the codebase; small-team scale makes ~200ms acceptable; avoids dual-state complexity | Plan |
| Day offset formula | `Math.round(event.delta.x / DAY_WIDTH)` | `event.delta.x` is the total drag displacement — dnd-kit provides it directly; `DAY_WIDTH` is the existing pixel-per-day constant | Research |
| Date format for update | `formatDate()` from `utils.ts` → `'yyyy-MM-dd'` | Matches the DB column type and the existing modal update payload | Research |
| Click-vs-drag guard | F-01's 5 px activation distance (primary); verify dnd-kit pointer capture suppresses `onClick` after drag | dnd-kit claims pointer events once activation fires; `onClick` should not fire; manual check confirms | Plan + PRD FR-006 |
| Which fields to update | `start_date` + `end_date` only | All other fields (`person_id`, `project_id`, `hours_per_day`, `status`, `notes`) are invariant for a move | PRD FR-001 |

## Scope

**In:**
- `useDraggable` on allocation block outer divs (`Timeline.tsx`)
- CSS `transform` on dragged block (visual feedback during drag)
- `onDragEnd` handler: compute day offset, update Supabase, call `onRefresh`
- Import `useDraggable`, `DragEndEvent` from `@dnd-kit/core`; `CSS` from `@dnd-kit/utilities`

**Out:**
- Edge handle drag-to-resize — S-02
- Live ghost/preview during drag — S-03
- Cross-row (person reassignment) drag — later increment
- Optimistic update — refetch is sufficient at this scale
- Undo/redo
- Touch/tablet sensors
- Changes to `TimelineClient.tsx`, `AllocationModal`, schema, or RLS
- Time-off block draggability

## Architecture / Approach

Single-file change: `src/components/timeline/Timeline.tsx`. Inside the allocation
block render loop, call `useDraggable({ id: String(item.id) })` to get
`attributes`, `listeners`, and `transform`. Spread `attributes` and `listeners`
onto the outer block div, add `transform: CSS.Transform.toString(transform)` to
its inline style (no-op when `transform` is null). Replace the empty `onDragEnd`
stub from F-01 with an async handler that reads `event.active.id` and
`event.delta.x`, computes and applies the offset, persists, and refreshes.

## Phases at a glance

| Phase | Delivers | Key risk |
|---|---|---|
| 1 — Draggable blocks + drag-end handler | All allocation blocks draggable; move gesture persists and refreshes | Post-drag `onClick` fires modal if dnd-kit doesn't fully suppress it — mitigated: dnd-kit claims pointer events once activation fires; manual check confirms |

**Prerequisites:** F-01 (`dnd-context-wiring`) merged — provides `DndContext`
ancestor and typed handler stubs.

## Open risks & assumptions

- **Post-drag click bleed-through**: If dnd-kit doesn't fully capture pointer
  events after a drag, the `onClick` handler fires and opens the modal. Expected
  to be handled by dnd-kit's pointer capture; must be confirmed manually. If
  needed, add an `isDragging` ref set in `onDragStart` and cleared in `onDragEnd`
  to gate the `onClick`.
- **`DAY_WIDTH` constant**: Assumed to be a named constant already in
  `Timeline.tsx` (used for layout calculations). If it is inlined as a literal,
  extract to a `const` before using it in the offset formula.
- **`@dnd-kit/utilities` import**: The `CSS` helper is in `@dnd-kit/utilities
  ^3.2.2`, which is already installed. The transform style is optional — if the
  plan is to have no visual feedback during drag (block stays in place), the
  `transform` application can be deferred; but basic visual feedback is expected
  for usability.
- **No tests**: `pnpm build` is the only automated gate. All behavioral
  verification is manual.

## Success criteria (summary)

- `pnpm build` passes with no new TypeScript or ESLint errors.
- Dragging a block moves it by the correct number of days; duration unchanged;
  page reload confirms persistence.
- Click on block (< 5 px movement) still opens `AllocationModal`.
- Background pan, lane stacking, filters, utilization bars, and time-off
  rendering are all unaffected.
- No `@dnd-kit` console errors during normal use.
