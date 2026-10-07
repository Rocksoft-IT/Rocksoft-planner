# Theme persistence fix — Plan Brief
Full plan: `context/changes/theme-persistence-fix/plan.md` · issue text: `change.md` · issue https://github.com/Rocksoft-IT/Rocksoft-planner/issues/68

## Complexity
LOW — one increment, one phase, two files (`ThemeProvider.tsx` and its test), no schema change. Skipped: rs-research (surface is three files, read directly; Jev unavailable in dry mode), rs-frame (feedback states only the observation; hypotheses checked inline against the code and recorded in plan.md Current State Analysis).

## Root cause (confidence MEDIUM)
The only code path that reverts the theme is the failed-save rollback at `ThemeProvider.tsx:68-82`. The most likely trigger is the `profiles.theme` column missing on the deployed database (manual SQL-editor migration, nothing proves it ran). The live DB is unreachable from here, so Phase 1 Manual criteria confirm it.

## Key decisions made
| Decision | Choice | Why | Source |
|---|---|---|---|
| Area split | A1 theme-persistence, one increment | Single concern, two files | Orchestrator |
| Research / framing | Both skipped | Small surface; cause hypotheses checked in code | Auto (Jev unavailable) |
| Approach | Visible failure message + richer console diagnosis + deployed-schema verification, keep rollback | Code cannot apply the migration; silent failure caused the ambiguity; dropping rollback hides the failure and loses the choice on reload | Consult |
| Where the message renders | Inside `ThemeProvider`, not the avatar menu | Menu closes on select before the async save fails; keeps scope to two files | Auto |
| Migration / schema / RLS | Unchanged | Existing migration is idempotent with rollback; RLS policy at `supabase-schema.sql:122` already permits the write | Auto |
| Test tooling | Vitest in `ThemeProvider.test.tsx` | Runner and tests already exist | Auto |

## Open risks & assumptions
- decision-to-verify: root cause is unconfirmed. If the live save succeeds (200, count 1, column present), the cause is elsewhere (stale build, second tab) and this plan becomes an investigation.
- The real fix for a missing column is a human SQL step; the PR must say so and must not read as "fixed" while the database is unmigrated.
