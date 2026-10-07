<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Contract-type SQL/TS parity test

**Plan**: context/changes/contract-type-shared-source/plan.md   **Scope**: increment 1 (phase 1)   **Date**: 2026-10-07
**Round**: 1   **Verdict**: APPROVED   **Findings**: 1

## Verdicts
| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS (by inspection; see note) |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings
### F1 — Repository-wide `npm run lint` already fails on unrelated files
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Success Criteria
- **Location**: `src/components/timeline/Timeline.tsx:706`, `ProjectModal.tsx:28`, `AllocationModal.tsx:51`, `TimeOffModal.tsx:36`, `PeopleClient.tsx`
- **Detail**: `npm run lint` reports 4 errors / 3 warnings, all in files this increment does not touch (react-hooks rules). The plan's criterion is scoped to the new file, which lints clean (`npx eslint src/lib/contract-types.parity.test.ts` exits 0).
- **Fix**: None for this increment.
- **Decision**: ACCEPT — pre-existing, outside the diff; plan criterion 1.3 is "lint passes on the new file".

## Scope
Code diff vs `origin/main...HEAD`: one new file, `src/lib/contract-types.parity.test.ts` (85 lines); the rest is `context/changes/…` (plan artifacts). Read directly (below the subagent threshold). No out-of-plan files. No runtime, schema or migration change.

## Review notes
- Parser: lazy `\)\s*;` after `check (` correctly spans the nested `in ( … )` (inner `)` is followed by `)`, not `;`). Comments are stripped first; `''` escapes handled. Verified against the actual SQL: 09-25 (3 values) is overridden by 09-30 (6 values) in the migration chain, and the schema file's second block overrides its first, matching the plan's last-definition-wins model.
- Vacuous-pass guards present (definition found, size > 0, per source and per constraint); duplicates check on `CONTRACT_TYPES`; migrations vs schema cross-check.
- Failure message names the constraint, source and missing/extra values.
- Uses only `node:fs` / `node:path`; no new dependency; matches the Vitest `include` pattern.
- Manual criteria: none.

## Success criteria
| Check | Result |
|---|---|
| `npm ci` (worktree readiness) | PASS (installed; lockfile unchanged) |
| 1.1 `npx vitest run` (JSON reporter, full suite) | PASS: 19 tests, 19 passed, 0 failed (includes the 5 + 1 parity tests) |
| 1.2 Red-first mutation: appended `'Extra'` to `CONTRACT_TYPES` | PASS: 4 parity tests failed with `missingInSql: ['Extra']`; `types.ts` restored, tree clean afterwards |
| 1.3 lint on the new file (`npx eslint src/lib/contract-types.parity.test.ts`) | PASS (exit 0); repo-wide lint failures pre-existing (F1) |
| 1.4 `npx tsc --noEmit` | PASS (exit 0) |
| `npm run build` | PASS |

The reviewer re-ran the mutation on the TS side only; the SQL-side removal was not re-run (same code path via `diff()`; the implementer recorded it as 1.2).

## Environment note
The worktree path named in the task did not exist; it was created from `origin/feat/contract-type-shared-source/1` (branch `feat/contract-type-shared-source/1`) before reviewing. No code was changed.

## Architecture gate note
`context/architecture/model.c4` exists, but the `rs-arch-audit` facts script was not executed in this review. By inspection the only code in the diff is one test file in `src/lib/` that imports `./types` and `node:fs`/`node:path` and reads `migrations/` and `supabase-schema.sql` as text: no import of another domain or plugin, no new backend call, route or store access. No boundary crossing is possible from this diff.
