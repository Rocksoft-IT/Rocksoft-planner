# dnd-context-wiring — Plan Brief

→ Full plan: [`plan.md`](./plan.md)
→ Roadmap slice: F-01 in `context/foundation/roadmap.md`
→ PRD refs: FR-006 in `context/prd/prd.md`

## What & why

Wire `@dnd-kit/core`'s `DndContext` provider into the Timeline component and
configure a `PointerSensor` with an activation-distance threshold. This is the
smallest enabling step for all drag gestures: without a `DndContext` ancestor,
no `useDraggable` call (needed by S-01 and S-02) can register. No visible
behavior changes for the Planner — the entire value of this slice is unlocking
the two gesture slices that follow.

## Starting point

- `src/components/timeline/Timeline.tsx` — single 535-line React component
  rendering the full Timeline grid with pan, click, filter, and utilization
  logic.
- `@dnd-kit/core ^6.3.1` is already in `package.json` and installed; it is not
  imported anywhere yet.
- Background drag-to-pan already short-circuits on `[data-block]` elements
  (`Timeline.tsx:134`), so the gesture-separation point is proven and in place.
- No existing tests.

## Desired end state

`DndContext` wraps the Timeline JSX return. A `PointerSensor` with
`activationConstraint: { distance: 5 }` is wired via `useSensors`. Empty handler
stubs (`onDragStart`, `onDragEnd`, `onDragCancel`) are in place for S-01/S-02 to
replace. All existing interactions are unchanged. No UI change whatsoever.

## Key decisions made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Where to place `DndContext` | Inside `Timeline.tsx` (not `TimelineClient.tsx`) | Keeps the provider co-located with future `useDraggable` calls; no prop changes needed to the client shell | Plan research |
| Activation distance | 5 px | Greater than the pan gesture's 3 px `didDrag` threshold so click-on-block never accidentally starts a dnd-kit drag; small enough for responsive drags | Plan research |
| Handler stubs | Typed empty stubs (not omitted) | S-01/S-02 replace them in-place; typed stubs enforce the dnd-kit event type contract upfront | Plan |
| Sensor type | `PointerSensor` only | Desktop-only requirement; touch sensors explicitly out of scope | PRD NFR |

## Scope

**In:**
- Add `DndContext` + `PointerSensor` wiring to `Timeline.tsx` (one file change)
- Empty drag-event handler stubs

**Out:**
- No `useDraggable` hooks on allocation blocks (S-01, S-02)
- No drag logic, no ghost preview, no drop zones
- No changes to `TimelineClient.tsx`, `AllocationModal`, data layer, or schema
- No touch/tablet sensors
- No cross-row drag

## Architecture / Approach

Single-file change: `src/components/timeline/Timeline.tsx`. Import four symbols
from `@dnd-kit/core` (`DndContext`, `PointerSensor`, `useSensor`, `useSensors`),
call `useSensors(useSensor(...))` inside the component body, wrap the existing
JSX return in `<DndContext sensors={sensors} ...>`. The `TimelineProps` interface
and all other component logic are untouched.

## Phases at a glance

| Phase | Delivers | Key risk |
|---|---|---|
| 1 — Wire DndContext | `DndContext` + `PointerSensor` in `Timeline.tsx`; all existing behavior intact | Activation distance too low could cause dnd-kit to intercept block clicks (mitigated: 5 px > existing 3 px pan threshold) |

**Prerequisites:** none — this is the first slice.

## Open risks & assumptions

- **Activation distance tuning**: 5 px is the plan default. If QA finds
  click-on-block occasionally starts a drag, bump to 8 px. If drags feel
  unresponsive, reduce to 4 px. One-line change, no structural impact.
- **@dnd-kit/core version**: v6.3.1 is installed; the `PointerSensor` +
  `activationConstraint: { distance }` API has been stable since v6.0. No
  version risk.
- **No automated tests**: the project has no test suite. The only automated gate
  is `pnpm build` (TypeScript + ESLint). Manual verification covers the
  behavioral guardrails.

## Success criteria (summary)

- `pnpm build` passes with no new TypeScript or ESLint errors.
- All existing Timeline interactions are unchanged (pan, click-on-block,
  click-on-empty-cell, filters, utilization bars, time-off rendering).
- No `@dnd-kit` console errors during normal use.
- React DevTools shows `DndContext` as an ancestor of the Timeline content tree.
