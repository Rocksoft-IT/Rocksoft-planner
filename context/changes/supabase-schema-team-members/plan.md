# Add the missing team_members table to supabase-schema.sql — Implementation Plan

## Overview
`supabase-schema.sql` is supposed to be a runnable, from-scratch mirror of the
database (README.md's "Database migrations" section says so explicitly), but
it has never once defined `create table public.team_members`, even though two
of its own tables declare a foreign key to it. A fresh apply of the script
fails at that FK before it reaches anything else. This change adds the
missing table (reconstructed from its TypeScript shape and call sites) and
documents, in both the script and the README, the one thing that
reconstruction can't safely cover: `team_members`' real production RLS
policies, which were never captured in git either.

## Current State Analysis
- `supabase-schema.sql:10-77` defines `profiles`, `projects`, and
  `allocations` with `create table if not exists`, each followed by its RLS
  `alter table ... enable row level security` and `create policy` block
  (`supabase-schema.sql:112-154`). This is the file's established pattern for
  every table it actually defines.
- `supabase-schema.sql:191-206` (`team_member_competencies`,
  `project_experience`) both declare `team_member_id uuid not null references
  public.team_members(id) on delete cascade` — but `public.team_members` is
  never created anywhere earlier in the file, or anywhere else in it.
  Applying the script from scratch fails here with `relation
  "public.team_members" does not exist`.
- `public.team_members` is also queried directly by
  `can_edit_member` (`supabase-schema.sql:304-314`), `search_experts`
  (`supabase-schema.sql:349-414`), and `delete_team_member`
  (`supabase-schema.sql:474-496`).
- `git log -p --follow -- supabase-schema.sql` shows `team_members` was
  absent even from the repo's very first commit (`594c4f6`, "initial
  commit") — this is not new drift introduced by a recent change, it has
  never once been defined in any tracked SQL file (`supabase-schema.sql` or
  anything under `migrations/`).
- `public.time_off` has the identical gap (referenced at
  `supabase-schema.sql:486` and in `migrations/2026-09-01-delete-team-member.sql:49`,
  never created anywhere), but it does not block a from-scratch apply: its
  only reference is inside a `plpgsql` function body, and Postgres does not
  validate object existence inside a function body until the function is
  actually called, only at parse/compile time for syntax.
- `migrations/2026-09-01-delete-team-member.sql:7-9`'s own comment states
  "`public.team_members` has RLS enabled with NO delete policy" — i.e. RLS is
  enabled on the live table with working `select`/`insert`/`update` policies,
  none of which are captured in any tracked file.
- `src/components/people/PersonModal.tsx:49-59` performs client-side (RLS-
  gated, non-admin) `.insert()`/`.update()` directly against `team_members`
  today in production, and `src/app/(dashboard)/people/PeopleClient.tsx:32`
  does a client-side `.select('*')` — confirming those policies are real and
  currently load-bearing, we just don't have their text.
- `src/lib/types.ts:14-23` gives the `TeamMember` shape: `id`, `full_name`,
  `role`, `email`, `capacity_hours_per_day`, `avatar_color`, `created_at`,
  `updated_at`. Corroborated by `PersonModal.tsx:49-55` (the insert/update
  payload) and by the sibling `profiles` table's identical
  `capacity_hours_per_day numeric(4,1) not null default 8` /
  `avatar_color text not null default '#6366f1'` columns
  (`supabase-schema.sql:15,17`) and `src/lib/utils.ts:124-127`'s
  `AVATAR_COLORS[0] === '#6366f1'`.
- `README.md:32-43` ("Database migrations") currently states, unconditionally,
  that `supabase-schema.sql` "is the consolidated schema used to provision a
  fresh Supabase project — it always reflects the current state of the
  database." That claim is currently false for `team_members` and
  `time_off`.

### Key discoveries
- `supabase-schema.sql:191-206` — the two FKs that make the fresh apply fail.
- `migrations/2026-09-01-delete-team-member.sql:7-9,24-30` — the only place in
  the repo that describes `team_members`' real RLS posture and the
  `person_id` vs `team_members.id` id-space caveat.
- `src/lib/types.ts:14-23` and `src/components/people/PersonModal.tsx:49-59` —
  the corroborated column list.
- `README.md:34-36` — the documented (and currently inaccurate) convention
  that this change either has to satisfy or explicitly caveat.

## Desired End State
Running `supabase-schema.sql` against a genuinely empty Postgres/Supabase
database no longer fails with a missing-relation error: `public.team_members`
now exists before anything references it. The script and the README both say,
in one place each, that `team_members`' (and `time_off`'s) real RLS policies
were never captured in git and must be copied from the live project — so
nobody mistakes the new table for a verified, complete mirror.

## What we're NOT doing
- Not inventing `create policy` text for `public.team_members`: the real
  predicates were never committed anywhere in this repo, and RLS is a
  security boundary — fabricating it would create false confidence that the
  fresh-install schema matches production's real access rules. `rs-advisor`
  was consulted specifically on this point (see Key decisions in
  `plan-brief.md`).
- Not adding `create table public.time_off (...)`: it isn't named in issue
  #74, and, unlike `team_members`, its absence does not block a from-scratch
  apply (it's referenced only inside a function body). It gets a one-line
  documentation mention alongside `team_members`, nothing more.
- Not touching the live/production database. `supabase-schema.sql` is only
  used to provision a *fresh* project; every already-provisioned database
  goes through `migrations/` instead (per `README.md:37-43`). This change
  edits a static file, not a running schema.
- Not resolving the `allocations.person_id` vs `team_members.id` id-space
  question flagged in `migrations/2026-09-01-delete-team-member.sql:24-30` —
  unrelated to this issue.

## Implementation Approach
Add `create table if not exists public.team_members (...)` using the
corroborated column list, placed immediately before the "COMPETENCY BASE"
section (the first place in the file that actually needs it), matching the
file's existing comment-block-plus-DDL style. Enable row-level security on
it but add **no** policies: this fails closed (all access denied) rather
than leaving the table wide open under Supabase's default schema grants,
which is the safer of the two behaviors available without inventing real
policy text. Document the gap — for both `team_members` and `time_off` — in
a comment directly above the new table and in a short new paragraph in
`README.md`'s "Database migrations" section, so the file's own claim to
"always reflect the current state" gets an honest caveat instead of staying
silently wrong. This was decided via one `rs-advisor` consult weighing three
options (fabricate RLS too / document-only, no table / add the table without
inventing RLS); see `plan-brief.md` Key decisions for the full reasoning.

## Increments
| # | Name | Phases | Depends on | User-visible | Status | PR |
|---|---|---|---|---|---|---|
| 1 | team_members table + doc caveat | 1 | — | no | pending | — |

## Phase 1: Add team_members and document the RLS gap
### Overview
Add the missing table so a from-scratch apply of `supabase-schema.sql` gets
past the FK it currently fails on, and make the RLS/`time_off` gap explicit
in the file and in the README.

### Required changes
#### 1. supabase-schema.sql
- **File**: `supabase-schema.sql`
- **Goal**: Define `public.team_members` before the two FKs that reference
  it (`team_member_competencies`, `project_experience`), so a fresh apply no
  longer fails with `relation "public.team_members" does not exist`. Enable
  RLS on it (fail closed) without adding policies, and add a comment block
  explaining why no policies are included and that `public.time_off` has the
  same never-captured-in-git gap (without creating it).
- **Contract**: `create table if not exists public.team_members (id uuid
  primary key default gen_random_uuid(), full_name text not null default '',
  role text not null default '', email text not null default '',
  capacity_hours_per_day numeric(4,1) not null default 8, avatar_color text
  not null default '#6366f1', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now())`, placed before the existing
  "COMPETENCY BASE" section (renumbered from `7.` to `8.` since this becomes
  the new `7.`), followed by `alter table public.team_members enable row
  level security;` and no `create policy` statements.

#### 2. README.md
- **File**: `README.md`
- **Goal**: Correct the "Database migrations" section's unconditional "always
  reflects the current state of the database" claim with a short caveat
  naming `team_members` and `time_off` as pre-existing tables this
  convention never tracked, so a future reader isn't misled into treating
  the new `create table public.team_members` as a verified mirror of
  production (in particular its RLS policies).
- **Contract**: One additional paragraph after the existing "Database
  migrations" text (`README.md:32-43`); no change to the existing wording,
  only an addition.

### Success criteria
#### Automated
- [ ] `grep -n "create table if not exists public.team_members" supabase-schema.sql` matches, and its line number is lower than the line number of `references public.team_members(id)` (i.e. the table is defined before the FKs that need it).
- [ ] `grep -n "create table if not exists public.team_members\|create table if not exists public.time_off" supabase-schema.sql` matches only `team_members` — confirms `time_off` was deliberately not added as a table.
- [ ] `pnpm lint` passes (no code files are touched, but confirms the change didn't accidentally break anything picked up by lint).

#### Manual
- [ ] Apply `supabase-schema.sql` to a genuinely empty Postgres/Supabase database and confirm it runs to completion without a "relation does not exist" error (this repo has no local Postgres/CI harness to automate that run).
- [ ] Read the new comment in `supabase-schema.sql` and the new README paragraph and confirm they clearly convey that `team_members`'s RLS policies must be copied from the live project before the table serves real traffic.

## Testing Strategy
No unit/integration tests apply — this is a SQL provisioning script and a
README paragraph, neither exercised by `vitest`. Verification is the Phase 1
success criteria above: an ordering check that can be automated, plus a
manual from-scratch apply that only a human with database access can run.

## Migration Notes
This change does not migrate any live database — `supabase-schema.sql` is
only used to provision a brand-new project (per `README.md:37-43`); every
already-provisioned database goes through `migrations/` instead, and none of
those files change here. There is nothing to roll back beyond reverting this
commit's two files.

## References
- Issue: https://github.com/Rocksoft-IT/Rocksoft-planner/issues/74
- `supabase-schema.sql:10-77,112-154,191-206,304-414,474-496`
- `migrations/2026-09-01-delete-team-member.sql:7-30,49`
- `src/lib/types.ts:14-23`
- `src/components/people/PersonModal.tsx:49-59`
- `src/app/(dashboard)/people/PeopleClient.tsx:32`
- `README.md:32-43`

## Progress

### Phase 1: Add team_members and document the RLS gap
#### Automated
- [ ] 1.1 `create table if not exists public.team_members` appears in supabase-schema.sql before its referencing foreign keys
- [ ] 1.2 `time_off` was not added as a table (documentation-only)
- [ ] 1.3 `pnpm lint` passes
#### Manual
- [ ] 1.4 A fresh apply of supabase-schema.sql on an empty database runs to completion past the team_members FKs
- [ ] 1.5 The new comment and README paragraph clearly convey the RLS gap
