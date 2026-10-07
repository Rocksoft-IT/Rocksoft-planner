<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Theme preference (light/dark)

**Plan**: context/changes/theme-preference/plan.md   **Scope**: Increment 4 (Phase 10, Kompetencje theming), feedback cycle 1   **Date**: 2026-10-07
**Round**: 1   **Verdict**: NEEDS_ATTENTION   **Findings**: 1

## Verdicts
| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Client feedback reviewed
- piotrczyz, PR #88: "Prosze popraw konflikty" (please fix the conflicts). Verified: `gh` reports the PR as CONFLICTING because increments 2/4 (PR #86) and 3/4 (PR #87) merged into `origin/main` after this branch was cut. No functional complaint about the Kompetencje screen.

## Findings

### F1 — Branch conflicts with origin/main (increments 2 and 3 merged meanwhile)
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `context/changes/theme-preference/{change.md,plan.md,reviews/fix-r1.md,reviews/pr-summary.md}`
- **Detail**: Quote: "Prosze popraw konflikty". `git merge-tree origin/main HEAD` (and a trial merge in a throwaway worktree, since removed) shows the conflicts are confined to the change-tracking files under `context/`; no source file conflicts. The increment's code (`CompetenciesClient.tsx`, `CompetencyEditor.tsx`, `TagMultiSelect.tsx`) is disjoint from everything main gained (People, Projects, Timeline, shared `ui/*`, contract-types parity test), so the code merges textually clean. Per-file picture:
  - `change.md`: branch has `status: implemented` (no `archived_at`, after the reopen); main has `status: implementing`, `archived_at: null`.
  - `plan.md` `## Increments`: branch has rows 2 and 3 `in-progress`, row 4 `done`; main has rows 2 and 3 `done`, row 4 `in-progress`.
  - `reviews/fix-r1.md`: add/add. Main's file is increment 3's fix round 1; the branch's is increment 4's. They are different documents sharing a name.
  - `reviews/pr-summary.md`: add/add-style content conflict; main holds increment 3's summary, the branch holds increment 4's.
  Trial-merge evidence (code taken from the merged tree, `context/` resolved arbitrarily): `npm run build` exit 0 (all routes listed); `npm test` 3 files / 19 tests passed; `npm run lint` 4 errors / 3 warnings, all pre-existing in `ProjectModal`, `AllocationModal`, `TimeOffModal`, `Timeline`, `PeopleClient`, none in the competencies files (same set as r2 of this increment). So the merged code is healthy; only the bookkeeping needs a correct resolution.
- **Fix**: In the increment worktree run `git merge origin/main` (a merge commit, never rebase or force-push; subject `chore(theme-preference): merge main into increment 4`, as increment 3 did) and resolve:
  1. `plan.md` `## Increments`: rows 2 and 3 = `done` (main), row 4 = `done` (branch); every other line from main. Check that `## Progress` keeps all increment 4 rows `[x]` and that increments 2/3 rows from main are kept.
  2. `change.md`: `status: implemented` (all four increments done), `updated: 2026-10-07`; either form of `archived_at` (absent or `null`) is acceptable.
  3. `reviews/fix-r1.md`: keep main's version unchanged (increment 3's evidence). Save increment 4's content as `reviews/fix-inc-4-r1.md` (git mv-style: take the branch version out of the conflict, add under the new name). Do not merge the two texts.
  4. `reviews/pr-summary.md`: take the branch (increment 4) version; this review rewrites it anyway, so the reviewer's next commit overrides it.
  5. Keep every other file from main untouched (`feedback-inc-3-1.md`, `fix-feedback-1-r1.md`, `impl-review-inc-3*.md`, `impl-review-inc-2.md`). Keep this increment's `impl-review-inc-4.md`, `feedback-inc-4-1.md` and this report.
  6. Code: no manual edits expected. Confirm `git diff origin/main...HEAD -- src` still shows only the three competencies files after the merge, and no `light:` override from increments 2/3 was dropped (`git diff origin/main -- src` limited to those three files).
  7. Re-run `npm run build`, `npm run lint` (expect only the 4 errors / 3 warnings listed above, none in the competencies files) and `npm test` (expect all green). Record the commands with their last lines in `reviews/fix-inc-4-feedback-1-r1.md` (main already owns `fix-feedback-1-r1.md` for increment 3). No new test is required: no behaviour changes, so there is no red-first proof.
  8. Pushing is the caller's job; afterwards verify with `git merge-tree` / `gh pr view 88 --json mergeable` that the PR is no longer CONFLICTING.
- **Decision**: FIXED (1adf977) — real merge conflict blocks the PR; one unambiguous resolution (take main for increments 2/3 state, branch for increment 4 state).

## Plan-drift classification
- In plan AND diff: unchanged since r2 of this increment (three competencies files).
- In diff NOT plan: none beyond `context/` bookkeeping.
- In plan NOT diff: `ExperienceModal.tsx` (already themed on the base, ACCEPT in `impl-review-inc-4.md` F2).

## Success criteria
| Criterion | Result |
|---|---|
| 10.1 `npm run build` (trial-merged tree) | PASS |
| 10.2 `npm run lint` (trial-merged tree) | PASS for this diff: 4 errors / 3 warnings, all pre-existing outside the competencies files |
| `npm test` (trial-merged tree) | PASS (3 files, 19 tests) |
| 10.3 no diff under `src/app/api/` or `mcp/` | PASS |
| 10.4 (manual) Kompetencje in both themes | PENDING for the client's preview; unchanged by this feedback |

Architecture gate: `context/architecture/model.c4` not present, SKIPPED (no boundary change).

## Notes
- Round-3 rule: not reached (feedback cycle 1, round 1).
