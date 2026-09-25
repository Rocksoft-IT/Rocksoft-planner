<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Add the missing team_members table to supabase-schema.sql

**Plan**: context/changes/supabase-schema-team-members/plan.md   **Scope**: full plan (Increment 1, Phase 1 — the only increment)   **Date**: 2026-09-25
**Round**: 1   **Verdict**: APPROVED   **Findings**: 4

## Verdicts
| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — `delete_team_member()` will still error on a fresh install because `public.time_off` was never created (pre-existing, out of scope)
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `supabase-schema.sql:522` (`delete from public.time_off where person_id = p_id;` inside `delete_team_member()`, added by an earlier, unrelated commit `0f06062`, not touched by this diff)
- **Detail**: `public.time_off` is referenced but never `create table`'d anywhere in the repo. Postgres does not validate object existence inside a `plpgsql` function body until the function is actually called, so `delete_team_member()` will raise `relation "public.time_off" does not exist` the first time anyone deletes a team member on a database provisioned from this script. This is a real, pre-existing bug — but it predates this change (confirmed via `git log -p`; the function is untouched by this diff), is explicitly named as a known, deliberately out-of-scope gap in the plan's Current State Analysis and "What we're NOT doing" (issue #74 only names `team_members`; adding `time_off` was scoped out as unrelated scope creep), and does not block the fresh-apply failure this issue is actually about (the script still runs to completion — the failure only happens later, at call time).
- **Fix**: none for this change; worth a follow-up issue to add `create table public.time_off (...)` so `delete_team_member()` works on a fresh install, but that is new scope, not a defect in this diff.
- **Decision**: ACCEPT — pre-existing, out of scope per the plan and issue #74, correctly identified and left alone rather than expanded into unrelated scope creep.

### F2 — RLS-enabled-with-zero-policies means `team_members` is unreadable/unwritable from the app until real policies are copied in
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `supabase-schema.sql:204-205` (`alter table public.team_members enable row level security;` with no `create policy`); consumed client-side at `src/app/(dashboard)/people/PeopleClient.tsx:32` (`.select('*')`) and `src/components/people/PersonModal.tsx:58-59` (`.insert()`/`.update()`)
- **Detail**: On a database freshly provisioned from this script, `select` against `team_members` returns zero rows (looks like an empty people directory) and `insert`/`update` fail with a generic Postgres permission error, until an admin copies the real production policies in by hand. This is exactly the trade-off the plan-brief already named and flagged for the human ("Open risks & assumptions: RLS is deliberately left with zero policies... worth flagging again here since it's a security-relevant gap") after an `rs-advisor` consult that reached agreement (fabricating policy text was correctly rejected as worse — it would create false confidence about production's real access rules). Fail-closed is the safer of the two options the plan considered.
- **Fix**: none required — this is the intended, reviewed, documented behavior. Optional future polish: the app could surface a clearer error when this happens, but that's unrelated to this issue.
- **Decision**: ACCEPT — matches the deliberate, already-consulted trade-off recorded in `plan-brief.md`'s Key decisions (row 2) and Open risks & assumptions.

### F3 — `team_members`' RLS-enable statement is placed inline, not grouped with the file's other RLS blocks
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: `supabase-schema.sql:204` vs. the file's two other RLS blocks at `supabase-schema.sql:114-116` (profiles/projects/allocations, grouped under "4. ROW LEVEL SECURITY") and `supabase-schema.sql:311-314` (competency-base tables, grouped at the end of that section)
- **Detail**: Every other table's `enable row level security` statement is grouped together with its siblings, separate from its `create table`. The new statement instead sits directly under `team_members`' own `create table`, inside its own single-table section. The plan's Current State Analysis describes the older tables' pattern as "each followed by its RLS ... block," which is not quite how the file actually reads (it's grouped, not per-table) — but the implementation followed the plan's explicit Contract instruction exactly, and a single-table section has nothing else to group the statement with.
- **Fix**: none — cosmetic only, no functional effect (a `create table` followed immediately by its own `alter table ... enable row level security` is valid and unambiguous SQL either way).
- **Decision**: DISMISS — matches the plan's Contract verbatim; the deviation is in the plan's own description of the existing pattern, not in the implementation, and has no functional consequence.

### F4 — `pnpm lint` (success criterion 1.3) fails, but identically on `origin/main` — pre-existing, unrelated to the two files this change touches
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Success Criteria
- **Location**: failures at `src/components/people/PersonModal.tsx` (effect `setState`), `src/components/timeline/AllocationModal.tsx:51`, `src/components/timeline/TimeOffModal.tsx:36`, `src/components/timeline/Timeline.tsx:656` — none of which are touched by this diff (`git diff origin/main...HEAD --name-only` shows only `README.md`, `supabase-schema.sql`, and the three `context/changes/...` files)
- **Detail**: Ran `pnpm lint` in this worktree: 5 errors, 3 warnings, exit 1. To confirm this is pre-existing, I checked out `origin/main` (278e892) into a separate temporary worktree, ran a fresh `pnpm install`, and ran `pnpm lint` there too: identical 5 errors / 3 warnings, same files, same line numbers. This change touches only a `.sql` file and `README.md`, neither of which ESLint lints. The plan's own criterion assumed a clean lint baseline that was already false before this change; the implementer's Progress row 1.3 ("`pnpm lint` passes — af201e2") is technically inaccurate as literally worded but does not reflect anything this diff broke.
- **Fix**: none for this change; the pre-existing lint failures should be tracked and fixed as their own, separate piece of work.
- **Decision**: ACCEPT — proven identical on `origin/main` with a fresh install in an isolated worktree; not caused, worsened, or masked by this diff.

## Automated success criteria — verified
- `grep -n "create table if not exists public.team_members" supabase-schema.sql` → matches at line 193; both referencing FKs (`references public.team_members(id)`) are at lines 229 and 242, both after it. **PASS.**
- `grep -n "create table if not exists public.team_members\|create table if not exists public.time_off" supabase-schema.sql` → matches only `team_members` (line 193); no `time_off` table was added. **PASS.**
- `pnpm lint` → fails (5 errors, 3 warnings), confirmed pre-existing and identical on `origin/main`; see F4. Not treated as a criterion this diff broke.

## Manual success criteria — pending (for the human on the preview / a real database)
- [ ] 1.4 Apply `supabase-schema.sql` to a genuinely empty Postgres/Supabase database and confirm it runs to completion past the `team_members` foreign keys.
- [ ] 1.5 Read the new comment in `supabase-schema.sql` and the new README paragraph and confirm they clearly convey that `team_members`'s RLS policies must be copied from the live project before the table serves real traffic.

## Plan-drift subagent summary
Independent read-only check of every planned change against the real diff: all 8 checked items MATCH (column contract, section renumbering 7→8, table defined before both referencing FKs, RLS enabled with zero policies, explanatory comment present and mentions `time_off`, no `time_off` table added, README addition is a clean insertion with no wording changes, no out-of-scope files touched). No DRIFT, MISSING, or EXTRA items found.
