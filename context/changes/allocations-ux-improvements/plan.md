# Allocations & Timeline UX Improvements — Implementation Plan

<!-- AS-BUILT: reconstructed from PR #49 (range efb5a44..a675fcd); not a forward plan -->

## Overview

Five independent UX fixes to the RS Planner allocations/timeline view, all from
ClickUp (parent `869de3y2n`). They share no code path beyond the two files they
touch and each ships on its own; they were ordered low-risk-first, with the
high-priority label-visibility fix late because it depends on scroll state that
the earlier phases do not.

## Current State Analysis

Reconstructed from the diff; the state before the change:

- `Timeline.tsx` sized rows from `LANE_HEIGHT = 28`, `ROW_PADDING = 4` and a
  `calcRowHeight` floor of 44px, so a person with several projects got a tall,
  loosely stacked row.
- In the frozen left column the person's name (`leading-tight`, no bottom
  margin) sat directly on top of the utilization stats block (`mt-1`), so the
  two visually merged.
- An allocation block rendered its project name at a fixed `px-2`. A block
  starting to the left of the viewport had its label scrolled out of sight, so a
  project that began before the visible window showed as an unlabelled bar.
- `AllocationModal` created project allocations only. Time off was a separate
  `TimeOffModal` reached from elsewhere, and the project `<select>` listed every
  project with no way to filter.

## Desired End State

- A person's projects stack compactly, while the name and the utilization stats
  stay visually separated.
- Every allocation block shows its project name, including blocks that start
  before the viewport's left edge — the label slides along the visible edge.
- The add popup handles both entry kinds: **projekt** or **urlop**, mutually
  exclusive, chosen with a toggle and never leaving the popup.
- Assigning a project offers a live, case-insensitive searchbar over the project
  list, with an explicit empty-state message.

### Key discoveries

- Row height is driven by the frozen left cell (avatar + name + stats), not by
  the lanes — so compacting lanes (P2) and un-blending the name (P1) pull in
  opposite directions and had to be tuned together: lanes shrink while the floor
  grows.
- The label fix needs the container's `scrollLeft` in the block component;
  `handleScroll` already computed it for the visible-date readout, so it only had
  to be lifted into state and threaded down as a prop.
- Editing is always a project allocation — an existing `time_off` row never opens
  this modal — so the kind toggle is only rendered in create mode.

## What we're NOT doing

- No Timeline / scroll / drag redesign — only the label offset and the spacing
  constants change.
- No schema or RLS changes.
- No server-side search; filtering is client-side over the already-loaded list.
- `TimeOffModal` is not removed; this adds a second way in, it does not replace
  the existing one.
- No new dependencies and no new tests.
- No change to the audit stamping added by `allocation-edited-by`.

## Implementation Approach

Five phases, one per ClickUp task, ordered low-risk-first so each can be
verified on its own: two spacing/constant changes, then the searchbar, then the
scroll-tracking label fix, then the kind toggle that adds a second write target
to the modal. `Timeline.tsx` carries P1/P2/P4; `AllocationModal.tsx` carries
P3/P5.

## Phase 1: Left column — separate name from stats (869e5gwa8)

### Overview
Stop the person's name and the utilization stats from blending together.

### Required changes

#### 1. Person cell spacing
- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: give the name and the stats block their own breathing room
- **Contract**: name gets `mb-1.5`, the stats wrapper `mt-1.5`; `calcRowHeight` floor raised 44 → 50 so the taller cell still fits

### Success criteria
#### Automated
- `npm run build` succeeds
#### Manual
- A person's name and the `Xh / Yh` stats read as two separate elements at every row height

## Phase 2: Compact per-person stacking (869e6vum3)

### Overview
Stack a person's projects more tightly so more of them fit without scrolling.

### Required changes

#### 1. Lane constants
- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: reduce vertical space per allocation block
- **Contract**: `LANE_HEIGHT` 28 → 24, `ROW_PADDING` 4 → 3; `LANE_GAP` stays 2

### Success criteria
#### Automated
- `npm run build` succeeds
#### Manual
- A person with several overlapping projects occupies a visibly shorter row
- Blocks remain legible and clickable at the reduced height

## Phase 3: Searchbar over the project picker (869e5gvne)

### Overview
Filter the project list live when assigning a project to a person.

### Required changes

#### 1. Project search
- **File**: `src/components/timeline/AllocationModal.tsx`
- **Goal**: make picking a project workable as the project list grows
- **Contract**: `projectQuery` state, reset when the modal opens; `filteredProjects` = case-insensitive substring match on `name`; an explicit message when nothing matches. Mirrors the existing `ProjectFilter` component.

### Success criteria
#### Automated
- `npm run build` succeeds
- `npm run lint` reports no new errors
#### Manual
- Typing filters the list as you type, case-insensitively
- A query matching nothing shows the empty-state message rather than a blank list
- Reopening the modal starts with an empty query

## Phase 4: Keep the project name visible (869e6rn52)

### Overview
Show the project name on blocks that start before the viewport's left edge.

### Required changes

#### 1. Scroll offset in Timeline state
- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: make the horizontal scroll position available to the block renderer
- **Contract**: `scrollLeft` state, set in `handleScroll` alongside the existing visible-date computation; passed to `DraggableAllocBlock` as a prop

#### 2. Label offset
- **File**: `src/components/timeline/Timeline.tsx` (`DraggableAllocBlock`)
- **Goal**: slide the label to the visible edge instead of letting it scroll away
- **Contract**: `labelOffset = max(0, min(scrollLeft - left, max(0, width - 96)))`; the label wrapper uses `paddingLeft: 8 + labelOffset` and keeps `pr-2`, so the label never runs past the block's right edge

### Success criteria
#### Automated
- `npm run build` succeeds
#### Manual
- A project that started before the visible window shows its name in the "dziś" column
- The label never escapes its block's right edge on a short block
- Dragging a block still snaps per day; the label follows without jitter

## Phase 5: One popup — projekt or urlop (869e6vp54)

### Overview
Let the add popup create either a project allocation or a time-off entry,
without navigating away.

### Required changes

#### 1. Entry-kind toggle
- **File**: `src/components/timeline/AllocationModal.tsx`
- **Goal**: offer the two mutually exclusive entry kinds in one place
- **Contract**: `kind: 'project' | 'timeoff'`, rendered only when creating (an existing allocation is always a project); resets to `'project'` on open; modal title follows the kind

#### 2. Time-off write path
- **File**: `src/components/timeline/AllocationModal.tsx`
- **Goal**: send a time-off entry to the right table
- **Contract**: when `kind === 'timeoff'` and creating, insert `{ person_id, type, start_date, end_date, notes }` into `time_off` and return early; `timeOffType` drawn from `['vacation', 'sick_leave', 'other']` with `TIME_OFF_LABELS`. Validation splits: person is always required, project only on the allocation path.

### Success criteria
#### Automated
- `npm run build` succeeds
- `npm run lint` reports no new errors
#### Manual
- Creating with "Urlop" selected adds a time-off entry, not an allocation
- Creating with "Projekt" selected still adds an allocation
- The two kinds cannot be selected at once, and editing an existing allocation shows no toggle
- Saving without a person, or without a project on the project path, shows the matching validation message

## Testing Strategy

The project has no automated test runner (`package.json` exposes `dev`, `build`,
`start`, `lint` only). Verification is `npm run build` plus standalone eslint —
which reports only pre-existing project-wide issues, none introduced here — and
the manual UX checks above, which need a dev Supabase instance.

## Performance Notes

`scrollLeft` is stored in React state and updated on every scroll event, so each
horizontal scroll re-renders the timeline rows. Acceptable at the current dataset
size; worth watching if row counts grow.

## References

- `context/changes/allocations-ux-improvements/change.md` — the five ClickUp tasks
- `context/changes/allocations-ux-improvements/plan-brief.md` — the decision table this plan was reconstructed against
- PR #49 — commit range `efb5a44..a675fcd`
- ClickUp parent `869de3y2n`

## Progress
<!-- AS-BUILT: criteria left unchecked — rs-impl_review verifies them against the diff. -->

### Phase 1: Left column — separate name from stats (869e5gwa8)
#### Automated
- [ ] 1.1 `npm run build` succeeds
#### Manual
- [ ] 1.2 A person's name and the `Xh / Yh` stats read as two separate elements at every row height

### Phase 2: Compact per-person stacking (869e6vum3)
#### Automated
- [ ] 2.1 `npm run build` succeeds
#### Manual
- [ ] 2.2 A person with several overlapping projects occupies a visibly shorter row
- [ ] 2.3 Blocks remain legible and clickable at the reduced height

### Phase 3: Searchbar over the project picker (869e5gvne)
#### Automated
- [ ] 3.1 `npm run build` succeeds
- [ ] 3.2 `npm run lint` reports no new errors
#### Manual
- [ ] 3.3 Typing filters the list as you type, case-insensitively
- [ ] 3.4 A query matching nothing shows the empty-state message rather than a blank list
- [ ] 3.5 Reopening the modal starts with an empty query

### Phase 4: Keep the project name visible (869e6rn52)
#### Automated
- [ ] 4.1 `npm run build` succeeds
#### Manual
- [ ] 4.2 A project that started before the visible window shows its name in the "dziś" column
- [ ] 4.3 The label never escapes its block's right edge on a short block
- [ ] 4.4 Dragging a block still snaps per day; the label follows without jitter

### Phase 5: One popup — projekt or urlop (869e6vp54)
#### Automated
- [ ] 5.1 `npm run build` succeeds
- [ ] 5.2 `npm run lint` reports no new errors
#### Manual
- [ ] 5.3 Creating with "Urlop" selected adds a time-off entry, not an allocation
- [ ] 5.4 Creating with "Projekt" selected still adds an allocation
- [ ] 5.5 The two kinds cannot be selected at once, and editing an existing allocation shows no toggle
- [ ] 5.6 Saving without a person, or without a project on the project path, shows the matching validation message
