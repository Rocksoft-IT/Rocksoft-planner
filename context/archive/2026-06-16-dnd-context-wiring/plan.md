# dnd-context-wiring — Implementation Plan

## Overview

This change wires `@dnd-kit/core`'s `DndContext` provider into the Timeline
component and configures a `PointerSensor` with an activation-distance threshold
that keeps a short pointer movement a click (opens AllocationModal) while a
longer movement starts a drag. No gesture logic is introduced yet — this is the
minimal enabling layer that all downstream gesture slices (`drag-allocation-move`,
`drag-allocation-resize`) depend on. Existing Timeline behavior — background
drag-to-pan, click-on-block, click-on-empty-cell — must remain unchanged.

## Current State Analysis

The Timeline is rendered as a single large React component at
`src/components/timeline/Timeline.tsx` (the "Timeline root"). It is mounted via
a thin client shell at
`src/app/(dashboard)/timeline/TimelineClient.tsx` that owns the data-fetch
refresh loop.

Key facts about the current code:

- **Background drag-to-pan** (`Timeline.tsx:133–151`): `handleMouseDown`
  short-circuits when `(e.target as HTMLElement).closest('[data-block]')` is
  truthy — any element with the `data-block` attribute is already excluded from
  panning. This is the gesture-separation hook already in place.
- **Allocation block render** (`Timeline.tsx:460–498`): each allocation block
  carries `data-block` on its outer div and calls `onClick` to open
  `AllocationModal` if `!didDrag.current`. Time-off blocks (`Timeline.tsx:428–447`)
  do the same.
- **`@dnd-kit` dependency** (`package.json:13–15`): `@dnd-kit/core ^6.3.1`,
  `@dnd-kit/sortable ^10.0.0`, and `@dnd-kit/utilities ^3.2.2` are already
  declared but not imported anywhere in the codebase.
- **`didDrag.current` ref** (`Timeline.tsx:113`): already used by the pan gesture
  to distinguish click from drag for day-cell clicks; the same pattern must
  coexist with dnd-kit's sensor threshold for block clicks.
- **`onRefresh` callback** (`Timeline.tsx:78`, `TimelineClient.tsx:21–29`):
  post-edit data reload is already wired; gesture slices will use this.

No existing file uses `DndContext`, `useSensor`, `useSensors`, or
`PointerSensor` from `@dnd-kit/core`.

## Desired End State

When this change ships:

- `DndContext` wraps the Timeline grid area (or the full Timeline component) so
  that child `useDraggable` hooks can register with it.
- A `PointerSensor` is configured with `activationConstraint: { distance: N }`
  where N is the threshold in pixels that separates a click from a drag
  (recommended: 5 px, matching the existing pan threshold of 3 px in spirit but
  slightly larger so a click-on-block never starts a drag accidentally).
- The `onDragStart`, `onDragEnd`, and `onDragCancel` handler props on `DndContext`
  exist and are empty stubs (they will be filled in by S-01 and S-02).
- The background drag-to-pan (`handleMouseDown` / `handleMouseMove` /
  `handleMouseUp`) still works — the `data-block` short-circuit already excludes
  allocation blocks from pan, and dnd-kit's pointer sensor will claim those
  pointer events on blocks instead.
- Click-on-block still opens `AllocationModal` because the activation distance
  threshold means a tap (no or tiny movement) never fires `onDragStart`.
- Click-on-empty-cell, lane stacking, filters, utilization bars, and time-off
  rendering are all untouched.
- There is no visual change to the UI whatsoever.

### Key discoveries

- `src/components/timeline/Timeline.tsx:133–134` — `handleMouseDown` already
  calls `e.closest('[data-block]')` to skip pan on blocks; the `data-block`
  attribute is on the allocation block div at line 462 and the time-off block
  div at line 433.
- `src/components/timeline/Timeline.tsx:110–113` — `isDragging`, `dragStartX`,
  `dragStartScrollLeft`, `didDrag` are `useRef` state for the pan gesture; they
  are unaffected by the dnd-kit context.
- `package.json:13` — `@dnd-kit/core ^6.3.1` is already installed; no `npm
  install` needed.
- `src/components/timeline/Timeline.tsx:81` — `Timeline` is the single export;
  wrapping `DndContext` inside this component keeps the provider co-located with
  the grid, avoiding prop-drilling through `TimelineClient`.
- `src/components/timeline/Timeline.tsx:464` — `onClick` on allocation blocks
  uses `if (!didDrag.current) openEdit(item)` — this guard protects against the
  pan gesture, not against dnd-kit; the activation-distance threshold on
  `PointerSensor` is what protects against accidental drag-on-click for block
  interactions.

## What we're NOT doing

- No draggable allocation blocks yet (that is S-01 and S-02).
- No drag event handlers with real logic (stubs only).
- No live preview, ghost overlay, or drop zones.
- No changes to `TimelineClient.tsx`, `AllocationModal`, or any data layer.
- No changes to the `data-block` attribute pattern or the pan gesture logic.
- No touch/tablet sensor configuration.
- No cross-row drag support.

## Implementation Approach

Wrap the Timeline component's JSX return in a `DndContext` from `@dnd-kit/core`,
and configure a `PointerSensor` via `useSensors`/`useSensor` with an
`activationConstraint: { distance: 5 }`.

This is the only sensible approach: `DndContext` must be an ancestor of any
`useDraggable` call, and those calls will live inside the allocation block render
(S-01/S-02). Placing `DndContext` inside `Timeline.tsx` keeps the provider
physically adjacent to the draggable children without requiring any prop change
to `TimelineClient`. An alternative of placing `DndContext` in
`TimelineClient.tsx` was considered but rejected — it would expose dnd-kit's
event handlers as props and create unnecessary coupling between the data shell
and the gesture layer.

The activation distance of 5 px is chosen to be:
- Greater than the pan gesture's implicit threshold (3 px movement sets
  `didDrag.current = true` at `Timeline.tsx:145`), so a block-click never
  accidentally starts a dnd-kit drag.
- Small enough that a deliberate move gesture begins responsively.

## Phase 1: Wire DndContext into Timeline

### Overview

Add `DndContext` + `PointerSensor` imports to `Timeline.tsx`, configure the
sensor with an activation-distance constraint, and wrap the component's return
value. Empty `onDragStart`, `onDragEnd`, `onDragCancel` stubs are provided so
downstream slices have a clear integration point.

### Required changes

#### 1. `Timeline.tsx` — DndContext wiring

- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: Import `DndContext`, `PointerSensor`, `useSensor`, `useSensors` from
  `@dnd-kit/core`. Inside the `Timeline` function, call `useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))` to create the sensor config. Return the existing JSX wrapped in `<DndContext sensors={sensors} onDragStart={() => {}} onDragEnd={() => {}} onDragCancel={() => {}}>`…`</DndContext>`. No other logic changes.
- **Contract**: `Timeline` component signature is unchanged (`TimelineProps` — same
  props, no new props). `DndContext` is the outermost element in the returned
  JSX. The `sensors` variable is local to the component. Handler stubs accept
  the standard dnd-kit event types (`DragStartEvent`, `DragEndEvent`,
  `DragCancelEvent`) so S-01/S-02 can replace them with typed handlers without
  a signature change.

### Success criteria

#### Automated
- `pnpm build` (or `next build`) completes with no TypeScript errors and no
  ESLint errors introduced by this change.
- No existing test suite failures (the project has no automated tests at this
  time, so this criterion is satisfied by the build passing).

#### Manual
- Open the Timeline in the browser; all existing interactions work exactly as
  before: background drag-to-pan scrolls the grid, click-on-block opens
  AllocationModal, click-on-empty-cell opens the create modal, filters work,
  utilization bars render correctly.
- No console errors related to `@dnd-kit` during normal use.
- Verify in React DevTools that `DndContext` appears as an ancestor of the
  Timeline content tree.

## Testing Strategy

No new unit tests are introduced for this wiring change — there is no new
observable behavior to test. The success criteria are: the build passes
(TypeScript + ESLint) and all existing manual interactions are unaffected.

Once S-01/S-02 introduce `useDraggable` hooks, those phases will carry the
drag-event integration tests.

## Migration Notes

No schema or data changes. No migration required.

## References

- Roadmap slice F-01 (`context/foundation/roadmap.md`, F-01 block)
- PRD FR-006 (`context/prd/prd.md`)
- Timeline root: `src/components/timeline/Timeline.tsx`
- Timeline client shell: `src/app/(dashboard)/timeline/TimelineClient.tsx`
- @dnd-kit/core docs: https://docs.dndkit.com/api-documentation/context-provider
- Unlocks: `drag-allocation-move` (S-01), `drag-allocation-resize` (S-02)

## Progress

### Phase 1: Wire DndContext into Timeline
#### Automated
- [ ] 1.1 `pnpm build` completes with no TypeScript errors and no ESLint errors introduced by this change
#### Manual
- [ ] 1.2 All existing Timeline interactions work exactly as before (pan, click-on-block, click-on-empty-cell, filters, utilization bars)
- [ ] 1.3 No console errors related to `@dnd-kit` during normal use
- [ ] 1.4 React DevTools shows `DndContext` as an ancestor of the Timeline content tree
