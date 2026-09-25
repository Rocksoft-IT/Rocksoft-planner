# Add the missing team_members table to supabase-schema.sql — Plan Brief
Plan: `plan.md`. No `research.md` / `frame.md` for this change — see "Why
research/frame were skipped" below.

## What & why
`supabase-schema.sql` claims (README.md) to be a runnable, from-scratch
mirror of the database, but has never defined `create table
public.team_members`, even though two of its own tables FK to it. A fresh
apply fails there. This adds the missing table and is honest, in both files,
about the one thing that can't be safely reconstructed: `team_members`' real
production RLS policies.

## Why research/frame were skipped
The issue names the exact gap and its exact location (`supabase-schema.sql`
lines ~193/206), and the fix's shape (add a table, or document a limitation)
was fully decidable by reading `supabase-schema.sql`, `migrations/`, `git
log -p` on the schema file, and the handful of files that touch
`team_members` in `src/`. No unfamiliar subsystem, no multi-module trace, and
the issue's own framing ("either add X or document Y") is already the
correct decision space — nothing to reframe. Research/frame would have
re-derived the same file:line evidence gathered directly during planning.

## Starting point
`supabase-schema.sql` defines every table it needs *except* `team_members`
(and, less urgently, `time_off`) — a gap present since the repo's first
commit, not new drift. Production has a real, working `team_members` table
with RLS policies that were never captured in any tracked SQL file.

## Desired end state
A from-scratch apply of `supabase-schema.sql` gets past the `team_members`
FKs. The file and the README both flag, in one sentence each, that
`team_members`'s RLS policies (and `time_off`'s table itself) are not
captured here and must come from the live project.

## Complexity
**LOW.** The diff is small (one new `create table` + comment in one file,
one new paragraph in another), but reaching it required real investigation
(confirming via `git log -p` that the gap predates this repo's tracked-SQL
convention entirely) and one `rs-advisor` consult over a security-boundary
choice (whether to also fabricate RLS policy text) — which disqualifies
TRIVIAL ("no consults") even though the resulting change is tiny.

## Key decisions made
| Decision | Choice | Why | Source |
|---|---|---|---|
| Add the table, or document as reference-only (issue's own two suggested options) | Add `create table public.team_members (...)` | README.md:34-36 already documents supabase-schema.sql as meant to "always reflect the current state of the database" and provision a fresh project — documenting it as reference-only would contradict that existing, current convention rather than restore it; the table's columns are corroborated by three independent sources (TS type, call sites, sibling table style) | Auto (README.md:32-43 + supabase-schema.sql:10-77 style) |
| Whether to also add RLS policies for team_members, given RLS is a security boundary and the real policy text was never captured in git | Add the table, enable RLS, add **no** policies (fail closed); document the gap instead of guessing policy predicates | rs-advisor: columns are corroborated by 3 independent sources (high confidence) but the RLS predicate is only inferred from absence-of-client-side-gating (medium confidence at best) — this repo's own prior work (delete-team-member migration) already shows a deliberate pattern of routing around unconfirmed RLS via explicit checks rather than guessing policy text, and the same posture fits here | Consult (rs-advisor, one round, agreement) |
| Enable RLS with zero policies vs. leave RLS disabled entirely on the new table | Enable RLS, zero policies (fail closed) | rs-advisor's recommended option left RLS disabled, which it flagged itself as "wide open" under Supabase's default schema grants until real policies are applied; enabling RLS with no policies keeps the same "don't invent policy text" posture while defaulting to deny-all instead of allow-all — strictly safer, same non-fabrication guarantee | Auto (refinement of the consult, grounded in the advisor's own stated risk) |
| Whether to also add `create table public.time_off (...)` | No — document the same gap in one line, don't create it | Not named in issue #74; unlike `team_members` it doesn't block a from-scratch apply (only referenced inside a function body, which Postgres doesn't validate until call time) — adding it would be scope creep on a low-severity, single-file issue | Auto (issue text; supabase-schema.sql:486 usage context) |
| Increment/phase cut | One increment, one phase | Two small, tightly-coupled file edits (schema comment/table, README caveat) verified together; matches the issue's own "low severity, non-blocking, single-file-plus-doc" framing and the task's explicit steer against over-scoping | Auto (issue text) |

## Scope
**In:** `create table if not exists public.team_members (...)` in
`supabase-schema.sql`, placed before its referencing FKs; `alter table ...
enable row level security` with no policies; an explanatory comment; a
short new README.md paragraph documenting the `team_members`/`time_off` gap.

**Out:** Any `create policy` text for `team_members`; a `create table` for
`time_off`; any change to `migrations/`, to the live/production database, or
to the unrelated `allocations.person_id` vs. `team_members.id` id-space
question raised in `migrations/2026-09-01-delete-team-member.sql:24-30`.

## Architecture / Approach
See `plan.md` "Implementation Approach". In short: reconstruct only what's
well-evidenced (columns), fail closed on what isn't (RLS), and say so in
both places a future reader would look (the file itself, the README).

## Increments at a glance
| # | Delivers | Depends on | User-visible | Key risk |
|---|---|---|---|---|
| 1 | `team_members` table + RLS-gap documentation in schema file and README | — | no | The reconstructed column list could still diverge from production's real `team_members` (e.g. an untracked column); mitigated by citing 3 independent corroborating sources and by this table only affecting *fresh* installs, never the live database. |

## Phases at a glance
| Phase | Increment | Delivers | Key risk |
|---|---|---|---|
| 1 | 1 | `create table public.team_members` + RLS enable (no policies) + comment; README caveat paragraph | No automated way in this repo/environment to actually apply the script against a live Postgres — covered by an ordering-based automated check plus a manual apply criterion. |

## Open risks & assumptions
- **Assumption:** the corroborated column list (`id, full_name, role, email,
  capacity_hours_per_day, avatar_color, created_at, updated_at`) matches
  production closely enough for the FKs and functions that reference
  `team_members` to keep working; not independently verified against a live
  `pg_dump`. If wrong, only fresh installs are affected (production is
  untouched).
- **decision-to-verify (soft guard):** RLS is deliberately left with zero
  policies on the new table. Anyone provisioning a fresh project from this
  script must copy `team_members`'s real select/insert/update policies from
  the live project before the people directory will work end-to-end — called
  out in both the schema comment and the README paragraph, but worth
  flagging again here since it's a security-relevant gap.
- **Non-goal reminder:** `public.time_off` still has no `create table`
  anywhere in this repo; it's out of scope here (see Key decisions).

## Success criteria (summary)
- `supabase-schema.sql` defines `public.team_members` before the two foreign
  keys that reference it (automated ordering check).
- No `create table public.time_off` was added (automated check — confirms
  scope was held).
- `pnpm lint` still passes.
- A human applying `supabase-schema.sql` to an empty database confirms it
  runs to completion past the `team_members` FKs, and that the new
  comment/README paragraph clearly flag the RLS gap (manual).
