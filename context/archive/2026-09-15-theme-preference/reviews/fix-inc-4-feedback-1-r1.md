# Fix evidence: increment 4, feedback cycle 1, round 1

Finding F1 (branch conflicts with origin/main). Resolved by merging `origin/main` into
`feat/theme-preference/4` (merge commit, no rebase, no force). No behaviour change, so no
red-first proof applies.

## Resolution
- `plan.md` `## Increments`: rows 2 and 3 `done` (main), row 4 `done` (branch); `## Progress` rows kept for all increments.
- `change.md`: `status: implemented`, `updated: 2026-10-07`, no `archived_at`.
- `reviews/fix-r1.md`: main's version (increment 3), unchanged. Increment 4's content saved as `reviews/fix-inc-4-r1.md`.
- `reviews/pr-summary.md`: branch (increment 4) version.
- Code: `git diff origin/main --name-only -- src mcp` lists only the three competencies files
  (`CompetenciesClient.tsx`, `CompetencyEditor.tsx`, `TagMultiSelect.tsx`).

## Commands
- `npm run build`: exit 0 (all routes listed, last lines: `ƒ Proxy (Middleware)`, Static/Dynamic legend).
- `npm run lint`: exit 1, `✖ 7 problems (4 errors, 3 warnings)`; all in pre-existing files
  (`ProjectModal`, `AllocationModal`, `TimeOffModal`, `Timeline`, `PeopleClient`), none in the competencies files. Same set as the review report expected.
- `npm test`: exit 0, `Test Files 3 passed (3)`, `Tests 19 passed (19)`.
