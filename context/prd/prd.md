---
project: Drag and drop reallocation on the timeline
version: 1
status: draft
created: 2026-06-16
context_type: brownfield
product_type: web-app
target_scale: small
---

# PRD: Drag and drop reallocation on the timeline

## Overview

This PRD describes a delta on the existing RS Planner Timeline: introducing
direct manipulation of Allocation blocks so that a Planner can reschedule an
Allocation by dragging it — without opening the edit modal. The change is
additive; no existing Timeline behavior is removed or broken.

## Current System Overview

RS Planner is an internal web app for planning team capacity. The core screen
is the Timeline: a horizontally scrollable grid with people as rows and days as
columns (fixed range from ~180 days back to ~548 days forward). Each Allocation
is an absolutely positioned block inside a person's row, with horizontal
position and width derived from its start/end dates; overlapping items are
stacked into lanes.

An Allocation carries person, project, start date, end date, hours per day, a
confirmed/tentative status, and notes. Per-person utilization (allocated vs.
capacity) is computed and shown as a bar. Today a Planner reschedules or moves
an Allocation by clicking its block to open the AllocationModal and changing the
person and/or dates by hand. A mouse "drag-to-pan" gesture already scrolls the
time axis; this gesture already skips pointer-downs on elements marked
`data-block`. The `@dnd-kit` family is already a declared dependency but is not
wired up anywhere yet.

## Problem Statement

Rescheduling work is a multi-click, type-the-dates chore in a modal when it
could be a single direct gesture. A Planner who sees that a block needs to move
three days must: click the block, wait for the modal, edit start and end date
fields, and confirm — four or more actions for what is conceptually one move.
The change introduces direct manipulation: grab the block and drag it.

## Target Users

**Primary persona: the Planner** — a managerial-level user (PM or manager) who
owns team capacity planning. Several managers use RS Planner regularly. They
work in the Timeline continuously, think in terms of "this block needs to move,"
and want the smallest possible gesture between intent and result.

No new user segment is introduced by this change.

## Functional Requirements

- **FR-001** (must-have, new): A Planner can move an Allocation along the time
  axis by dragging the body of its Allocation block left/right within the same
  person's row; both start and end dates shift by the same number of days,
  duration unchanged.
  > Challenge: No counterargument; kept as written.

- **FR-002** (must-have, new): A Planner can lengthen or shorten an Allocation
  by dragging its left edge (adjusts start date) or right edge (adjusts end
  date); the opposite edge stays fixed.
  > Challenge: No counterargument; kept as written.

- **FR-003** (nice-to-have, new): While dragging (move or resize), the Planner
  sees a live preview of the Allocation block's new position/size before
  dropping.
  > Challenge: Live preview adds rendering complexity for a short gesture;
  > snap-on-drop (FR-004) may be enough. Downgraded from must-have to
  > nice-to-have — the must-have baseline is snap-on-drop; live preview is a
  > later polish item.

- **FR-004** (must-have, new): On drop, the Allocation block snaps to whole-day
  boundaries and the new dates persist to the database.
  > Challenge: No counterargument; kept as written. Drop commits immediately
  > (no undo) and snaps to whole days (no half-day starts) — both accepted.

- **FR-005** (must-have, modified): After a successful move or resize, the
  affected person's utilization recomputes to reflect the new dates.
  > Challenge: No counterargument; kept as written. Over-100% utilization after
  > a move is shown (red bar), not blocked — consistent with existing behavior.

- **FR-006** (must-have, preserved): Existing Timeline interactions remain
  unchanged — background drag-to-pan, click-on-block opens the edit modal,
  click-on-empty-cell creates an Allocation, lane stacking of overlapping items,
  filters, utilization bars, and time-off rendering.
  > Challenge: No counterargument; kept as written.

## User Stories

### US-01: Reschedule an Allocation by dragging

- **Given** a Planner is viewing the Timeline with an existing Allocation block,
- **When** they grab the block body and drag it three days to the right and drop,
- **Then** the Allocation's start and end dates both shift three days later, the
  duration is unchanged, the block snaps to the day grid, the new dates are
  saved, and the person's utilization bar updates — all without opening the
  modal.

## Business Logic Changes

No new domain logic change. The existing domain rule — per-person utilization
(allocated hours-per-day across overlapping Allocations vs. the person's daily
capacity, with over-capacity surfaced as a red bar) — is unchanged.
Drag-to-move and drag-to-resize are a new input method for editing an
Allocation's dates; they do not introduce a new decision the app makes for the
user.

The only new mechanical invariants the gesture must enforce as it edits dates:

- Dates snap to whole-day boundaries (the Timeline's column granularity is one
  day; there are no sub-day Allocations).
- An Allocation can never be inverted or zero-length: end date must stay on or
  after start date, with a minimum duration of one day. This upholds the
  existing database constraint `end_date >= start_date`.
- A move shifts both dates by the same offset (duration invariant); a resize
  moves only the grabbed edge (the opposite edge is invariant).
- Over-capacity that results from a move/resize is shown, not blocked —
  consistent with how the tool already treats overbooking.

## Success Criteria

### Primary

A Planner can reschedule an Allocation directly on the Timeline, with no modal,
via two pointer gestures within the same person's row:

- **Move** — grab the body of an Allocation block and drag it left/right; both
  start and end dates shift by the same number of days, duration unchanged.
- **Resize** — grab the left or right edge of an Allocation block and drag; the
  grabbed edge changes its date (start or end) while the opposite edge stays
  put, changing the duration.

On drop, the block snaps to day boundaries, the change persists to the database,
and the affected person's utilization recomputes. Person, project, hours-per-day,
status, and notes are untouched by either gesture.

### Secondary

Move an Allocation to a **different person** by dragging its block to another
row (changes the person). Deferred to a later increment — same direct-manipulation
idea, one extra dimension.

### Guardrails

- **All existing behavior survives intact** (hard guardrail): the drag-to-pan
  background scroll, click-on-block to open the edit modal, click-on-empty-cell
  to create an Allocation, correct lane stacking of overlapping items, filters,
  utilization bars, and time-off rendering must all keep working unchanged. The
  new gestures are additive and must not regress any of these.
- Click vs. drag must stay distinguishable: a small pointer movement is still a
  click (opens the modal); only movement past the activation threshold starts a
  move/resize.

## Non-Functional Requirements

- **Responsiveness:** the dragged Allocation block gives immediate visual
  feedback during the gesture, and on drop the new position/size appears without
  a perceptible wait (persistence may complete asynchronously).
- **Device support:** desktop only — mouse and trackpad. Touch/tablet input is
  not required for this increment.
- **Durability:** once a move or resize is committed, the new dates survive a
  page reload (the change is persisted, not just local UI state).

## Non-Goals

- **Dragging an Allocation to a different person** — captured as Secondary
  success criterion, deferred to a later increment; the first increment stays
  within one person's row.
- **Touch/tablet support** — desktop mouse/trackpad only for now.
- **Undo/redo of a move or resize** — drop commits immediately; reverting is
  done by dragging back or editing in the modal.
- **Dragging multiple Allocations at once** — one Allocation block per gesture.
- **Half-day or sub-day granularity** — the grid and the gesture stay at
  whole-day resolution.
- **Blocking moves that exceed capacity** — over-capacity is shown (red bar),
  not prevented; consistent with current behavior.

## Constraints & Compatibility

- **Database contract:** the `allocations` table keeps its existing shape and
  the `end_date >= start_date` check constraint. A move/resize only updates
  `start_date` / `end_date`; `person_id`, `project_id`, `hours_per_day`,
  `status`, and `notes` are not touched by the first increment.
- **Gesture separation must be preserved:** the existing drag-to-pan scroll
  works by ignoring pointer-downs on elements marked `data-block`. The new
  draggable Allocation blocks must keep that separation so background panning
  still works, and must use an activation-distance threshold so a click still
  opens the edit modal (FR-006).
- **Reuse the existing dependency:** `@dnd-kit` is already declared in
  `package.json`; this change wires it up rather than adding a new drag library.
- **Authorization unchanged:** existing row-level-security policies (any
  authenticated user can update any Allocation) are not modified. Restricting
  Reallocation to a manager/admin role is explicitly out of scope.
- **Data-flow:** the Timeline currently refetches Allocations via an
  `onRefresh` callback after edits; the new gesture must leave the displayed
  state correct after a drop (lanes, utilization, and block position all
  consistent with the saved dates), whether via optimistic update or refetch.
- **Drop is committed immediately** with no undo step.
- **No ADRs recorded** for this discovery; gesture-arbitration approach is
  documented under this section rather than as a formal decision record.

## Open Questions

No open questions — all required fields were present in the shaped input and all
sections could be filled from discovery notes.
