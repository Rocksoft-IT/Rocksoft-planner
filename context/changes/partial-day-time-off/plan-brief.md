# partial-day-time-off — Plan Brief

→ Full plan: [`plan.md`](./plan.md)
→ PRD refs: none (new capability; current time-off behaviour described in `context/prd/prd.md` "Current System Overview")

## What & why

Today a nieobecność (`TimeOff`) is always whole-day: it carries only
`start_date`/`end_date` and removes the entire day from a person's capacity. A
Planner cannot say "this person is unavailable 13:00–16:00 on Tuesday" — only
"unavailable all Tuesday". This change adds a **partial-day time off**: an
optional clock window (`start_time`–`end_time`) on a single day. The window's
duration is subtracted from that day's available capacity instead of zeroing the
whole day; whole-day time off is unchanged.

## Starting point

- `src/lib/types.ts:57` — `TimeOff` interface: `id, person_id, start_date,
  end_date, type, notes`. No time fields. `TIME_OFF_LABELS` (`:67`).
- `src/lib/utils.ts` — `calcUtilization()`: counts a workday as fully OOO if any
  `time_off` row covers it (`ds >= start_date && ds <= end_date`), drops the full
  `capacity_hours_per_day` for that day, and excludes allocation hours on OOO
  days. Per-day capacity is uniform (`availableWorkdays * capacityHoursPerDay`).
- `src/components/timeline/TimeOffModal.tsx` — create/edit form: person, type,
  start date, end date, notes. Writes to the `time_off` table via Supabase.
- `src/components/timeline/Timeline.tsx:460` — renders a time-off block at full
  lane height with a 45° hatch and the type emoji/label; `assignLanesAll`
  (`:59`) stacks allocations + time offs into lanes by date overlap.
- `src/app/(dashboard)/timeline/page.tsx:13` and `TimelineClient.tsx:25` fetch
  `time_off` with `select('*')` — new columns flow through automatically, no
  query change needed.
- `supabase-schema.sql` does **not** declare a `time_off` table — it was added by
  a migration outside this file. So the data-layer step is a new migration, not
  an edit to the committed schema.
- No automated test suite; `pnpm build` (Next.js typecheck + build) is the only
  automated gate, consistent with the prior change.

## Desired end state

A Planner opens the nieobecność modal, picks "Wybrane godziny", chooses a person,
a single date, and a start/end time (e.g. 13:00–16:00). On save, the row persists
with `start_time`/`end_time`. On the Timeline that day shows a partial block whose
height is proportional to the blocked hours and whose label shows the window.
The person's utilization bar reflects reduced available capacity for that day
(8h capacity − 3h block = 5h available). Whole-day time off (no times) looks and
behaves exactly as before.

## Key decisions made

| Decision | Choice | Why |
|---|---|---|
| Hours model | Clock window: nullable `start_time` + `end_time` on `time_off` | User choice; human-readable window; duration derived as `end_time − start_time` |
| Whole-day vs partial discriminator | Both times NULL → whole-day (current); both set → partial | Backward compatible; no data migration of existing rows |
| Day span of a partial block | Single day: when times are set, enforce `start_date = end_date` | Matches "w jakimś dniu"; keeps capacity math simple; daily-recurring window deferred |
| Capacity effect of a partial block | Reduce that day's available capacity by the window's hours; allocations unchanged | Consistent with the project guardrail "over-capacity is shown (red bar), not blocked" |
| Whole-day block behaviour | Unchanged (day excluded from capacity, allocation hours dropped) | Avoids dividing a vacation day's allocations by ~0 capacity |
| Block rendering | Partial block height ∝ blocked hours / 8 (mirrors allocation height scaling); label shows `HH:MM–HH:MM` | Visually distinguishes partial from whole-day at a glance |

## Scope

**In:**
- Migration: add nullable `start_time time`, `end_time time` to `time_off` + CHECK
  constraints (both-or-neither; `end_time > start_time`; single day when timed).
- `TimeOff` type: add `start_time`/`end_time`.
- `calcUtilization`: per-day capacity that subtracts partial-block hours.
- `TimeOffModal`: whole-day / selected-hours toggle, time inputs, single-day lock,
  validation, payload.
- `Timeline`: partial-block height + window label.

**Out:**
- Recurring or multi-day clock windows.
- Clock-scheduled allocations / an intraday axis on the Timeline.
- Multiple separate windows in one day as a single row (use two rows).
- Changes to allocation hours data model.

## Open questions

- Should two part-day blocks on the same date be summable past full capacity
  (over-block), or capped at capacity? Current plan: sum and surface over-capacity
  via the existing red bar, no hard cap.
