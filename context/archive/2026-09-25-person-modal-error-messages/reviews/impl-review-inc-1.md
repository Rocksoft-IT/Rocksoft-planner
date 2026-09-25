<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: PersonModal error messages

**Plan**: context/changes/person-modal-error-messages/plan.md   **Scope**: full plan (increment 1, phase 1)   **Date**: 2026-09-25
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

## Findings

### F1 — Pre-existing lint failures unrelated to this diff
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Success Criteria
- **Location**: `src/components/projects/ProjectModal.tsx:28`, `src/components/timeline/AllocationModal.tsx:51`, `src/components/timeline/TimeOffModal.tsx:36`, `src/components/timeline/Timeline.tsx:656`
- **Detail**: `npm run lint` exits with 5 errors / 3 warnings, so the raw command is not exit-0. All 5 errors are `react-hooks/set-state-in-effect` / `react-hooks/refs` violations in `useEffect` blocks and a ref-in-render read, none of them touched by this diff. Confirmed via `git blame`: every flagged line traces to commits `594c4f66` (2026-05-22), `5ee2fea2` (2026-07-20) and `fd2b4913` (2026-06-02), all predating this branch's first commit (`27a9c32`, 2026-09-25). The plan's criterion is explicitly worded "npm run lint passes with **no new errors**" (not "exits 0"), matching this repo's existing lint debt. No new lint error was introduced by the 5 files this change edited.
- **Fix**: none needed for this change; the pre-existing debt is orthogonal to issue #75.
- **Decision**: ACCEPT — criterion as worded is satisfied; pre-existing debt confirmed by blame, out of this change's scope.

### F2 — Uncommitted `package-lock.json` drift from worktree `npm install`
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Scope Discipline
- **Location**: `package-lock.json` (working tree, unstaged)
- **Detail**: The fresh worktree required `npm install` before `npm run build`/`lint`/`test` could run, which rewrote a handful of `"peer": true` flags in the lockfile (npm resolving optional/peer metadata slightly differently locally than the committed lockfile). The implementer's own report already flagged this and deliberately left it unstaged/uncommitted — confirmed: `git diff origin/main...HEAD` (the actual increment diff) does not touch `package-lock.json` at all; it only shows up in `git status` as a local working-tree artifact.
- **Fix**: none — already correctly left out of the commit. Worth a `.gitignore`/CI note only if this recurs across changes, not an action for this PR.
- **Decision**: ACCEPT — out-of-plan but not committed, doesn't affect the shipped diff; matches the soft guard the implementer already surfaced.

## Success criteria verification (this session, local)

#### Automated
- 1.1 `npm run build` — **PASS**. `next build` compiled successfully, typechecked clean, generated all routes.
- 1.2 `npm run lint` — **PASS** (as worded: no new errors). Raw exit is non-zero from 5 pre-existing, unrelated errors (F1). No lint issue traces to the 5 edited files' touched lines.
- 1.3 `npm run test` — **PASS**. `vitest run`: 1 file, 7 tests, all green (`ThemeProvider.test.tsx`, unrelated to this change — no test infra exists for the 5 modals, as the plan notes).
- 1.4 `git diff` scope — **PASS**. `git diff origin/main...HEAD --stat` touches exactly the 5 planned components plus the change's own `context/changes/person-modal-error-messages/` docs. No other file in the commits.

#### Manual (left pending by implementer, verified here only via diff evidence, not a live Supabase failure)
- 1.5 forcing a save failure on each of the five modals — **diff evidence supports it**: all 5 `handleSubmit` error branches now do `console.error('<Action> failed:', dbError)` then `setError('<fixed literal message>')`, confirmed at `PersonModal.tsx:62-66`, `ProjectModal.tsx:62-66`, `AllocationModal.tsx:102-106`, `TimeOffModal.tsx:66-70`, `ExperienceModal.tsx:49-54`. No `dbError.message`/`err.message` reaches `setError` anywhere in the diff. Still **manual-pending** — requires a real Supabase write failure on a live environment to observe end to end; not verifiable in this offline review.
- 1.6 forcing a delete failure on PersonModal and ExperienceModal — **diff evidence supports it**: `PersonModal.tsx:78-88` and `ExperienceModal.tsx:61-70` both follow the same pattern for `handleDelete`. Still **manual-pending** for the same reason as 1.5.

## Plan-drift check (all 7 call sites)

| # | File:line | Contract | Result |
|---|---|---|---|
| 1 | `PersonModal.tsx:63-64` | `console.error('Person save failed:', dbError)` / `setError('Nie udało się zapisać danych osoby. Spróbuj ponownie.')` | MATCH |
| 2 | `PersonModal.tsx:83-84` | `console.error('Person delete failed:', dbError)` / `setError('Nie udało się usunąć osoby. Spróbuj ponownie.')` | MATCH |
| 3 | `ProjectModal.tsx:63-64` | `console.error('Project save failed:', dbError)` / `setError('Could not save the project. Please try again.')` | MATCH |
| 4 | `AllocationModal.tsx:103-104` | `console.error('Time-off save failed:', dbError)` / `setError('Nie udało się zapisać nieobecności. Spróbuj ponownie.')` | MATCH |
| 5 | `TimeOffModal.tsx:67-68` | `console.error('Time off save failed:', dbError)` / `setError('Nie udało się zapisać nieobecności. Spróbuj ponownie.')` | MATCH |
| 6 | `ExperienceModal.tsx:50-51` | `console.error('Experience save failed:', err)` / `setError('Nie udało się zapisać doświadczenia. Spróbuj ponownie.')` | MATCH |
| 7 | `ExperienceModal.tsx:67-68` | `console.error('Experience delete failed:', err)` / `setError('Nie udało się usunąć doświadczenia. Spróbuj ponownie.')` | MATCH |

All 7 use fixed literal strings — no interpolation of the raw error into any user-visible string, anywhere.

**"What we're NOT doing" boundary — confirmed held:**
- `ProjectModal.tsx:71-79` `handleDelete` — still no error check, unchanged silent swallow (as specified).
- `TimeOffModal.tsx:74-80` `handleDelete` — still no error check, unchanged.
- `AllocationModal.tsx:149-157` `handleDelete` — still no error check, unchanged.
- No `contract_type` reference anywhere in `src/`; `src/lib/utils.ts` untouched; no shared error-handling helper added.

## Safety, quality, pattern review (subagent + direct verification)

- `console.error(...)` in all 7 sites logs only to the browser console — no toast/analytics/fetch/localStorage sink found in any of the 5 files.
- Every edited block preserves the pre-existing `if (dbError)`/`if (err)` guard and the surrounding `setLoading(false)` placement exactly as before — no unconditional logging, no dropped loading-state resets.
- New blocks match the brace/format style already established at `AllocationModal.tsx`'s pre-existing "Allocation save failed" branch (multi-line `if (x) { console.error(...); setError(...); ...; return }`), including the `'<Entity> <action> failed:'` console-label convention.
- Polish copy ("Nie udało się zapisać/usunąć … Spróbuj ponownie.") is grammatically correct and idiomatic; the English copy in `ProjectModal.tsx` ("Could not save the project. Please try again.") correctly matches that file's all-English UI, consistent with the other four files being all-Polish.
- No security/reliability issue found in the touched lines.

## Notes on the plan itself

No flaws found in the plan — the "NOT doing" boundary (leaving the 3 silent-swallow delete paths untouched) is a reasonable, explicitly justified scope cut for a low-severity issue, and the implementation held it exactly.
