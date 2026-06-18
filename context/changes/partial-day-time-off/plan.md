# Partial-day time off — Implementation Plan

## Overview

Add the ability to mark a person unavailable for a clock window within a single
day (e.g. 13:00–16:00) instead of only a whole day. A part-day block subtracts
its duration from that day's available capacity; whole-day time off keeps its
current behaviour. The change touches the `time_off` data model, the utilization
calculation, the time-off modal, and the Timeline block renderer.

## Current State Analysis

- **Model.** `TimeOff` (`src/lib/types.ts:57`) is whole-day only: `id`,
  `person_id`, `start_date`, `end_date`, `type` (`vacation | sick_leave |
  other`), `notes`. `TIME_OFF_LABELS` (`:67`) maps each type to a Polish label +
  emoji + colour.
- **Persistence.** Rows live in a `time_off` table read with `select('*')` in
  `src/app/(dashboard)/timeline/page.tsx:13` and refetched in
  `TimelineClient.tsx:25`. `TimeOffModal.tsx` inserts/updates `{ person_id, type,
  start_date, end_date, notes }`. The table is **not** declared in
  `supabase-schema.sql` — it was created by a migration kept outside that file.
- **Availability.** `calcUtilization()` (`src/lib/utils.ts`) treats a workday as
  fully OOO when any time-off row covers it (`ds >= t.start_date && ds <=
  t.end_date`). Such days are removed from capacity entirely
  (`availableWorkdays = workdays.length − oooDays`) and allocation hours on them
  are dropped. Capacity per day is therefore uniform.
- **Rendering.** `Timeline.tsx:460` draws a time-off block at full `LANE_HEIGHT`
  with a 45° hatch and the type emoji/label; allocation blocks below it
  (`:480+`) already scale height by `hours_per_day / 8`. `assignLanesAll`
  (`:59`) stacks allocations + time offs into lanes purely by date overlap.

Assumption to verify during build: the `time_off` migration is applied directly
in Supabase (no migration runner in the repo), so Phase 1 is delivered as a SQL
snippet to run in the Supabase SQL editor.

## Desired End State

A part-day time off is a `time_off` row with `start_time`/`end_time` set and
`start_date = end_date`. Externally observable:
- The modal offers "Cały dzień" vs "Wybrane godziny"; the latter shows time
  pickers and locks the entry to one date.
- Saving persists the window; reopening the row restores it.
- On the Timeline the day shows a part-day block sized to its hours with a
  `HH:MM–HH:MM` label; whole-day blocks are unchanged.
- The person's utilization bar shows reduced available capacity for that day
  (capacity − blocked hours), not a removed day.

### Key discoveries

- `TimeOff` has no time fields — `src/lib/types.ts:57`.
- Whole-day OOO logic lives in two spots of one function — `src/lib/utils.ts`
  `calcUtilization` (the `oooDays` count and the per-allocation `isOoo` filter).
- `select('*')` fetches mean no read-query changes are needed —
  `timeline/page.tsx:13`, `TimelineClient.tsx:25`.
- The modal write payload is the single insert/update site —
  `TimeOffModal.tsx` `handleSubmit`.
- Allocation height scaling (`hours_per_day / 8`, min 6px) is the pattern to
  reuse for part-day block height — `Timeline.tsx:480+`.
- `time_off` is absent from `supabase-schema.sql`, so we add a migration rather
  than editing that file.

## What we're NOT doing

- No recurring or multi-day clock windows (a timed row is one day).
- No intraday axis on the Timeline and no clock-scheduled allocations.
- No second window packed into one row — a second block is a second row.
- No change to the allocation data model or to whole-day OOO behaviour.

## Implementation Approach

Make the clock window purely additive and nullable so existing rows keep working
with zero data migration: both times NULL means whole-day (today's behaviour),
both set means a part-day block. Derive blocked hours from the window rather than
storing a separate hours number, so the window and the capacity effect can never
disagree. In `calcUtilization`, stop treating capacity as uniform: compute each
workday's available hours as `capacity − (whole-day? capacity : sum of part-day
window hours)` and sum those, leaving allocation hours intact so any resulting
over-capacity surfaces through the existing red bar — consistent with the
project's "over-capacity is shown, not blocked" guardrail. Reuse the allocation
height-scaling pattern for the part-day block so partial vs whole-day reads at a
glance. The alternative — a plain `hours` integer with no clock time — was
rejected because the user wants a real window (13:00–16:00) shown to planners.

## Phase 1: Data model

### Overview
Add the nullable clock-window columns and integrity constraints to `time_off`,
and extend the `TimeOff` type.

### Required changes
#### 1. `time_off` table (Supabase migration)
- **File**: new migration SQL (run in Supabase SQL editor; repo has no runner)
- **Goal**: store an optional single-day clock window without breaking whole-day rows
- **Contract**:
  - `start_time time null`, `end_time time null`
  - CHECK: both null OR both not null
  - CHECK: when not null, `end_time > start_time`
  - CHECK: when times are not null, `start_date = end_date`
```sql
alter table public.time_off
  add column if not exists start_time time,
  add column if not exists end_time   time;

alter table public.time_off
  add constraint time_off_window_both_or_neither
    check ((start_time is null) = (end_time is null)),
  add constraint time_off_window_order
    check (start_time is null or end_time > start_time),
  add constraint time_off_window_single_day
    check (start_time is null or start_date = end_date);
```

#### 2. `TimeOff` type
- **File**: `src/lib/types.ts`
- **Goal**: expose the window to the client
- **Contract**: add `start_time: string | null` and `end_time: string | null`

### Success criteria
#### Automated
- `pnpm build` passes with the updated type
#### Manual
- Migration applies on the live Supabase project; an existing whole-day row still
  loads (times null)
- Inserting a row with `start_time` set but `end_time` null is rejected by the
  constraint

## Phase 2: Availability logic

### Overview
Make `calcUtilization` capacity per-day so a part-day window reduces only its
hours.

### Required changes
#### 1. `calcUtilization`
- **File**: `src/lib/utils.ts`
- **Goal**: subtract part-day window hours from a day's available capacity; keep
  whole-day behaviour; leave allocation hours intact for part-day days
- **Contract**: same return shape `{ allocated, free, allocatedHours,
  capacityHours, ooodays }`. Per workday: `dayCapacity = isWholeDayOff ? 0 :
  capacityHoursPerDay − sumPartDayHours(day)` (floored at 0); `capacityHours =
  Σ dayCapacity`. A day is "whole-day off" only for rows with null times.
  `ooodays` counts whole-day offs only. Window hours = `(end_time − start_time)`
  in hours.

### Success criteria
#### Automated
- `pnpm build` passes
#### Manual
- Person with 8h capacity and one 3h part-day block on a workday shows that day's
  available capacity as 5h in the utilization bar
- A whole-day vacation still removes the full day (unchanged percentage vs before)

## Phase 3: Time-off modal

### Overview
Let the planner choose whole-day vs a clock window in `TimeOffModal`.

### Required changes
#### 1. `TimeOffModal`
- **File**: `src/components/timeline/TimeOffModal.tsx`
- **Goal**: capture and edit the window
- **Contract**:
  - A mode toggle: "Cały dzień" (default) / "Wybrane godziny"
  - In "Wybrane godziny": show `start_time`/`end_time` `<input type="time">`,
    collapse to a single date field (end date = start date)
  - Validation: in window mode require both times and `end_time > start_time`
  - Payload: whole-day → `start_time: null, end_time: null` (as today);
    window → include both times and set `end_date = start_date`
  - On edit, hydrate the mode from whether the row has times

### Success criteria
#### Automated
- `pnpm build` passes
#### Manual
- Creating a 13:00–16:00 block on one day saves and reopens with the window
  restored
- Switching to "Wybrane godziny" with end ≤ start shows a validation error and
  does not save
- Creating a whole-day entry still works unchanged

## Phase 4: Timeline rendering

### Overview
Render a part-day block distinctly from a whole-day block.

### Required changes
#### 1. Time-off block render
- **File**: `src/components/timeline/Timeline.tsx` (time-off branch ~`:460`)
- **Goal**: size and label part-day blocks
- **Contract**: when the row has times, block height ∝ `windowHours / 8`
  (min 6px, same clamp as allocations), centred in the lane, label shows
  `HH:MM–HH:MM` next to the emoji; `title` includes the window. Whole-day rows
  render exactly as today (full lane height, hatch). No change to
  `assignLanesAll`.

### Success criteria
#### Automated
- `pnpm build` passes
#### Manual
- A 3h block renders shorter than a whole-day block on the same row and shows its
  time window
- Two part-day blocks on the same day stack into separate lanes (overlap)
- Whole-day blocks look identical to before

## Testing Strategy

No unit/integration suite exists in the repo; `pnpm build` (typecheck + Next.js
build) is the automated gate for every phase. Everything else is the manual
eyeball checklist above, exercised against the live Supabase project. Suggested
manual matrix: whole-day vacation (regression), single 3h window, two windows on
one day, window crossing a weekend boundary excluded from capacity, edit + delete
of a windowed row.

## References

- `src/lib/types.ts:57` — `TimeOff`, `TIME_OFF_LABELS`
- `src/lib/utils.ts` — `calcUtilization`
- `src/components/timeline/TimeOffModal.tsx` — create/edit form + write payload
- `src/components/timeline/Timeline.tsx:59,:460,:480` — lanes + block render
- `src/app/(dashboard)/timeline/page.tsx:13`, `TimelineClient.tsx:25` — fetch
- `context/prd/prd.md` — current system overview
- `context/changes/drag-allocation-move/plan.md` — prior change shape / gate

## Progress

### Phase 1: Data model
#### Automated
- [ ] 1.1 `pnpm build` passes with the updated type
#### Manual
- [ ] 1.2 Migration applies on the live Supabase project; an existing whole-day row still loads (times null)
- [ ] 1.3 Inserting a row with `start_time` set but `end_time` null is rejected by the constraint

### Phase 2: Availability logic
#### Automated
- [ ] 2.1 `pnpm build` passes
#### Manual
- [ ] 2.2 Person with 8h capacity and one 3h part-day block on a workday shows that day's available capacity as 5h in the utilization bar
- [ ] 2.3 A whole-day vacation still removes the full day (unchanged percentage vs before)

### Phase 3: Time-off modal
#### Automated
- [ ] 3.1 `pnpm build` passes
#### Manual
- [ ] 3.2 Creating a 13:00–16:00 block on one day saves and reopens with the window restored
- [ ] 3.3 Switching to "Wybrane godziny" with end ≤ start shows a validation error and does not save
- [ ] 3.4 Creating a whole-day entry still works unchanged

### Phase 4: Timeline rendering
#### Automated
- [ ] 4.1 `pnpm build` passes
#### Manual
- [ ] 4.2 A 3h block renders shorter than a whole-day block on the same row and shows its time window
- [ ] 4.3 Two part-day blocks on the same day stack into separate lanes (overlap)
- [ ] 4.4 Whole-day blocks look identical to before
