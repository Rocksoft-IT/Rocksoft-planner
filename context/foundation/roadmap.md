---
project: Drag and drop reallocation on the timeline
version: 1
status: active
created: 2026-06-16
updated: 2026-07-15
prd_version: 1
main_goal: speed
top_blocker: none
---

# Roadmap: Drag and drop reallocation on the timeline

## Vision recap

RS Planner is an internal capacity-planning tool where Planners manage Allocation
blocks on a Timeline grid. Today, rescheduling an Allocation requires opening a
modal and typing dates by hand — a multi-click chore for what is conceptually a
single move. This change introduces direct manipulation: a Planner grabs a block
and drags it to its new position, removing the modal entirely from the reschedule
path. The value is speed and flow; the underlying planning model is unchanged.

## North star

The **north star** is the single end-to-end gesture that proves the core
hypothesis: a Planner can grab an Allocation block on the Timeline and drag it to
a new time position without ever opening the modal. Landing this gesture
end-to-end — input captured, dates computed, persisted, utilization updated — is
the increment that delivers the most value and de-risks the largest unknown (gesture
arbitration with existing pan/click behavior).

North-star slice: **S-01** (`drag-allocation-move`) tied to US-01 and the primary
Success Criterion.

## At a glance

| ID   | Change ID                  | Outcome                                                             | Prerequisites | PRD refs                        | Status  |
|------|----------------------------|---------------------------------------------------------------------|---------------|---------------------------------|---------|
| F-01 | dnd-context-wiring         | Drag context wired; gesture arbitration established                 | —             | FR-006                          | done    |
| S-01 | drag-allocation-move       | Planner can drag an Allocation block to shift its dates (move)      | F-01          | FR-001, FR-004, FR-005, US-01   | ready   |
| S-02 | drag-allocation-resize     | Planner can drag an Allocation edge to change its duration (resize) | F-01          | FR-002, FR-004, FR-005          | ready   |
| S-03 | drag-live-preview          | Planner sees a live ghost preview while dragging                    | S-01, S-02    | FR-003                          | done    |

## Baseline

| Layer            | Status  | Evidence                                                                                    |
|------------------|---------|---------------------------------------------------------------------------------------------|
| Frontend         | present | Next.js App Router + React components in `src/app/(dashboard)/` and `src/components/`      |
| Backend/API      | absent  | No API route handlers; all data mutations via client-side calls (no blocker for this change)|
| Data             | present | Supabase PostgreSQL schema (`supabase-schema.sql`); typed client in `src/lib/supabase/`     |
| Auth             | present | Supabase Auth with email/password; dashboard protected via server-side session check        |
| Deployment/infra | partial | GitHub Actions workflow present; no Dockerfile or Vercel config — not blocking this change  |
| Observability    | absent  | No logging or error tracking — not blocking this change                                     |

## Foundations

### F-01 — dnd-context-wiring

**Outcome:** The drag-and-drop context provider is wired into the Timeline root,
and the pointer sensor is configured with an activation-distance threshold that
keeps a short pointer movement a click (opens AllocationModal) while a longer
movement starts a drag. The existing background drag-to-pan gesture — which already
skips pointer-downs on elements marked `data-block` — remains unaffected.

This is the smallest enabling contract: no gesture logic yet, just the context and
sensor that all downstream gesture slices share.

- **Change ID:** `dnd-context-wiring`
- **PRD refs:** FR-006
- **Prerequisites:** none
- **Unlocks:** S-01, S-02
- **Parallel with:** —
- **Blockers:** none
- **Unknowns:** none
- **Risk:** Activation-distance threshold tuning may need one iteration; the existing `data-block` separation already proves the arbitration point is correct.
- **Status:** done

## Slices

### S-01 — drag-allocation-move *(north star)*

**Outcome:** A Planner can grab the body of an Allocation block and drag it left or
right within the same person's row. Both start and end dates shift by the same
number of days (duration unchanged). On drop, the block snaps to whole-day
boundaries, the new dates persist, and the affected person's utilization recomputes.
No modal opens during or after the drag. Click-on-block still opens the
AllocationModal (gestures remain distinguishable via F-01's activation threshold).

- **Change ID:** `drag-allocation-move`
- **PRD refs:** FR-001, FR-004, FR-005, US-01
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** none
- **Unknowns:** Whether to use optimistic update or post-drop refetch for the displayed state — Owner: implementer — Block: no (both approaches satisfy the constraint; decision belongs to rs-plan).
- **Risk:** Duration-invariant date math must handle month/year boundaries correctly; existing date utilities cover this.
- **Status:** ready

### S-02 — drag-allocation-resize

**Outcome:** A Planner can grab the left edge or right edge of an Allocation block
and drag it to change the Allocation's duration. The grabbed edge's date changes;
the opposite edge stays fixed. The Allocation can never be inverted or zero-length
(minimum one day). On drop, the changed date snaps to a whole-day boundary, persists,
and the person's utilization recomputes.

- **Change ID:** `drag-allocation-resize`
- **PRD refs:** FR-002, FR-004, FR-005
- **Prerequisites:** F-01
- **Parallel with:** S-01 (shares F-01 foundation; independent gesture targets)
- **Blockers:** none
- **Unknowns:** Edge hit-target size (how many pixels constitute the "edge zone") — Owner: implementer — Block: no (a reasonable default can be chosen and tuned).
- **Risk:** Edge zones must be discoverable (narrow enough not to swallow the block body click, wide enough to grab reliably); may need visual affordance.
- **Status:** ready

### S-03 — drag-live-preview

**Outcome:** While a Planner is mid-drag (move or resize), a ghost or outline
preview shows where the block will land before they release the pointer. The preview
updates continuously as the pointer moves and snaps to day boundaries in real time,
giving the Planner confidence about the result before committing.

This is a nice-to-have polish item. The baseline (S-01, S-02) delivers snap-on-drop
without a live preview; S-03 upgrades the experience once the core gestures are
solid.

- **Change ID:** `drag-live-preview`
- **PRD refs:** FR-003
- **Prerequisites:** S-01, S-02
- **Parallel with:** —
- **Blockers:** none
- **Unknowns:** none
- **Risk:** Continuous preview rendering during drag may cause jank on large Timelines; must validate against the real dataset size.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID              | Suggested issue title                                              | Ready for rs-plan | Notes                                      |
|------------|------------------------|--------------------------------------------------------------------|-------------------|--------------------------------------------|
| F-01       | dnd-context-wiring     | Wire @dnd-kit DndContext into Timeline with gesture arbitration    | yes               | First; unlocks both gesture slices         |
| S-01       | drag-allocation-move   | Drag-to-move: shift Allocation dates by dragging block body        | yes (after F-01)  | North star — highest value, first gesture  |
| S-02       | drag-allocation-resize | Drag-to-resize: change Allocation duration by dragging block edge  | yes (after F-01)  | Parallel with S-01 once F-01 is merged     |
| S-03       | drag-live-preview      | Live ghost preview during drag (move and resize)                   | yes (after S-01+S-02) | Nice-to-have polish; defer until core works |

## Open Roadmap Questions

No open questions inherited from the PRD. No new cross-slice questions surfaced
during roadmap decomposition — the PRD is fully specified for this increment, and
the one implementation choice (optimistic update vs. refetch) is a detail
appropriate for rs-plan, not a roadmap-level blocker.

## Parked

The following items are explicitly out of scope for this increment (from PRD
Non-Goals and the deferred Secondary success criterion):

- **Cross-row drag (person reassignment)** — drag an Allocation to a different
  person's row, changing `person_id`. Captured as Secondary; a later increment once
  same-row gestures are proven.
- **Touch / tablet support** — desktop mouse and trackpad only for this increment.
- **Undo / redo** — drop commits immediately; reverting is done by dragging back or
  editing in the AllocationModal.
- **Multi-block drag** — one Allocation block per gesture.
- **Sub-day granularity** — Timeline and gestures stay at whole-day resolution.
- **Blocking over-capacity moves** — over-capacity is shown (red bar), not prevented.

## Done

- dnd-context-wiring — Wire @dnd-kit DndContext into Timeline with gesture arbitration (closed by PR #32)
- drag-live-preview — Live ghost preview during drag (move and resize) (closed by PR #41)
