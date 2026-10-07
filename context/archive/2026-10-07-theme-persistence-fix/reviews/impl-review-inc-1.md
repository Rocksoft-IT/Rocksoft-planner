<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Theme persistence fix

**Plan**: context/changes/theme-persistence-fix/plan.md   **Scope**: increment 1 (phase 1)   **Date**: 2026-10-07
**Round**: 1   **Verdict**: APPROVED   **Findings**: 2

Diff is two code files (`src/components/ThemeProvider.tsx`, `ThemeProvider.test.tsx`), both planned; reviewed inline, no subagents. Not bug mode.

## Verdicts
| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS (no `model.c4` gate applicable: no cross-package or boundary change) |
| Pattern Consistency | PASS |
| Success Criteria | PASS (automated); manual pending |

## Success criteria run
- `npx vitest run`: 3 files, 27 tests passed (ThemeProvider: 15).
- `npm run build`: exit 0.
- `npm run lint`: 4 errors, 3 warnings, all in files this diff does not touch (`PeopleClient.tsx`, `ProjectModal.tsx`, `AllocationModal.tsx`, `TimeOffModal.tsx`, `Timeline.tsx`); `eslint` on the two changed files exits 0.

## Plan adherence notes
- `ThemeProvider.tsx:78-106`: alert state set only in the non-superseded rollback branch (`:102-103`), cleared on toggle (`:119`) and on success (`:108`), dismissible (`:~140`). `useTheme()` shape, serialization and queued retry untouched. Console error carries code/details/hint and a migration pointer for `42703` / `PGRST204` / "theme column" messages (`:80-91`).
- Tests cover every case the plan lists (rollback+alert, 0-row, migration hint, no hint for unrelated error, dismiss, next-toggle clear, success, superseded write).

## Findings
### F1 — Lint criterion fails repo-wide on pre-existing errors
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Success Criteria
- **Location**: `src/components/timeline/Timeline.tsx:706` and four other files
- **Detail**: Criterion 1.2 "npm run lint passes" cannot be literally true; all errors are outside this diff (react-hooks/refs etc.). The changed files lint clean.
- **Fix**: none in this increment; fix the unrelated lint errors in their own change.
- **Decision**: ACCEPT — pre-existing, out of scope (plan "NOT doing" excludes Timeline).

### F2 — Root cause unconfirmed; the real fix is a human SQL step
- **Severity**: OBSERVATION
- **Impact**: MEDIUM
- **Dimension**: Plan Adherence
- **Location**: plan.md Phase 1 Manual 1.4-1.7; `migrations/2026-09-15-profile-theme.sql`
- **Detail**: The code only surfaces and diagnoses the failure. If `profiles.theme` is missing on the deployed DB, the theme keeps reverting (now with a visible message) until the migration is applied. Manual rows cannot be verified from diff evidence (live Supabase unreachable). Recorded in brief as decision-to-verify.
- **Fix**: human applies the migration, then checks 1.4-1.7 on the preview.
- **Decision**: ACCEPT — deliberate trade-off (brief, Key decisions "Approach", Consult).

## Round 1
First review. Verdict APPROVED; no FIX findings. Manual criteria 1.4-1.7 remain pending for the human.
