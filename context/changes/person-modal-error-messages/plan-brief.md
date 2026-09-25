# PersonModal error messages — Plan Brief

Full plan: `plan.md`. No `research.md` or `frame.md` for this change — see
"Process notes" below for why both were skipped.

## What & why

Issue #75: `PersonModal.tsx` shows the raw Supabase/PostgREST error string
(table/column/constraint names) in its error banner on a failed save, instead
of a human-readable message. The issue also asks whether the same fix should
extend to the other modals sharing the pattern. A direct read of the code found
seven call sites across five modal components doing exactly this.

## Starting point

`src/components/people/PersonModal.tsx:62,78`, plus four sibling modals
(`ProjectModal.tsx`, `AllocationModal.tsx`, `TimeOffModal.tsx`,
`ExperienceModal.tsx`) each do `setError(dbError.message)` on a failed Supabase
write, with no `console.error`. One of the seven sites already has its fix
pre-written by a prior review: `AllocationModal.tsx:136-140` (a sibling branch
in the same function) already does the target pattern, and
`allocations-ux-improvements/reviews/impl-review.md` finding F2 already asked
for the identical fix on the time-off branch, left `PENDING`.

## Desired end state

All seven call sites log the raw error via `console.error` with an
action-specific label and show a fixed, correctly-localized, human-readable
message instead. No table/column/constraint name ever reaches the user. The
three `handleDelete` paths that currently swallow errors silently
(`ProjectModal`, `TimeOffModal`, `AllocationModal`) are untouched — a different
bug, out of scope.

## Complexity

**LOW.** A single, well-understood two-line pattern (`console.error` +
`setError('<fixed message>')`) replicated across seven call sites in five
already-independent files. No schema, API, or contract change; no new
dependency; no new abstraction. Rated above TRIVIAL only because it spans five
components rather than one.

## Process notes

Skipped `rs-research` and `rs-frame`: the issue names the exact file and line,
the fix is already demonstrated once in the codebase
(`AllocationModal.tsx:136-140`) and already specified by a prior human review
for a sibling call site (finding F2, `PENDING`) — reading the five modal files
directly and grepping for the pattern answered every open question with
`file:line` evidence, so a separate research/frame pass would not have changed
the plan.

## Key decisions made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Research/frame steps | Skip both | Issue names exact file/line; fix already demonstrated at `AllocationModal.tsx:136-140` and already specified by prior review finding F2 (`allocations-ux-improvements/reviews/impl-review.md:71-88`) | Auto |
| Scope: PersonModal only, or all modals sharing the pattern? | All five (`PersonModal`, `ProjectModal`, `AllocationModal`, `TimeOffModal`, `ExperienceModal`) | Grep found 7 call sites across these 5 files; `utils.ts:17-19` already treats them as one conventional group; issue explicitly invites the extension | Auto |
| Increment/phase structure | One increment, one phase, all 5 files together | All edits are file-disjoint, mechanical, ~2 lines each; issue severity is "low / non-blocking"; splitting into multiple PRs adds process overhead disproportionate to the fix | Auto |
| Error-handling shape | Fixed per-action message (localized per modal) + `console.error`; no DB-error-code mapping table | Matches the codebase's own precedent at `AllocationModal.tsx:136-140`; a mapping table is unproven, unrequested scope for a low-severity issue | Auto |
| Shared helper vs. inline | Inline at each call site, no new `utils.ts` helper | No such helper exists today despite 5 files already sharing this shape; codebase convention duplicates the two lines per call site | Auto |
| Delete paths that swallow errors silently (`ProjectModal`, `TimeOffModal`, `AllocationModal`) | Leave untouched | Different bug (invisible failure, not leaked text) — out of #75's scope | Auto |
| Automated verification | `npm run build`, `npm run lint`, `npm run test` (existing suite) | Matches every other plan in this repo (e.g. `theme-preference`); no Supabase-mock test infra exists for these modals, and building it is disproportionate here | Auto |

0 consults — every question had a clearly evidenced answer.

## Scope

**In**: the 7 raw-error call sites in `PersonModal.tsx`, `ProjectModal.tsx`,
`AllocationModal.tsx` (time-off branch), `TimeOffModal.tsx`,
`ExperienceModal.tsx` (×2).

**Out**: any DB-error-code-to-message mapping; the 3 delete paths that swallow
errors silently instead of leaking them; the `contract_type` column from PR #72
(not present in this codebase yet — no dependency); any new shared
error-handling utility; new automated test infrastructure.

## Architecture / Approach

`console.error('<Action> failed:', dbError)` then `setError('<fixed
message>')` at each of the 7 sites, replacing `setError(dbError.message)` /
`setError(err.message)`. Message language matches each file's existing UI
language (Polish for 4 of the 5 modals, English for `ProjectModal`), and
phrasing follows the style `AllocationModal.tsx:138` already established
("Nie udało się … Spróbuj ponownie." / "Could not … Please try again.").

## Increments at a glance

| # | Delivers | Depends on | User-visible | Key risk |
|---|---|---|---|---|
| 1 | Fixed, localized error messages + console logging on all 7 call sites across 5 modals | — | yes | A mistyped message string or an unlocalized string slipping into the wrong-language modal; caught by manual per-modal check |

## Phases at a glance

| Phase | Increment | Delivers | Key risk |
|---|---|---|---|
| 1 | 1 | All 7 call sites fixed across `PersonModal`, `ProjectModal`, `AllocationModal`, `TimeOffModal`, `ExperienceModal` | Same as above; single phase since all edits are independent one-line-per-site changes with no sequencing dependency |

Prerequisites: none — no schema, API, or dependency change.

## Open risks & assumptions

- No `decision-to-verify` guards raised — every decision above had direct
  `file:line` evidence, not a conservative fallback from an unresolved consult.
- Manual verification of the failure path requires forcing a real Supabase
  write failure (RLS/constraint violation) on a dev/staging project, the same
  limitation every other plan in this repo has, since no automated test runner
  exercises Supabase-backed UI failure paths.

## Success criteria (summary)

`npm run build`, `npm run lint`, and `npm run test` all pass; `git diff`
touches only the five listed files; a forced save failure on each of the five
modals shows the fixed message (never raw DB text) with the raw error visible
in the console; a forced delete failure on `PersonModal` and `ExperienceModal`
does the same.
