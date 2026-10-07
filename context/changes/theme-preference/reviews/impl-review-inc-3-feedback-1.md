<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Planners can switch RS Planner between dark and light theme

**Plan**: context/changes/theme-preference/plan.md   **Scope**: Increment 3 (Phases 8-9), feedback cycle 1 (`reviews/feedback-inc-3-1.md`)   **Date**: 2026-10-07
**Round**: 2   **Verdict**: APPROVED   **Findings**: 1

## Verdicts
| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Feedback (two comments by piotrczyz on PR #87: "resolve conflicts", "please resolve conflicts") is about the branch not merging into `main`, not about delivered behaviour. Increment 3's code was approved in `impl-review-inc-3.md` (round 2) and is not re-reviewed here.

Evidence gathered:
- PR #86 (increment 2) merged into `main` as `19a3cca` after this branch was cut (merge-base `8e52445`).
- A trial `git merge origin/main` conflicts in exactly two files, both under `context/`: `context/changes/theme-preference/plan.md` (the `## Increments` rows 2 and 3) and `context/changes/theme-preference/reviews/pr-summary.md` (both increments rewrote the whole file). All `src/` files merge cleanly: `main` brings in increment 2's 7 Timeline/filter files, the branch carries increment 3's 5 People/Projects files, no overlap, and none of increment 2's components (`ContractTypeBadge`, `MonthPicker`, `PeopleFilter`, `ProjectFilter`, `SkillsFilter`, `Timeline`) is used by the People or Projects pages.
- On the merged tree (trial merge, then aborted so the branch is untouched): `npm run build` exit 0 (all routes incl. /people, /projects, /timeline); `npm run lint` unchanged from the round 2 baseline (4 errors + 3 warnings, all pre-existing, none in files this increment touches).
- The `## Progress` section of `plan.md` merges automatically and correctly (rows 5.x-7.x checked from `main`, rows 8.x-9.x checked from this branch, same SHAs); only the `## Increments` table needs a hand merge.

## Findings
### F1 — Branch conflicts with `main` after increment 2 merged
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `context/changes/theme-preference/plan.md:67-68` (`## Increments` rows 2 and 3); `context/changes/theme-preference/reviews/pr-summary.md` (whole file)
- **Detail**: Client comments (verbatim): "resolve conflicts", "please resolve conflicts". The PR cannot be merged as it stands. The conflict is bookkeeping only: on `main` row 2 is `done` and row 3 `in-progress`; on this branch row 2 is `in-progress` and row 3 `done`. The correct merged state is both rows `done` (row 4 stays `in-progress`). `pr-summary.md` on `main` describes increment 2 (Timeline); on this branch it describes increment 3 and must stay increment 3's.
- **Fix**: In this worktree run `git merge origin/main`. In `plan.md` resolve the `## Increments` conflict to rows `2 ... done` and `3 ... done` (row 4 unchanged, PR column unchanged); leave `## Progress` as git merges it. In `reviews/pr-summary.md` keep this branch's version (increment 3's summary, as rewritten in this feedback round) and drop `main`'s. Keep `impl-review-inc-2.md` from `main`. Do not touch any `src/` file. Commit the merge as `chore(theme-preference): merge main into increment 3`, run `npm run build` and `npm run lint` (expect exit 0 and the baseline above), and record the result in `reviews/fix-r1.md` (the existing file is round 1 of the review cycle; name the new one `reviews/fix-feedback-1-r1.md`).
- **Decision**: FIXED (31634c4) — a real blocker on the PR; one unambiguous resolution, no judgment call.

## Round 1 (feedback cycle 1)
Next: `rs-implement theme-preference increment 3 --from-review context/changes/theme-preference/reviews/impl-review-inc-3-feedback-1.md`, then re-review. Increment 3 is not the last increment (increment 4 pending), so `change.md` status stays `implementing`.
Manual 8.3 / 9.3 remain pending (human on preview).

## Round 2
Re-review of merge commit `31634c4` and `d480730` (read `fix-feedback-1-r1.md` and the commits; full suite not re-run, the fix is a merge and carries no tests).
- F1: `origin/main` (`19a3cca`) is now an ancestor of `HEAD`, so the PR no longer conflicts. No conflict markers in `plan.md` or `reviews/pr-summary.md`.
- `plan.md` `## Increments`: rows 1, 2, 3 `done`, row 4 `in-progress`, PR column unchanged. `## Progress` rows 5.x-9.x automated checked with their original SHAs; manual rows still pending.
- `git diff origin/main HEAD` outside `context/` is exactly increment 3's 5 files (`PeopleClient`, `ProjectsClient`, `PersonModal`, `ColorPicker`, `RoleSelect`); no hand edits to `src/`. `ACCEPT` findings of the round 2 review were not touched.
- Re-ran `npm run build` on the merged tree: exit 0. Lint matches the baseline per `fix-feedback-1-r1.md` (4 errors, 3 warnings, all pre-existing; unchanged from my trial merge in round 1).
- Manual 8.3 / 9.3 remain pending (human on preview). Increment 3 is not the last increment; `change.md` status is untouched.
