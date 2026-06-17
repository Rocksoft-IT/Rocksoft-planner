---
project: Drag and drop reallocation on the timeline
version: 1
status: draft
created: 2026-06-16
context_type: brownfield
product_type: web-app
target_scale:
  users: small
---

# PRD: Drag and drop reallocation on the timeline

## Current System Overview

RS Planner is an internal web application for planning team capacity. Its core
screen is the Timeline: a horizontally scrollable grid with people as rows and
days as columns (a fixed range from approximately 180 days in the past to 548
days forward). Each Allocation is an absolutely positioned block inside a
person's row, with horizontal position and width derived from its start and end
dates; overlapping items are stacked into lanes.

An Allocation carries: person, project, start date, end date, hours per day, a
confirmed/tentative status, and notes. Per-person utilization (allocated hours
vs. capacity) is computed and displayed as a bar.

Today, moving or rescheduling an Allocation requires clicking its block to open
the AllocationModal and changing the person and/or dates by hand. The Timeline
grid already short-circuits its background drag-to-pan gesture when the pointer
goes down on an Allocation block (elements marked `data-block`). The `@dnd-kit`
family is already a declared dependency but is not yet wired into the Timeline.

Users are managerial-level planners (project managers, managers) who own team
capacity planning.

## Problem Statement & Motivation

Rescheduling work on the Timeline is a multi-click, type-the-dates chore in a
modal. For what is conceptually a single move — "this block needs to go here" —
a Planner must open the Allocation's modal, locate the date fields, type new
values, and confirm. The friction compounds across a typical planning session
where many blocks are adjusted.

The gap between current and desired state is a missing input method: the
Timeline displays Allocation blocks as positioned objects but provides no way to
manipulate their position directly. Introducing drag-to-move and drag-to-resize
on the existing Timeline removes that friction without changing the underlying
planning model. The moment is now because the Timeline already differentiates
pointer-down on blocks vs. background, and the activation-threshold pattern to
separate click from drag is well-established in the codebase.

## User & Persona

**The Planner** — a managerial-level user (PM or manager) who plans team
capacity in RS Planner. Not a single individual; several managers use the tool.
They work in the Timeline regularly, think in terms of "this block needs to
move," and want the smallest possible gesture between intent and result.

The Planner's experience changes with this increment: a task that previously
required opening a modal and editing date fields by hand now happens through a
single direct drag gesture on the Timeline.

## Success Criteria

### Primary

A Planner can reschedule an Allocation directly on the Timeline, with no modal,
via two pointer gestures within the same person's row:

- **Move** — grab the body of an Allocation block and drag it left/right; both
  start and end dates shift by the same number of days, duration unchanged.
- **Resize** — grab the left or right edge of a block and drag; the grabbed
  edge changes its date (start or end) while the opposite edge stays put,
  changing the duration.

On drop, the block snaps to day boundaries, the change persists to the
database, and the affected person's utilization recomputes. Person, project,
hours-per-day, status, and notes are untouched by either gesture.

### Secondary

Move an Allocation to a **different person** by dragging its block to another
row (changes `person_id`). Deferred to a later increment — same
direct-manipulation idea, one extra dimension.

### Guardrails

All existing Timeline behavior must survive intact (hard guardrail):

- Background drag-to-pan continues to scroll the time axis.
- Click-on-block continues to open the AllocationModal for field-level editing.
- Click-on-empty-cell continues to create a new Allocation.
- Lane stacking of overlapping Allocation blocks remains correct.
- Filters, utilization bars, and time-off rendering remain unchanged.

Click vs. drag must stay distinguishable: a small pointer movement is still a
click (opens the modal); only movement past the activation threshold starts a
move or resize.

## User Stories

### US-01: Reschedule an allocation by dragging

- **Given** a Planner is viewing the Timeline with an existing Allocation block,
- **When** they grab the block body and drag it three days to the right and
  drop,
- **Then** the Allocation's start and end dates both shift three days later, the
  duration is unchanged, the block snaps to the day grid, the new dates are
  saved, and the person's utilization bar updates — all without opening the
  modal.

#### Acceptance Criteria

- Start date and end date each advance by exactly three days; duration is
  unchanged.
- The block snaps to whole-day boundaries after drop.
- The new dates are persisted; a page reload shows the updated Allocation.
- The AllocationModal does not open during or after the drag.
- The person's utilization bar reflects the new date range after drop.

## Scope of Change

- [new] A Planner can move an Allocation along the time axis by dragging the
  body of its block left/right within the same person's row; both start and end
  dates shift by the same number of days, duration unchanged. (FR-001,
  must-have)
- [new] A Planner can lengthen or shorten an Allocation by dragging its left
  edge (adjusts start date) or right edge (adjusts end date); the opposite edge
  stays fixed. (FR-002, must-have)
  > Challenge: No counterargument; kept as written.
- [new] While dragging (move or resize), the Planner sees a live preview of the
  block's new position/size before dropping. (FR-003, nice-to-have)
  > Challenge: Live preview adds rendering complexity for a short gesture;
  > snap-on-drop (below) may be enough. Downgraded from must-have to
  > nice-to-have — the must-have baseline is snap-on-drop; live preview is a
  > later polish item.
- [new] On drop, the block snaps to whole-day boundaries and the new dates
  persist. (FR-004, must-have)
  > Challenge: No counterargument; kept as written. Drop commits immediately
  > (no undo) and snaps to whole days (no half-day starts) — both accepted.
- [modified] After a successful move or resize, the affected person's
  utilization recomputes to reflect the new dates. Over-100% utilization after
  a move is shown (red bar), not blocked — consistent with existing behavior.
  (FR-005, must-have)
- [preserved] Existing Timeline interactions remain unchanged — background
  drag-to-pan, click-on-block opens the AllocationModal, click-on-empty-cell
  creates an Allocation, lane stacking of overlapping items, filters,
  utilization bars, and time-off rendering. (FR-006, must-have)

## Constraints & Compatibility

- **Database contract:** the `allocations` table keeps its existing shape and
  the `end_date >= start_date` check constraint. A move or resize only updates
  `start_date` / `end_date`; `person_id`, `project_id`, `hours_per_day`,
  `status`, and `notes` are not touched by the first increment.
- **Gesture separation:** the existing background drag-to-pan works by ignoring
  pointer-downs on elements marked `data-block`. The new draggable blocks must
  keep that separation so background panning still works, and must use an
  activation-distance threshold so a click still opens the AllocationModal.
- **Existing drag dependency:** `@dnd-kit` is already a declared dependency;
  this change wires it up rather than introducing a new drag library.
- **Authorization unchanged:** existing row-level-security policies (any
  authenticated user can update any Allocation) are not modified.
- **Data-flow:** the Timeline currently refetches Allocations via an
  `onRefresh` callback after edits; the new gesture must leave the displayed
  state correct after a drop (lanes, utilization, and block position all
  consistent with the saved dates), whether via optimistic update or refetch.
- **Drop is committed immediately** with no undo step (accepted in FR-004
  challenge).
- **Responsiveness:** the dragged block gives immediate visual feedback during
  the gesture, and on drop the new position/size appears without a perceptible
  wait (persistence may complete asynchronously).
- **Device support:** desktop only — mouse and trackpad. Touch and tablet input
  are not required for this increment.
- **Durability:** once a move or resize is committed, the new dates survive a
  page reload (the change is persisted, not local UI state only).

## Business Logic Changes

No new domain logic. The existing domain rule — per-person utilization
(allocated hours-per-day across overlapping Allocations vs. the person's daily
capacity, with over-capacity surfaced visually) — is unchanged. Drag-to-move
and drag-to-resize are a new input method for editing an Allocation's dates;
they do not introduce a new decision the system makes for the user.

The only new rules are the mechanical invariants the gesture must enforce as it
edits dates:

- Dates snap to whole-day boundaries (the Timeline's column granularity is one
  day; there are no sub-day Allocations).
- An Allocation can never be inverted or zero-length: end date must stay on or
  after start date, with a minimum duration of one day. This upholds the
  existing database constraint `end_date >= start_date`.
- A move shifts both dates by the same offset (duration invariant); a resize
  moves only the grabbed edge (the opposite edge is invariant).
- Over-capacity that results from a move or resize is shown, not blocked —
  consistent with how the tool already treats overbooking.

## Access Control Changes

No access control changes — existing model preserved. Authentication and
authorization for Allocations are unchanged: any authenticated user can read
and write any Allocation under the existing policies, and drag-to-move
Reallocation deliberately keeps this model, matching how the existing
modal-based edit behaves. Restricting Reallocation to a manager or admin role
is explicitly out of scope for this change.

## Non-Goals

- **Dragging an Allocation to a different person** — captured as Secondary
  (Success Criteria); the first increment stays within one person's row.
- **Touch / tablet support** — desktop mouse and trackpad only for this
  increment.
- **Undo / redo of a move or resize** — drop commits immediately; reverting is
  done by dragging back or editing in the AllocationModal.
- **Dragging multiple Allocations at once** — one block per gesture.
- **Half-day or sub-day granularity** — the grid and the gesture stay at
  whole-day resolution.
- **Blocking moves that exceed capacity** — over-capacity is shown (red bar),
  not prevented; consistent with current behavior.

## Open Questions

No open questions at this time. All required fields and sections are filled from
the discovery notes.
