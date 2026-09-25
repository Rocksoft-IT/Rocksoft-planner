# Team member contract type + Timeline sort — Implementation Plan

## Overview

Team members gain a `contract_type` (UoP / B2B / Freelance / unset), settable from the
existing person modal on the People page. The Timeline gets a second people-order
option — "Contract type" alongside today's default "Name" — that groups rows
UoP → B2B → Freelance → unset, alphabetically by full name within each group. Nothing
else about a team member's profile, the People page, or the Timeline's existing
filters/drag/allocation behavior changes.

## Current State Analysis

- **People profile.** `PersonModal.tsx` (`src/components/people/PersonModal.tsx`) is
  the only place a team member is created/edited: it holds local state for
  `full_name`, `role` (via `RoleSelect`), `email`, `capacity_hours_per_day`,
  `avatar_color`, and on submit does
  `supabase.from('team_members').update(payload)` (edit) or `.insert(payload)`
  (create) — `PersonModal.tsx:48-59`. There is no notion of contract type today.
- **Timeline people order.** `people/page.tsx` fetches
  `supabase.from('team_members').select('*').order('full_name')` server-side
  (`src/app/(dashboard)/timeline/page.tsx:9`) and passes it straight through
  `TimelineClient` → `Timeline` unchanged; `Timeline.tsx` only *filters* that array
  (`filteredPeople`, `Timeline.tsx:503-511`) by role/people/project selection — it
  never re-sorts it, so today's alphabetical order is simply the order the query
  returned. `filteredPeople` feeds `rowData` (`Timeline.tsx:514-521`), which drives
  the rendered rows.
- **Existing filter controls** (`PeopleFilter`, `ProjectFilter`, `SkillsFilter`) sit in
  the Timeline top bar (`Timeline.tsx:609-628`) as separate dropdown components. A
  same-scale precedent for a small *toggle* control (not a dropdown) already exists:
  `PeopleClient.tsx`'s "Grupuj po:" button group (`Brak` / `Stanowisko` / `Wolny etat`,
  `src/app/(dashboard)/people/PeopleClient.tsx:106-131`), driven by a single
  `groupMode` state variable.
- **`TeamMember` type** (`src/lib/types.ts:14-23`) has no `contract_type` field. The
  sibling `Profile` interface (`types.ts:1-12`) already has a same-shaped precedent:
  `theme: 'light' | 'dark'` (`types.ts:9`), added by the most recent comparable change
  (`migrations/2026-09-15-profile-theme.sql`).
- **Schema.** `public.team_members` is referenced throughout `supabase-schema.sql`
  (FKs, RLS-bypass rpcs) but has **no `create table` statement in that file** — it was
  created directly in the Supabase project and never captured back into the committed
  script. This is a pre-existing, already-documented gap (confirmed independently by
  `context/changes/add-roles/plan.md`: "Tabela nie jest zdefiniowana w zacommitowanym
  `supabase-schema.sql`" and by `context/changes/delete-person/plan.md:14-19`), not
  something this change introduces or is scoped to fix. The file already has a
  precedent for adding a guarded column to an *existing* table without touching a
  `create table` block: the idempotent `alter table ... add constraint` pair for
  `tmc_years_experience_check` (`supabase-schema.sql:270-273`).
- **Permissions.** `PersonModal.tsx` already writes `full_name`, `role`, `email`,
  `capacity_hours_per_day`, `avatar_color` straight to `team_members` via the browser
  Supabase client with no column-level restriction (`PersonModal.tsx:57-59`) — RLS on
  `public.team_members` is row-level, not column-level, so a new column on the same
  UPDATE/INSERT payload is authorized by whatever already authorizes today's fields.
  No RLS change is needed for "whoever can edit a profile today can set the contract
  type; everyone who can see team members can see it."
- **Tests.** Vitest is configured and already used for a pure-logic/behavior test
  (`src/components/ThemeProvider.test.tsx`, run via `npm run test`) — the first
  automated-test precedent in this codebase, immediately after `src/lib/utils.ts`'s
  other pure helpers (`calcUtilization`, `formatAvailability`, etc.).

### Key discoveries

- `Timeline.tsx:503-511` (`filteredPeople`) is the single choke point both the
  existing filters and the new sort must pass through before `rowData` is built
  (`Timeline.tsx:514`) — sorting `filteredPeople` (not `people`) satisfies AC-04
  ("filters combine with the chosen sort") by construction.
- The default order needs no new code: `people` already arrives pre-sorted
  alphabetically from the server query (`timeline/page.tsx:9`), so leaving "Name" mode
  as a no-op (skip re-sorting) keeps AC-03 exactly as-is with zero risk of a
  re-sort changing tie-breaking behavior.
- `public.team_members` has no `create table` in `supabase-schema.sql` — the sync
  step for this change is an `alter table` block (mirroring
  `supabase-schema.sql:270-273`), not an edit inside a table definition.
- `PersonModal.tsx:57-59`'s existing insert/update payload proves no RLS/permission
  change is needed for the new field.

## What we're NOT doing

- Not showing contract type on the Timeline row, the People card, or anywhere besides
  the profile modal and the sort control (explicit non-goal).
- Not adding a Timeline *filter* by contract type — sorting only.
- Not adding group headers/section separators on the Timeline rows.
- Not persisting the chosen Timeline sort across reloads (resets to "Name" on every
  page load, by design).
- Not changing any permission/RLS rule for `team_members`.
- Not modeling contract details (dates, rates, history).
- Not creating the missing `create table public.team_members` statement in
  `supabase-schema.sql` — that gap pre-dates this change and is out of scope; this
  plan follows the file's existing convention for extending an already-created table
  it doesn't define (the `tmc_years_experience_check` pattern).
- Not touching `/api/employees` (`src/app/api/employees/route.ts`) — it selects an
  explicit field list that doesn't include `contract_type`, and the issue scopes
  visibility to "the profile and the sort" only.

## Implementation Approach

**Schema**: a new nullable `public.team_members.contract_type text` column with a
`CHECK (contract_type is null or contract_type in ('UoP', 'B2B', 'Freelance'))`
constraint, added via a dated idempotent migration under `migrations/` and mirrored
into `supabase-schema.sql`, matching this repo's established migration + CHECK-guard
convention (`migrations/2026-09-15-profile-theme.sql`;
`supabase-schema.sql:270-273`). No default and no backfill: every existing row is
already valid as `contract_type IS NULL`, which is exactly the "unset" state FR-001
and AC-05 require — chosen over a `not null default ''` sentinel (rejected: it would
need a backfill the issue explicitly says isn't required, and would make "unset"
ambiguous with an empty string sent by a client). Because `team_members` has no
`create table` in `supabase-schema.sql`, the mirror is an `alter table` block (same
shape as the `tmc_years_experience_check` pair), not an edit to a table definition —
fixing that unrelated pre-existing gap is out of scope.

**Types**: `src/lib/types.ts` gets an exported `ContractType = 'UoP' | 'B2B' |
'Freelance'` union and a `CONTRACT_TYPES: ContractType[]` const (in declaration
order — the same order the sort groups by), and `TeamMember.contract_type:
ContractType | null` is added to the existing interface, mirroring
`Profile.theme: 'light' | 'dark'` (`types.ts:9`) one field down.

**Profile UI**: `PersonModal.tsx` gets one more field — a native `<select>` bound to
`contract_type` state, with `<option value="">` as the unset choice followed by the
three `CONTRACT_TYPES` options — matching this codebase's existing pattern for a
single-value enum-ish field in a modal (`TimeOffModal.tsx`'s `<select>` for `Osoba`,
`TimeOffModal.tsx:115-125`), not `RoleSelect`'s multi-select dropdown (role is
multi-valued; contract type is single-valued and mutually exclusive, so a plain
`<select>` is the simpler, better-fitting primitive already used elsewhere in this
exact form). The field is optional (no `required` attribute), satisfying FR-006.

**Timeline sort**: a new `sortMode: 'name' | 'contractType'` state in `Timeline.tsx`,
defaulting to `'name'`, surfaced as a small two-button toggle in the top bar next to
the existing filters — mirroring `PeopleClient.tsx`'s `groupMode` button-group
(`PeopleClient.tsx:106-131`) rather than adding a fourth dropdown component, since
this is a binary choice, not a multi-select filter. `'name'` mode is a pass-through
(no re-sort — `filteredPeople` is already alphabetical from the server); `'contractType'`
mode sorts a copy of `filteredPeople` through a new pure comparator. State lives only
in `Timeline.tsx` (not persisted), matching the explicit non-goal.

**Sort comparator**: a pure `contractTypeSortIndex` lookup and `compareByContractType`
comparator added to `src/lib/utils.ts`, alongside its other pure Timeline/People
helpers (`calcUtilization`, `formatAvailability`), covered by a new Vitest unit test
(`src/lib/utils.test.ts`) — chosen over inlining the sort in `Timeline.tsx` because a
standalone pure function is directly unit-testable (this codebase's one existing test,
`ThemeProvider.test.tsx`, is the precedent for adding automated coverage rather than
relying on manual-only verification) and reusable if another view ever needs the same
order.

## Increments

| # | Name | Phases | Depends on | User-visible | Status | PR |
|---|---|---|---|---|---|---|
| 1 | Contract type on the profile (schema + person modal) | 1-2 | — | yes | done | #72 |
| 2 | Timeline contract-type sort | 3-4 | 1 | yes | in-progress | — |

## Phase 1: Schema + type

### Overview
Add the column this whole change depends on, kept nullable with no backfill, and make
it visible to TypeScript.

### Required changes
#### 1. Team member schema
- **File**: `migrations/2026-09-25-team-member-contract-type.sql` (new)
- **Goal**: persist an optional contract type per team member (FR-001, FR-002),
  with every existing row staying valid as unset (constraint: no backfill).
- **Contract**: idempotent `alter table public.team_members add column if not exists
  contract_type text;` plus an idempotent CHECK constraint (`drop constraint if
  exists` + `add constraint`, matching `supabase-schema.sql:270-273`'s guard shape)
  restricting non-null values to `'UoP'`, `'B2B'`, `'Freelance'`; a WHY/HOW header
  banner matching `migrations/2026-09-15-profile-theme.sql`'s format; an explicit
  rollback note (`alter table public.team_members drop constraint if exists
  team_members_contract_type_check; alter table public.team_members drop column if
  exists contract_type;` — safe, no dependent data, no other table or view
  references this column).

#### 2. Schema mirror
- **File**: `supabase-schema.sql`
- **Goal**: keep the committed schema script in lockstep with the live database,
  per repo convention.
- **Contract**: the same `alter table` column + CHECK constraint pair appended near
  the existing `team_members`-related functions at the end of the file (after the
  `delete_team_member` block, `supabase-schema.sql:474-496`), with a comment pointing
  back at the migration file for WHY/HOW and noting (as this plan does) that
  `team_members` has no `create table` in this script, so the mirror is an `alter
  table` addition rather than an edit to a table definition.

#### 3. TeamMember type
- **File**: `src/lib/types.ts`
- **Goal**: make the new field visible to TypeScript consumers.
- **Contract**: export `ContractType = 'UoP' | 'B2B' | 'Freelance'` and `CONTRACT_TYPES:
  ContractType[] = ['UoP', 'B2B', 'Freelance']` (declaration order = sort-group
  order); add `contract_type: ContractType | null` to `TeamMember` (`types.ts:14-23`).
  `Profile` is unaffected (contract type is a `team_members` concept, not a
  signed-in-account concept).

### Success criteria
#### Automated
- [ ] `npm run lint` passes with no new errors
- [ ] `npx tsc --noEmit` passes
- [ ] the column/constraint text added to `supabase-schema.sql` matches the
  migration's column/constraint (agent-checkable diff)
#### Manual
- [ ] the migration applied via the Supabase Dashboard SQL editor on a dev/staging
  project leaves every existing `team_members` row with `contract_type = null`, and
  a direct update to `'UoP'` / `'B2B'` / `'Freelance'` / back to `null` all succeed
  while any other value is rejected by the constraint

## Phase 2: Person modal field

### Overview
Let a user set, change, or clear a team member's contract type from the existing
person modal (FR-001, FR-002, FR-006).

### Required changes
#### 1. Contract type field
- **File**: `src/components/people/PersonModal.tsx`
- **Goal**: expose the new field in the same form that already edits
  `full_name`/`role`/`email`/`capacity_hours_per_day`/`avatar_color`.
- **Contract**: a `contractType` state seeded from `person?.contract_type ?? ''` on
  open (mirroring the existing seed pattern, `PersonModal.tsx:26-41`); a labeled
  native `<select>` (styled like `TimeOffModal.tsx`'s `Osoba` select) with an empty
  `""` option plus one `<option>` per `CONTRACT_TYPES` entry; on submit, the payload
  sent to `supabase.from('team_members').update/insert` (`PersonModal.tsx:49-59`)
  gains `contract_type: contractType || null` so an empty selection is stored as
  `null`, not `''`. No `required` attribute — creating/editing without choosing a
  value must keep working (FR-006).

### Success criteria
#### Automated
- [ ] `npm run lint` passes with no new errors
- [ ] `npm run build` succeeds
#### Manual
- [ ] AC-01: opening a team member with no contract type, selecting "B2B", and
  saving, then reopening the profile, shows "B2B" selected
- [ ] AC-05: clearing a previously set contract type and saving leaves the field
  unset (empty) on reopen, and the member sorts in the "no type" group afterward
- [ ] FR-006: creating a new team member, or saving an edit to an existing one,
  without choosing a contract type still succeeds

## Phase 3: Sort comparator

### Overview
Add the pure ordering logic the Timeline sort control will use, with unit coverage,
before wiring up any UI.

### Required changes
#### 1. Contract-type comparator
- **File**: `src/lib/utils.ts`
- **Goal**: a reusable, unit-testable function that orders people UoP → B2B →
  Freelance → unset, alphabetically by full name within each group (FR-004).
- **Contract**: `compareByContractType(a: TeamMember, b: TeamMember): number`,
  comparing each person's index in `CONTRACT_TYPES` (imported from `types.ts`;
  `null`/unset sorts after every known type) and falling back to
  `a.full_name.localeCompare(b.full_name)` on a tie — `localeCompare` matches this
  file's existing date-string sort precedent (`Timeline.tsx:52,75`).

#### 2. Unit tests
- **File**: `src/lib/utils.test.ts` (new)
- **Goal**: automated coverage for FR-004's exact ordering rule, runnable via
  `npm run test`, following the one existing test file's structure
  (`src/components/ThemeProvider.test.tsx`).
- **Contract**: covers (a) the AC-02 example set (Anna/Freelance, Bartek/UoP,
  Celina/B2B, Damian/UoP, Ewa/unset) sorts to Bartek, Damian, Celina, Anna, Ewa; (b)
  two people with the same contract type sort alphabetically by full name; (c) two
  unset people sort alphabetically by full name, after every typed person.

### Success criteria
#### Automated
- [ ] `npm run test` passes, including the new `utils.test.ts` cases
- [ ] `npm run lint` passes with no new errors

## Phase 4: Timeline sort control

### Overview
Wire the comparator into the Timeline UI as a second sort option alongside today's
default (FR-003, FR-005), leaving default behavior and existing filters untouched.

### Required changes
#### 1. Sort toggle state
- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: let the user switch the Timeline's people order between "Name" (default)
  and "Contract type" (FR-003).
- **Contract**: `const [sortMode, setSortMode] = useState<'name' | 'contractType'>('name')`;
  a small two-button toggle ("Nazwa" / "Typ umowy") placed in the top bar after the
  existing `SkillsFilter` (`Timeline.tsx:621-628`) and before the `ml-auto` group,
  styled like `PeopleClient.tsx`'s `groupMode` button group
  (`PeopleClient.tsx:113-124`).

#### 2. Apply the sort after filtering
- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: sort combines with the existing filters (FR-005, AC-04) and the default
  order is unchanged when "Name" is selected (AC-03).
- **Contract**: immediately after `filteredPeople` (`Timeline.tsx:503-511`), derive
  `sortedPeople = sortMode === 'contractType' ? [...filteredPeople].sort(compareByContractType)
  : filteredPeople`; `rowData` (`Timeline.tsx:514`) maps over `sortedPeople` instead of
  `filteredPeople`. `filteredPeople.length` (used for the "ZESPÓŁ · N" count,
  `Timeline.tsx:674`) is unchanged since sorting doesn't change the count.

### Success criteria
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with no new errors
#### Manual
- [ ] AC-02: with people Anna (Freelance), Bartek (UoP), Celina (B2B), Damian (UoP),
  Ewa (unset), switching the sort control to "Contract type" renders the rows in the
  order Bartek, Damian, Celina, Anna, Ewa
- [ ] AC-03: with the sort control left on "Name" (default), the Timeline lists
  people alphabetically by full name, exactly as before this change
- [ ] AC-04: with "Contract type" sort on and a role filter applied, only the
  filtered people are shown, still in contract-type order
- [ ] existing drag-and-drop (move/resize) and OOO behavior are unaffected by the
  new control

## Testing Strategy

- **Unit**: `src/lib/utils.test.ts` (new, Phase 3) covers the sort comparator's
  ordering rule in isolation via Vitest (`npm run test`), the same tool and pattern
  already used by `src/components/ThemeProvider.test.tsx`.
- **Type/build**: `npx tsc --noEmit`, `npm run build`, `npm run lint` gate every
  phase — the same automated checks this repo's prior plans (`theme-preference`,
  `add-roles`) rely on, since there is no CI (`context/foundation/tech-stack.md`).
- **Manual**: every acceptance criterion (AC-01 through AC-05) and the two preserved
  requirements (FR-005, FR-006) are hand-verified against a running dev instance, per
  each phase's `#### Manual` criteria — this repo has no live Supabase access from
  the agent, so the actual migration application (Phase 1) and the on-screen behavior
  (Phases 2 and 4) are manual-only checks, consistent with prior plans in this repo.

## Migration Notes

- **Forward**: `migrations/2026-09-25-team-member-contract-type.sql` adds a nullable
  `contract_type text` column plus a CHECK constraint to `public.team_members`. No
  default, no backfill — every existing row is already valid (`contract_type IS
  NULL`), satisfying the issue's explicit "nullable; no backfill required"
  constraint.
- **Rollback**: `alter table public.team_members drop constraint if exists
  team_members_contract_type_check; alter table public.team_members drop column if
  exists contract_type;` — safe: no dependent data, no other table or view
  references this column, nothing else is migrated by this change.

## References

- Issue #71: https://github.com/Rocksoft-IT/Rocksoft-planner/issues/71
- `context/changes/contract-type-sort/change.md` — full issue text (FR-001..006,
  AC-01..05)
- `migrations/2026-09-15-profile-theme.sql`, `context/changes/theme-preference/plan.md`
  — closest precedent for a nullable/checked enum-ish column + type + modal field
- `context/changes/add-roles/plan.md`, `context/changes/delete-person/plan.md` —
  confirm `team_members` has no `create table` in `supabase-schema.sql`
- `supabase-schema.sql:270-273` — the `tmc_years_experience_check` ALTER-guard
  pattern this change's schema mirror follows
- `src/components/people/PersonModal.tsx`, `src/components/timeline/Timeline.tsx`,
  `src/app/(dashboard)/people/PeopleClient.tsx`, `src/lib/types.ts`,
  `src/lib/utils.ts` — files this plan changes or cites

## Progress

### Phase 1: Schema + type
#### Automated
- [x] 1.1 npm run lint passes with no new errors — 98b5a38
- [x] 1.2 npx tsc --noEmit passes — 98b5a38
- [x] 1.3 the column/constraint text added to supabase-schema.sql matches the migration's column/constraint (agent-checkable diff) — 98b5a38
#### Manual
- [ ] 1.4 the migration applied via the Supabase Dashboard SQL editor on a dev/staging project leaves every existing team_members row with contract_type = null, and a direct update to 'UoP' / 'B2B' / 'Freelance' / back to null all succeed while any other value is rejected by the constraint

### Phase 2: Person modal field
#### Automated
- [x] 2.1 npm run lint passes with no new errors — b8cf8c7
- [x] 2.2 npm run build succeeds — b8cf8c7
#### Manual
- [ ] 2.3 AC-01: opening a team member with no contract type, selecting "B2B", and saving, then reopening the profile, shows "B2B" selected
- [ ] 2.4 AC-05: clearing a previously set contract type and saving leaves the field unset (empty) on reopen, and the member sorts in the "no type" group afterward
- [ ] 2.5 FR-006: creating a new team member, or saving an edit to an existing one, without choosing a contract type still succeeds

### Phase 3: Sort comparator
#### Automated
- [x] 3.1 npm run test passes, including the new utils.test.ts cases
- [x] 3.2 npm run lint passes with no new errors

### Phase 4: Timeline sort control
#### Automated
- [ ] 4.1 npm run build succeeds
- [ ] 4.2 npm run lint passes with no new errors
#### Manual
- [ ] 4.3 AC-02: with people Anna (Freelance), Bartek (UoP), Celina (B2B), Damian (UoP), Ewa (unset), switching the sort control to "Contract type" renders the rows in the order Bartek, Damian, Celina, Anna, Ewa
- [ ] 4.4 AC-03: with the sort control left on "Name" (default), the Timeline lists people alphabetically by full name, exactly as before this change
- [ ] 4.5 AC-04: with "Contract type" sort on and a role filter applied, only the filtered people are shown, still in contract-type order
- [ ] 4.6 existing drag-and-drop (move/resize) and OOO behavior are unaffected by the new control
