# Fix evidence: feedback cycle 1, round 1 (F1)

Finding F1: branch conflicted with `main` after increment 2 merged. Docs-only fix; no test to prove red-first.

- `git fetch origin` then `git merge origin/main`: conflicts in exactly `plan.md` and `reviews/pr-summary.md`.
- `plan.md` `## Increments`: rows 2 and 3 both `done`, row 4 `in-progress`, PR column unchanged. `## Progress` left as git merged it (rows 5.x-9.x checked).
- `reviews/pr-summary.md`: kept this branch's version (increment 3). `impl-review-inc-2.md` taken from `main`.
- No `src/` file edited by hand; `src/` changes come only from `main` (increment 2's 7 files).
- Merge commit: `31634c4` `chore(theme-preference): merge main into increment 3`. No conflict markers remain.
- `npm run build`: exit 0 (all routes built).
- `npm run lint`: exit 1, `✖ 7 problems (4 errors, 3 warnings)`, identical to the round 2 baseline; all pre-existing.
