---
project: Drag and drop reallocation on the timeline
client: wojciech.drozdzik@rocksoft.pl
repository:
  name: RS Planner
  git_url: git@github.com:Rocksoft-IT/Rocksoft-planner.git
context_type: brownfield
created: 2026-06-15
updated: 2026-06-15
product_type: web-app
target_scale:
  users: small
estimated_effort: unknown
checkpoint:
  current_phase: 7
  phases_completed: [1, 2, 3, 4, 5, 6]
  frs-drafted: 6
  quality_check_status: accepted
---

# Discovery notes: Drag and drop reallocation on the timeline

## Current System

RS Planner is an internal web app for planning team capacity. It is built on
Next.js (App Router) + React with Supabase (Postgres, Auth, row-level security)
as the backend, styled with Tailwind, using date-fns for date math and Radix UI
primitives. The core screen is the Timeline: a horizontally scrollable grid with
people as rows and days as columns (fixed range from ~180 days back to ~548 days
forward). Each allocation is an absolutely positioned block inside a person's
row, with horizontal position and width derived from its start/end dates;
overlapping items are stacked into lanes. An allocation carries person, project,
start date, end date, hours per day, a confirmed/tentative status, and notes.
Per-person utilization (allocated vs. capacity) is computed and shown as a bar.

Today an allocation is moved or rescheduled by clicking its block to open a modal
(AllocationModal) and changing the person and/or dates by hand. The grid uses a
mouse "drag-to-pan" gesture to scroll the time axis; that gesture already
short-circuits when the pointer goes down on an allocation block (the code skips
panning for elements marked `data-block`). The `@dnd-kit` family is already a
declared dependency but is not used anywhere yet.

Users: managerial-level planners (project managers, managers). The pain driving
this change: rescheduling work is a multi-click, type-the-dates chore in a modal
when it could be a single direct gesture.

## Vision & Problem

This is a delta on the existing Timeline, not a new product. Today, moving an
allocation in time (or to another person) means opening the allocation's modal
and editing fields. The change introduces direct manipulation: a planner grabs an
allocation block and drags it to a new position on the Timeline to reschedule it,
without opening the detail modal. The value is speed and flow for the planner;
the cost it removes is the friction of extra clicks and manual date entry for what
is conceptually a single move.

## User & Persona

Primary persona: the **Planner** — a managerial-level user (PM or manager) who
owns team capacity planning. Not a single individual: several managers use the
tool. They work in the Timeline regularly, think in terms of "this block needs to
move," and want the smallest possible gesture between intent and result.

## Access Control

No change planned — existing model preserved. Authentication is Supabase Auth
(email/password, with a Microsoft SSO spec in the repo). Authorization for
allocations is currently open: any authenticated user can read and write any
allocation under the existing row-level-security policies, and the `is_admin`
flag does not gate allocation edits. Drag-to-move reallocation deliberately keeps
this model — it is available to any authenticated user, matching how the existing
modal-based edit already behaves. Restricting reallocation to a manager/admin role
is explicitly out of scope for this change.

## Success Criteria

### Primary
A planner can reschedule an allocation directly on the Timeline, with no modal,
via two pointer gestures within the same person's row:
- **Move** — grab the body of an allocation block and drag it left/right; both
  start and end dates shift by the same number of days, duration unchanged.
- **Resize** — grab the left or right edge of a block and drag; the grabbed edge
  changes its date (start or end) while the opposite edge stays put, changing the
  duration.
On drop, the block snaps to day boundaries, the change persists to the database,
and the affected person's utilization recomputes. Person, project, hours-per-day,
status, and notes are untouched by either gesture.

### Secondary
Move an allocation to a **different person** by dragging its block to another
row (changes `person_id`). Deferred to a later increment — same direct-manipulation
idea, one extra dimension.

### Guardrails
- **All existing behavior survives intact** (hard guardrail, user's words): the
  drag-to-pan background scroll, click-on-block to open the edit modal, click on
  an empty cell to create an allocation, correct lane stacking of overlapping
  items, filters, utilization bars, and time-off rendering must all keep working
  unchanged. The new gestures are additive and must not regress any of these.
- Click vs. drag must stay distinguishable: a small pointer movement is still a
  click (opens the modal); only movement past the activation threshold starts a
  move/resize.

## Functional Requirements

- FR-001: A Planner can move an allocation along the time axis by dragging the
  body of its block left/right within the same person's row; both start and end
  dates shift by the same number of days, duration unchanged. Priority: must-have. Change: new
  > Challenge: No counterargument; kept as written.
- FR-002: A Planner can lengthen or shorten an allocation by dragging its left
  edge (adjusts start date) or right edge (adjusts end date); the opposite edge
  stays fixed. Priority: must-have. Change: new
  > Challenge: No counterargument; kept as written.
- FR-003: While dragging (move or resize), the Planner sees a live preview of the
  block's new position/size before dropping. Priority: nice-to-have. Change: new
  > Challenge: Live preview adds rendering complexity for a short gesture;
  > snap-on-drop (FR-004) may be enough. Downgraded from must-have to nice-to-have
  > — the must-have baseline is snap-on-drop; live preview is a later polish item.
- FR-004: On drop, the block snaps to whole-day boundaries and the new dates
  persist to the database. Priority: must-have. Change: new
  > Challenge: No counterargument; kept as written. Drop commits immediately
  > (no undo) and snaps to whole days (no half-day starts) — both accepted.
- FR-005: After a successful move or resize, the affected person's utilization
  recomputes to reflect the new dates. Priority: must-have. Change: modified
  > Challenge: No counterargument; kept as written. Over-100% utilization after a
  > move is shown (red bar), not blocked — consistent with existing behavior.
- FR-006: Existing Timeline interactions remain unchanged — background
  drag-to-pan, click-on-block opens the edit modal, click-on-empty-cell creates an
  allocation, lane stacking of overlapping items, filters, utilization bars, and
  time-off rendering. Priority: must-have. Change: preserved
  > Challenge: No counterargument; kept as written.

## User Stories

### US-01: Reschedule an allocation by dragging
- **Given** a Planner is viewing the Timeline with an existing allocation block,
- **When** they grab the block body and drag it three days to the right and drop,
- **Then** the allocation's start and end dates both shift three days later, the
  duration is unchanged, the block snaps to the day grid, the new dates are saved,
  and the person's utilization bar updates — all without opening the modal.

## Business Logic

No new domain logic change. The existing domain rule — per-person utilization
(allocated hours-per-day across overlapping allocations vs. the person's daily
capacity, with over-capacity surfaced as a red bar) — is unchanged. Drag-to-move
and drag-to-resize are a new *input method* for editing an allocation's dates;
they do not introduce a new decision the app makes for the user.

The only new rules are the mechanical invariants the gesture must enforce as it
edits dates:
- Dates snap to whole-day boundaries (the Timeline's column granularity is one
  day; there are no sub-day allocations).
- An allocation can never be inverted or zero-length: end date must stay on or
  after start date, with a minimum duration of one day. This upholds the existing
  database constraint `end_date >= start_date`.
- A move shifts both dates by the same offset (duration invariant); a resize moves
  only the grabbed edge (the opposite edge is invariant).
- Over-capacity that results from a move/resize is shown, not blocked — consistent
  with how the tool already treats overbooking.

## Constraints & Preserved Behavior

- **Database contract:** the `allocations` table keeps its existing shape and the
  `end_date >= start_date` check constraint. A move/resize only updates
  `start_date` / `end_date`; `person_id`, `project_id`, `hours_per_day`, `status`,
  and `notes` are not touched by the first increment.
- **Gesture separation must be preserved:** the existing drag-to-pan scroll works
  by ignoring pointer-downs on elements marked `data-block`. The new draggable
  blocks must keep that separation so background panning still works, and must use
  an activation-distance threshold so a click still opens the edit modal (FR-006).
- **Reuse the existing dependency:** `@dnd-kit` is already declared in
  `package.json`; this change wires it up rather than adding a new drag library.
- **Authorization unchanged:** existing row-level-security policies (any
  authenticated user can update any allocation) are not modified.
- **Data-flow:** the Timeline currently refetches allocations via an `onRefresh`
  callback after edits; the new gesture must leave the displayed state correct
  after a drop (lanes, utilization, and block position all consistent with the
  saved dates), whether via optimistic update or refetch.
- **Drop is committed immediately** with no undo step (accepted in the FR-004
  challenge).

## Non-Functional Requirements

- **Responsiveness:** the dragged block gives immediate visual feedback during the
  gesture, and on drop the new position/size appears without a perceptible wait
  (persistence may complete asynchronously).
- **Device support:** desktop only — mouse and trackpad. Touch / tablet input is
  not required for this increment.
- **Durability:** once a move or resize is committed, the new dates survive a page
  reload (the change is persisted, not just local UI state).

## Non-Goals

- **Dragging an allocation to a different person** — captured as Secondary, a
  later increment; the first increment stays within one person's row.
- **Touch / tablet support** — desktop mouse/trackpad only for now (see NFRs).
- **Undo / redo of a move or resize** — drop commits immediately; reverting is
  done by dragging back or editing in the modal.
- **Dragging multiple allocations at once** — one block per gesture.
- **Half-day or sub-day granularity** — the grid and the gesture stay at
  whole-day resolution.
- **Blocking moves that exceed capacity** — over-capacity is shown (red bar), not
  prevented; consistent with current behavior.

## Glossary

### Allocation
A planned assignment of one person to one project for a date range, at a given
hours-per-day, with a confirmed or tentative status. Rendered on the Timeline as
a block.
- Avoid: "booking", "assignment" (use "allocation" consistently).

### Allocation block
The visual rectangle representing an Allocation on the Timeline grid. The object a
planner grabs when dragging.

### Reallocation (drag-to-move)
Changing an existing Allocation's position on the Timeline by dragging its block —
shifting it in time and/or moving it to another person's row — as opposed to
editing fields in the modal.
- Original term (PL): "przerzucanie alokacji".

### Planner
The managerial-level user (PM/manager) who plans team capacity in RS Planner.

## Decisions

No ADRs recorded for this discovery. The gesture-arbitration approach
(block = drag, background = pan, activation-distance threshold separating click
from drag) is documented under Constraints & Preserved Behavior rather than as a
formal decision record.
