<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Team member contract type + Timeline sort

**Plan**: context/changes/contract-type-sort/plan.md   **Scope**: Increment 1 (Phase 1: schema + type; Phase 2: person-modal field)   **Date**: 2026-09-25
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

Reviewed commits `98b5a38` (p1), `b8cf8c7` (p2), `f777555` (progress docs) against
Phase 1 and Phase 2 of the plan. Phases 3-4 (sort comparator, Timeline toggle) belong
to increment 2 and are out of scope; `## Progress` correctly leaves 3.x/4.x unchecked.
Verified in full: `migrations/2026-09-25-team-member-contract-type.sql` (new),
`supabase-schema.sql` diff, `src/lib/types.ts` diff, `src/components/people/PersonModal.tsx`
diff and full file. A read-only subagent independently cross-checked plan drift and
pattern consistency; its findings are folded in below.

## Automated success criteria

**Phase 1**
- 1.1 `npm run lint` — ran; the two files this phase touches
  (`src/lib/types.ts`, and Phase 2's `PersonModal.tsx`) introduce **no new** lint
  errors. `npx eslint src/lib/types.ts src/components/people/PersonModal.tsx` shows
  exactly one pre-existing error at `PersonModal.tsx:29` (`setFullName` in a
  `useEffect`, rule `react-hooks/set-state-in-effect`) — confirmed present, unchanged,
  in the merge-base commit `97b368e` (i.e. it predates this change and none of this
  diff's added lines trigger it). **PASS** (criterion is "no new errors", not "lint
  exits 0" — the repo's full `npm run lint` was already non-clean before this change,
  in unrelated files: `AllocationModal.tsx`, `TimeOffModal.tsx`, `ProjectModal.tsx`,
  `Timeline.tsx`).
- 1.2 `npx tsc --noEmit` — ran, exits clean, no output. **PASS**
- 1.3 `supabase-schema.sql` column/constraint text matches the migration — verified
  byte-for-byte: the `alter table ... add column if not exists contract_type text;`
  and `alter table ... add constraint team_members_contract_type_check check
  (contract_type is null or contract_type in ('UoP', 'B2B', 'Freelance'));` statements
  are identical in `migrations/2026-09-25-team-member-contract-type.sql` and
  `supabase-schema.sql:498-508`; only surrounding comments differ. **PASS**

**Phase 2**
- 2.1 `npm run lint` — same evidence as 1.1. **PASS**
- 2.2 `npm run build` — ran `npm run build`; `next build` (Turbopack) compiles, type
  checks, and generates all pages successfully, no errors. **PASS**

No check was SKIPPED — `node_modules` was present and both the full and scoped lint,
`tsc`, and `next build` ran to completion in this environment.

## Manual success criteria (diff evidence, left pending for the human)

- 1.4 (migration applied via Supabase Dashboard, existing rows stay `null`, constraint
  rejects bad values) — genuinely requires a live Supabase project; no diff evidence
  can substitute. Correctly left `[ ]`. **manual-pending**.
- 2.3 AC-01 (set "B2B", reopen shows "B2B") — diff evidence supports the claim:
  `PersonModal.tsx:34` seeds `contractType` from `person.contract_type ?? ''` on open,
  the `<select>` is a standard controlled component (`PersonModal.tsx:136-147`), and
  the submit payload includes `contract_type: contractType || null`
  (`PersonModal.tsx:58`). Needs a running app to actually click through. **manual-pending**.
- 2.4 AC-05 (clear and save leaves it unset) — same payload logic
  (`contractType || null` sends `null` for the empty option). **manual-pending**.
- 2.5 FR-006 (create/edit without choosing a type still works) — the `<select>` has no
  `required` attribute and the empty option is the default/seed value, so submission
  with no selection is unblocked. **manual-pending**.

All four are correctly left unchecked in `## Progress`, none are "blind-signed".

## Findings

### F1 — Uncommitted `package-lock.json` drift in the worktree
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Scope Discipline
- **Location**: `package-lock.json` (working tree, not staged/committed)
- **Detail**: `git status` shows an uncommitted, unstaged change to `package-lock.json`
  (~34 insertions / 23 deletions) that is not part of any of this increment's commits.
  `package.json` is untouched. The diff is entirely dependency-resolution churn — a
  handful of `"peer": true` flags added/removed and two new optional
  `@emnapi/core`/`@emnapi/runtime` packages — the signature of `npm install` (or
  similar) having re-resolved the lockfile against a different npm/platform than
  whatever originally produced it, not a deliberate dependency change for this
  feature. Nothing in the plan calls for a dependency change, and no phase commit
  touches this file.
- **Fix**: n/a — not code; recommend the caller run `git checkout -- package-lock.json`
  (or equivalent) before merging so the lockfile stays byte-identical to `main`'s
  dependency tree, since this diff has no reason to change it. Flagged rather than
  fixed here (review never touches code/config).
- **Decision**: DISMISS — harmless as-is: it is uncommitted, so it will not ship
  unless someone explicitly stages and commits it; not caused by, and not required
  by, this increment's actual changes. Recorded as a guard for visibility.

### F2 — Empty-option label differs from the modal's own dropdown convention
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: `src/components/people/PersonModal.tsx:142`
- **Detail**: The new "Typ umowy" `<select>` uses `"—"` as its empty-option label. The
  plan explicitly cites `TimeOffModal.tsx`'s `<select>` as the pattern to follow for
  styling/control shape, which it does match (same `themedLabelClass`/
  `themedInputClass`, controlled value/onChange) — but that select's own empty option
  reads `"Wybierz osobę…"` rather than a bare dash. The plan only specifies
  `<option value="">` as "the unset choice," not its exact label, so this isn't drift
  against the plan's contract.
- **Fix**: n/a, cosmetic.
- **Decision**: DISMISS — not specified by the plan, and "—" reads naturally for an
  optional enum field (vs. "choose a person," which needs a verb because a person
  must eventually be chosen). Not a defect.

## Cross-package / import check

N/A — no cross-package imports introduced (single Next.js app, no workspace packages).

## Summary

Both phases match the plan's stated contract closely: the migration is idempotent and
matches its `supabase-schema.sql` mirror exactly at the SQL-statement level; the
`ContractType`/`CONTRACT_TYPES` typing mirrors the cited `Profile.theme` precedent; the
person-modal field is a correctly-seeded, correctly-payloaded controlled `<select>`
with no `required` attribute (preserving FR-006). Build and typecheck are clean; the
one lint error present is pre-existing and unrelated to this diff (confirmed against
the merge-base commit). No CRITICAL or WARNING findings. The only two observations are
non-blocking and dismissed with reasons above. Four manual criteria are correctly left
pending for a human with a running app / Supabase dashboard access.
