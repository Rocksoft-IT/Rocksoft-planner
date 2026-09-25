# Team member contract type + Timeline sort — Plan Brief

Full plan: `context/changes/contract-type-sort/plan.md`. No `research.md` or
`frame.md` — skipped (see Complexity below).

## What & why

Team members get an optional contract type — UoP, B2B, or Freelance — settable from
the existing person modal on the People page. The Timeline gains a second people-order
option, "Contract type" (alongside today's default "Name"), grouping rows
UoP → B2B → Freelance → unset, alphabetically by full name within each group. Planners
asked to see people grouped by how they're engaged when reading the Timeline.

## Starting point

- `PersonModal.tsx` edits `full_name`/`role`/`email`/`capacity_hours_per_day`/
  `avatar_color` on `team_members` via direct Supabase insert/update
  (`PersonModal.tsx:48-59`); no contract-type concept exists.
- `Timeline.tsx` only *filters* the people array it's given (`filteredPeople`,
  `Timeline.tsx:503-511`); the alphabetical order comes entirely from the server
  query (`timeline/page.tsx:9`, `.order('full_name')`) and is never re-sorted client-side.
- `public.team_members` has no `create table` statement in `supabase-schema.sql` — a
  pre-existing, already-documented gap (confirmed by `context/changes/add-roles/plan.md`
  and `context/changes/delete-person/plan.md:14-19`), not something this change
  introduces or fixes.

## Desired end state

A planner opens a team member's profile, picks UoP/B2B/Freelance or leaves it blank,
and saves — the choice round-trips on reopen and can be changed or cleared later. On
the Timeline, a new toggle switches the people order between "Name" (default,
unchanged) and "Contract type" (UoP → B2B → Freelance → unset, alphabetical within
each group); the existing people/project/role filters keep working and combine with
whichever sort is active. Nothing else — no badges, no new filter, no persistence of
the chosen sort across reloads, no permission change.

## Complexity

**LOW.** One small nullable/checked schema column (direct precedent:
`migrations/2026-09-15-profile-theme.sql`), one new modal field, one pure sort
comparator with a unit test, and one small UI toggle in an existing component — four
well-scoped, already-conventional changes, fully specified by the issue's FR/AC list,
no unfamiliar subsystem. Research and framing were skipped: the issue is a feature
request with explicit FR-001..006 and AC-01..05 (not a bug shape, not a disputed
scope), and a direct read of `PersonModal.tsx`, `Timeline.tsx`, `types.ts`,
`utils.ts`, and `supabase-schema.sql` (plus three prior change plans referencing
`team_members`) was enough to answer every open question below with file:line
evidence — no multi-subsystem exploration or cause/effect ambiguity to justify
`rs-research` or `rs-frame`.

## Key decisions made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Schema shape & sync | Nullable `team_members.contract_type text` + CHECK constraint, no default/backfill; synced into `supabase-schema.sql` as an `alter table` block (mirroring the `tmc_years_experience_check` guard, `supabase-schema.sql:270-273`) rather than editing a `create table` (there isn't one for `team_members`) | Matches the issue's explicit "nullable; no backfill required" constraint and the file's only precedent for extending a table it doesn't define | Issue + Auto |
| Type modeling | `ContractType` union + `CONTRACT_TYPES` const in `types.ts`; `TeamMember.contract_type: ContractType \| null` | Mirrors the existing `Profile.theme: 'light' \| 'dark'` field one line up (`types.ts:9`) | Auto |
| Profile field UI | Native `<select>` (empty + 3 options), not a multi-select dropdown | Contract type is single-valued/mutually exclusive, unlike `role`; matches `TimeOffModal.tsx`'s existing `<select>` pattern (`TimeOffModal.tsx:115-125`) for the same shape of field | Auto |
| Timeline sort control | Inline 2-button toggle ("Nazwa"/"Typ umowy"), not a 4th filter dropdown | Binary choice, not multi-select; mirrors `PeopleClient.tsx`'s existing `groupMode` toggle (`PeopleClient.tsx:106-131`) at the same scale | Auto |
| Sort application & default | Sort applied to `filteredPeople` (after existing filters), `'name'` mode is a pass-through (no re-sort), state not persisted | Satisfies AC-04 (filters + sort combine) and AC-03 (default unchanged) by construction; non-persistence is an explicit non-goal | Auto + Issue |
| Comparator placement & tests | Pure `compareByContractType` in `utils.ts`, covered by a new `utils.test.ts` (Vitest) | Matches the file's existing pure-helper style (`calcUtilization`) and this repo's one test precedent (`ThemeProvider.test.tsx`); gives FR-004's ordering rule automated coverage | Auto |
| Permissions | No RLS/permission change | `PersonModal.tsx` already writes other fields to `team_members` with no column-level restriction (`PersonModal.tsx:57-59`); RLS is row-level, so the new column rides the same authorized path | Issue + Auto |

No `Consult` decisions were needed — every question had one clearly-grounded option.

## Scope

**In**: `contract_type` column + migration + schema sync; `TeamMember` type; person
modal field (set/change/clear); Timeline sort toggle (Name / Contract type);
sort-comparator unit test.

**Out** (per issue non-goals): showing contract type anywhere but the profile and the
sort; filtering by contract type; group headers/separators on the Timeline; persisting
the chosen sort; new permission rules; contract details (dates/rates/history); fixing
the pre-existing missing `create table team_members` in `supabase-schema.sql`;
`/api/employees`.

## Architecture / Approach

See plan.md `## Implementation Approach` for full detail. In short: schema column
mirrors the `theme` precedent exactly; the Timeline sort is a client-side `Array.sort`
over the already-filtered people array, keyed by index-in-`CONTRACT_TYPES` then
`localeCompare(full_name)`, wired through one new state variable and one new toggle
control — no new components, no new dependencies.

## Increments at a glance

| # | Delivers | Depends on | User-visible | Key risk |
|---|---|---|---|---|
| 1 | Contract type on the profile (schema + person modal) | — | yes | Schema/RLS applied only via the Supabase Dashboard, not from this agent — verified manually |
| 2 | Timeline contract-type sort | 1 | yes | None significant — pure client-side sort over an existing, already-filtered array |

## Phases at a glance

| Phase | Increment | Delivers | Key risk |
|---|---|---|---|
| 1 | 1 | Migration + `supabase-schema.sql` sync + `TeamMember` type | Manual-only DB verification (no live Supabase access) |
| 2 | 1 | Person modal contract-type field | None significant |
| 3 | 2 | Pure sort comparator + unit test | None significant |
| 4 | 2 | Timeline sort toggle wired to the comparator | None significant |

Prerequisites: Increment 2 requires Increment 1 merged (needs `contract_type` on the
type and in the database) — not parallel, no file overlap regardless.

## Open risks & assumptions

- No `decision-to-verify` guards — no Consult was needed and no LOW-confidence framing
  step was carried over (frame.md was skipped).
- The actual migration apply/rollback and every acceptance-criterion screen check are
  manual (`#### Manual` rows) because this agent has no live Supabase connection and
  no browser to drive — consistent with every prior plan in this repo
  (`context/foundation/tech-stack.md`: no CI, no automated test runner beyond Vitest).
- The pre-existing gap (`team_members` has no `create table` in `supabase-schema.sql`)
  is noted but deliberately left as-is; if it's ever fixed, this change's `alter
  table` block should be folded into that future `create table` rather than kept as a
  separate trailing block.

## Success criteria (summary)

- AC-01/AC-05 (set, change, clear a contract type from the profile) — Phase 2, manual.
- AC-02 (Contract-type sort produces UoP → B2B → Freelance → unset, alphabetical
  within group) — Phase 3 automated (unit test) + Phase 4 manual (on-screen).
- AC-03 (default Name order unchanged) — Phase 4, manual.
- AC-04 (sort combines with existing filters) — Phase 4, manual.
- FR-006 (create/edit without choosing a contract type) — Phase 2, manual.
