# PersonModal error messages — Implementation Plan

## Overview

On a save or delete failure, several form modals hand the raw Supabase/PostgREST
`error.message` straight to `setError`, so a developer-facing string (table names,
column names, constraint names) renders in the user-facing error banner. Issue #75
reports this for `PersonModal.tsx`; the same two-line pattern is already duplicated
across four sibling modals. This change replaces every occurrence with a fixed,
localized, human-readable message and a `console.error` call carrying the raw error,
matching a pattern the codebase already uses in one place (`AllocationModal.tsx`'s
project-allocation branch) and that a prior code review already asked for on a
sibling call site (`allocations-ux-improvements/reviews/impl-review.md`, finding F2,
left `PENDING`).

## Current State Analysis

Seven call sites across five modal components do `setError(dbError.message)` (or
the equivalent `err.message`) directly on a failed Supabase write, with no
`console.error` call, so the only trace of the real error is the string shown to
the user:

- `src/components/people/PersonModal.tsx:62` — `handleSubmit` (insert/update `team_members`)
- `src/components/people/PersonModal.tsx:78` — `handleDelete` (`rpc('delete_team_member', …)`)
- `src/components/projects/ProjectModal.tsx:62` — `handleSubmit` (insert/update `projects`)
- `src/components/timeline/AllocationModal.tsx:102` — `handleSubmit`, time-off branch (insert `time_off`)
- `src/components/timeline/TimeOffModal.tsx:66` — `handleSubmit` (insert/update `time_off`)
- `src/components/competencies/ExperienceModal.tsx:49` — `handleSubmit` (`rpc('save_project_experience', …)`)
- `src/components/competencies/ExperienceModal.tsx:61` — `handleDelete` (delete `project_experience`)

`utils.ts:17-19` already documents these five components as one conventional
group ("shared dark/light-themed classes for form modals (PersonModal, ProjectModal,
AllocationModal, TimeOffModal, ExperienceModal)"), confirming they are treated as a
single family in this codebase, not five unrelated components.

The fix already exists once in the codebase: `AllocationModal.tsx:136-140`, the
project-allocation branch of the same `handleSubmit`, does
`console.error('Allocation save failed:', dbError); setError('Nie udało się
zapisać alokacji. Spróbuj ponownie.')` instead of surfacing `dbError.message`. The
time-off branch 34 lines above it (`:102`) still does the old thing — this exact
inconsistency was flagged as finding F2 in a prior review
(`context/changes/allocations-ux-improvements/reviews/impl-review.md:71-88`),
decision `PENDING`, with the fix already spelled out there.

Three `handleDelete` paths (`ProjectModal.tsx:67-75`, `TimeOffModal.tsx:70-76`,
`AllocationModal.tsx:145-153`) never destructure or check the delete call's
`error` at all — they swallow failures silently rather than leaking raw text.
That is a different bug (a failure is invisible instead of over-informative) and
is not touched by this change; see "What we're NOT doing".

`PersonModal.tsx` mixes English field labels with Polish action copy ("Zapisz",
"Zapisuję…", "Dodaj osobę", "Usuń", "Anuluj"); `AllocationModal.tsx`,
`TimeOffModal.tsx`, and `ExperienceModal.tsx` are Polish throughout;
`ProjectModal.tsx` is English throughout. The replacement message on each call
site follows that call site's existing language, exactly as `AllocationModal.tsx`
already does for its own two branches once this is applied everywhere.

No shared error-handling helper exists anywhere in `src/lib` or `src/components`
despite this pattern already repeating in five files — the codebase's convention
is to inline the two lines (`console.error(...)`; `setError('…')`) at each call
site (`AllocationModal.tsx:136-140`), not to centralize them.

## Desired End State

Every one of the seven call sites above logs the raw Supabase/PostgREST error to
the console with an action-specific label and shows a fixed, human-readable,
correctly-localized message in the modal's error banner instead of
`dbError.message`/`err.message`. No table, column, or constraint name is ever
rendered to the user. The three delete paths that currently swallow errors
silently keep doing exactly what they do today — unchanged.

### Key discoveries

- `AllocationModal.tsx:136-140` already implements the target pattern for its
  project-allocation branch — the shape to replicate, not invent.
- `allocations-ux-improvements/reviews/impl-review.md:71-88` already reviewed and
  specified this exact fix for the time-off branch of the same file, left
  `PENDING` — this change applies it.
- `utils.ts:17-19` treats PersonModal/ProjectModal/AllocationModal/TimeOffModal/
  ExperienceModal as one family already, supporting one uniform treatment rather
  than fixing PersonModal alone.
- The `contract_type` column referenced in issue #75 (from PR #72) does not exist
  anywhere in the current codebase (`grep -r contract_type src/` — no hits outside
  this change's own notes) — PR #72 has not landed on this branch, so this change
  has no dependency on it and does not need to touch the `team_members` payload.

## What we're NOT doing

- Not building a DB-error-code-to-message mapping table (e.g. distinguishing a
  unique-constraint violation from a generic failure). The codebase's own
  precedent (`AllocationModal.tsx:136-140`) uses one fixed message per action
  regardless of the underlying error, and the issue is severity "low /
  non-blocking" — a mapping table is unproven, unrequested extra scope.
- Not adding error handling to the three `handleDelete` paths that currently
  swallow the delete error entirely (`ProjectModal.tsx`, `TimeOffModal.tsx`,
  `AllocationModal.tsx`) — that is a silent-failure bug, the opposite problem
  from #75's raw-text leak, and out of this issue's scope.
- Not extracting a shared error-handling helper into `utils.ts` — no such helper
  exists today despite five files already sharing this shape; matching the
  established convention of inlining two lines per call site.
- Not touching the `contract_type` write from PR #72 — it isn't in this codebase
  yet.
- Not adding new automated test coverage for these modals — no test scaffolding
  exists for any of the five components today (`ThemeProvider.test.tsx` is the
  only test file in `src/`), and building per-modal Supabase-mock test
  infrastructure is disproportionate to a low-severity copy fix.

## Implementation Approach

Replace `setError(dbError.message)` / `setError(err.message)` at each of the
seven call sites with `console.error('<Action> failed:', dbError)` followed by
`setError('<fixed message>')`, where `<Action>` and `<fixed message>` are chosen
per call site to match that file's existing language and the phrasing style
`AllocationModal.tsx:138` already established ("Nie udało się <czynność>.
Spróbuj ponownie." / "Could not <action>. Please try again."). This was chosen
over a shared `utils.ts` helper (no precedent, and the codebase already
duplicates this exact two-line shape rather than centralizing it) and over a
DB-error-code mapping table (unrequested, unproven, disproportionate to a
low-severity issue — see "What we're NOT doing").

All seven call sites are edits to existing lines in five already-independent,
file-disjoint components; none of them depend on each other or on any schema,
API, or contract change, so all seven ship together in one deployable
increment and one phase rather than being staggered across multiple PRs.

## Increments

| # | Name | Phases | Depends on | User-visible | Status | PR |
|---|---|---|---|---|---|---|
| 1 | Replace raw DB error text in all five shared-pattern modals | 1 | — | yes | pending | — |

## Phase 1: Replace raw DB error text in all five shared-pattern modals

### Overview
Fix the reported issue in `PersonModal.tsx` and apply the identical treatment to
the four sibling modals that share the exact same pattern, so no modal in the
app ever renders a raw Supabase/PostgREST error string.

### Required changes

#### 1. PersonModal
- **File**: `src/components/people/PersonModal.tsx`
- **Goal**: fix the issue as reported — no raw DB text in the save or delete path.
- **Contract**: `:62` (`handleSubmit`) → `console.error('Person save failed:',
  dbError)` then `setError('Nie udało się zapisać danych osoby. Spróbuj
  ponownie.')`. `:78` (`handleDelete`) → `console.error('Person delete failed:',
  dbError)` then `setError('Nie udało się usunąć osoby. Spróbuj ponownie.')`.

#### 2. ProjectModal
- **File**: `src/components/projects/ProjectModal.tsx`
- **Goal**: same treatment, English copy to match this modal's existing language.
- **Contract**: `:62` (`handleSubmit`) → `console.error('Project save failed:',
  dbError)` then `setError('Could not save the project. Please try again.')`.

#### 3. AllocationModal (time-off branch)
- **File**: `src/components/timeline/AllocationModal.tsx`
- **Goal**: apply the exact fix already specified by the prior review (finding F2,
  `allocations-ux-improvements/reviews/impl-review.md:86-88`), bringing the
  time-off branch in line with the project-allocation branch 34 lines below it
  that already does this.
- **Contract**: `:102` (`handleSubmit`, time-off branch) →
  `console.error('Time-off save failed:', dbError)` then `setError('Nie udało się
  zapisać nieobecności. Spróbuj ponownie.')`.

#### 4. TimeOffModal
- **File**: `src/components/timeline/TimeOffModal.tsx`
- **Goal**: same treatment, matching the message `AllocationModal.tsx`'s
  time-off branch now uses for the same underlying table.
- **Contract**: `:66` (`handleSubmit`) → `console.error('Time off save failed:',
  dbError)` then `setError('Nie udało się zapisać nieobecności. Spróbuj
  ponownie.')`.

#### 5. ExperienceModal
- **File**: `src/components/competencies/ExperienceModal.tsx`
- **Goal**: same treatment for both its save and delete paths (the only sibling
  modal, besides PersonModal, whose delete path already checks the error).
- **Contract**: `:49` (`handleSubmit`) → `console.error('Experience save
  failed:', err)` then `setError('Nie udało się zapisać doświadczenia. Spróbuj
  ponownie.')`. `:61` (`handleDelete`) → `console.error('Experience delete
  failed:', err)` then `setError('Nie udało się usunąć doświadczenia. Spróbuj
  ponownie.')`.

### Success criteria
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with no new errors
- [ ] `npm run test` passes (existing suite stays green)
- [ ] `git diff` shows no changes outside the five files listed above
#### Manual
- [ ] forcing a save failure on each of the five modals (e.g. a temporary RLS/
  constraint violation on staging) shows the modal's fixed message, not raw
  DB text, and the raw error appears in the browser console
- [ ] forcing a delete failure on PersonModal and ExperienceModal (the two
  delete paths that already surface errors) shows the fixed message, not raw
  DB text

## Testing Strategy

No automated test runner exercises Supabase-backed UI failure paths in this
repository today (the one existing test, `ThemeProvider.test.tsx`, covers a
different component with no network dependency). `npm run build` and `npm run
lint` catch typos/type errors in the new strings; `npm run test` guards against
an unrelated regression in the existing suite. The actual failure-path behavior
— the fixed message rendering, and the raw error reaching the console — is
manual, per modal, consistent with how this repository's other UI-behavior
plans (e.g. `theme-preference`) already verify browser-observable behavior with
no automated coverage.

## References

- Issue #75 (verbatim in `context/changes/person-modal-error-messages/change.md`).
- `src/components/timeline/AllocationModal.tsx:136-140` — the existing pattern to
  replicate.
- `context/changes/allocations-ux-improvements/reviews/impl-review.md:71-88` —
  prior review finding F2, same fix, left `PENDING`.
- `src/lib/utils.ts:17-25` — the five-modal grouping convention.

## Progress

### Phase 1: Replace raw DB error text in all five shared-pattern modals
#### Automated
- [ ] 1.1 npm run build succeeds
- [ ] 1.2 npm run lint passes with no new errors
- [ ] 1.3 npm run test passes (existing suite stays green)
- [ ] 1.4 git diff shows no changes outside the five files listed above
#### Manual
- [ ] 1.5 forcing a save failure on each of the five modals shows the fixed message, not raw DB text, and the raw error appears in the browser console
- [ ] 1.6 forcing a delete failure on PersonModal and ExperienceModal shows the fixed message, not raw DB text
