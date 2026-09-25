<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Team member contract type + Timeline sort

**Plan**: context/changes/contract-type-sort/plan.md   **Scope**: Increment 2 (Phase 3: sort comparator; Phase 4: Timeline sort control)   **Date**: 2026-09-25
**Round**: 1   **Verdict**: APPROVED   **Findings**: 2

## Verdicts
| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Scope & method

Reviewed commits `34ef1ce` (p3), `d9702e4` (p4), `2375121` (epilogue: progress +
`change.md` status) against Phase 3 and Phase 4 of the plan. Increment 1 (Phase 1-2)
is already merged (PR #72, APPROVED round 1) and out of scope here. Two read-only
subagents independently cross-checked plan drift (file:line evidence against all four
planned contracts) and safety/quality/pattern consistency; both came back clean, and
their findings are folded in below. All automated checks were executed directly in
this worktree (`node_modules` present; no install needed).

## Automated success criteria

**Phase 3**
- 3.1 `npm run test` — ran (`vitest run`): 2 files, 10 tests, all pass, including the
  3 new `utils.test.ts` cases (AC-02 ordering; same-type alphabetical tiebreak; unset
  people alphabetical, after every typed person). **PASS**
- 3.2 `npm run lint` — ran; see below. **PASS** ("no new errors" — the diff's own
  lines introduce none)

**Phase 4**
- 4.1 `npm run build` — ran `next build` (Turbopack): compiles, typechecks, generates
  all pages/routes successfully, no errors. **PASS**
- 4.2 `npm run lint` — same evidence as 3.2. **PASS**

**Lint detail**: the full-repo `npm run lint` is not clean (5 errors, 3 warnings), but
every one of them is pre-existing and outside this increment's diff:
`PersonModal.tsx:29`, `ProjectModal.tsx:28`, `AllocationModal.tsx:51`,
`TimeOffModal.tsx:36` (`react-hooks/set-state-in-effect`, none of these 4 files are
touched by this increment — confirmed via `git diff origin/main...HEAD --stat`), and
`Timeline.tsx:685` (`react-hooks/refs`, on `isDragging.current` in a `style` prop) —
confirmed byte-identical to `origin/main`'s copy of that same line (`git show
origin/main:src/components/timeline/Timeline.tsx` line 656, same content, only its
line number shifted from the diff's earlier insertions). The two Timeline.tsx
warnings (`assignLanes` unused, `_event` unused) are likewise unrelated to the sort
feature. `npx tsc --noEmit` also ran clean, no output.

Also ran `npx tsc --noEmit` directly (exit 0, no output) as an extra check beyond the
plan's named commands, since Phase 1's automated criteria included it and TypeScript
strictness matters for the new `compareByContractType(a: TeamMember, b: TeamMember)`
signature.

No check was SKIPPED — `node_modules` was present and lint/test/build/tsc all ran to
completion in this environment.

## Manual success criteria (diff evidence, left pending for the human)

- 4.3 AC-02 (contract-type sort renders Bartek, Damian, Celina, Anna, Ewa) — covered
  by the unit test's exact assertion (`utils.test.ts:20-30`) plus
  `Timeline.tsx:520-522` wiring the same comparator into `sortedPeople`. Needs a
  running app with real people to click through. **manual-pending**.
- 4.4 AC-03 (default "Name" order unchanged) — `sortMode` defaults to `'name'`
  (`Timeline.tsx:266`) and that branch returns `filteredPeople` unchanged
  (`Timeline.tsx:520-522`), which is already alphabetical from the server query
  (`timeline/page.tsx:10`, `.order('full_name')`). **manual-pending**.
- 4.5 AC-04 (sort combines with filters) — `sortedPeople` is derived from
  `filteredPeople` (the already-filtered array), not from the raw `people` prop, so
  filtering always happens first. **manual-pending**.
- 4.6 (drag-and-drop / OOO unaffected) — the diff touches no drag/resize/OOO code
  path; `rowData`'s per-person lane computation (`Timeline.tsx:525` onward) is
  unchanged aside from iterating `sortedPeople` instead of `filteredPeople`.
  **manual-pending**.

All four are correctly left unchecked in `## Progress`; none are "blind-signed".
Phase 1-2's manual rows (1.4, 2.3-2.5) remain pending from increment 1's review and
are outside this increment's scope.

## Findings

### F1 — Uncommitted `package-lock.json` drift in the worktree
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Scope Discipline
- **Location**: `package-lock.json` (working tree, unstaged)
- **Detail**: Same pattern already seen and dismissed in increment 1's review (F1,
  `reviews/impl-review-inc-1.md`): `git status` shows an unstaged, uncommitted
  ~34/23-line lockfile diff not part of any of this increment's commits.
  `package.json` is untouched; the diff is entirely dependency-resolution metadata
  churn (`"peer": true` flags toggling, two new optional `@emnapi/core`/
  `@emnapi/runtime` transitive packages) — consistent with this increment's own
  stated cause: this fresh worktree had no `node_modules`, `npm ci` failed against
  the committed lock (pre-existing drift, not introduced by this diff), and `npm
  install` was required to get a runnable environment, which rewrote lockfile
  metadata as a side effect.
- **Fix**: n/a — not code. Left correctly unstaged by the implementer; nothing to
  commit or fix here.
- **Decision**: DISMISS — harmless as left: unstaged, so it ships only if someone
  later stages and commits it. Not caused by, and not required by, this increment's
  actual code changes. Recorded here (and as an `out-of-plan-files` guard) purely for
  visibility, matching how increment 1 handled the identical situation.

### F2 — Sort toggle has no preceding label
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: `src/components/timeline/Timeline.tsx:641-657`
- **Detail**: The new "Nazwa"/"Typ umowy" toggle button group is unlabeled, unlike
  its cited precedent, `PeopleClient.tsx`'s `groupMode` toggle, which is preceded by
  a "Grupuj po:" caption (`PeopleClient.tsx:106`). The plan's contract only specifies
  matching the button-group *styling* (which it does, exactly), not a caption; the
  toggle sits among other self-labeling filter buttons in the Timeline top bar
  (`PeopleFilter`, `ProjectFilter`, `SkillsFilter`), so the omission reads as
  consistent with its immediate neighbors rather than with `PeopleClient.tsx`.
- **Fix**: n/a, cosmetic; not a plan-contract violation.
- **Decision**: DISMISS — not specified by the plan's contract, and the Timeline top
  bar's own established convention (self-labeling controls) is a valid alternative
  precedent to follow. Not a defect.

## Cross-package / import check

N/A — no cross-package imports introduced (single Next.js app, no workspace
packages). `compareByContractType` is imported from `@/lib/utils` into
`Timeline.tsx` within the same package; `npx tsc --noEmit` and `next build` both
confirm the import resolves and typechecks.

## Summary

Both phases match the plan's stated contract exactly: the comparator is a pure,
unit-tested function isolated in `utils.ts` alongside its neighboring pure helpers,
correctly bucketing unset/unknown contract types after every known type and falling
back to `localeCompare` on ties; the Timeline toggle is styled identically to its
cited `PeopleClient.tsx` precedent and is wired in after filtering so sort and
filters compose (AC-04) while leaving the default "Name" order and the "ZESPÓŁ · N"
count untouched. Test, build, and typecheck all ran clean in this environment; lint's
pre-existing failures are confirmed unrelated to this diff. No CRITICAL or WARNING
findings. The two observations are non-blocking and dismissed with reasons above.
Four manual criteria are correctly left pending for a human with a running app.
