<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Theme preference (light/dark)

**Plan**: context/changes/theme-preference/plan.md   **Scope**: Increment 4 (Phase 10, Kompetencje theming)   **Date**: 2026-10-07
**Round**: 1   **Verdict**: REJECTED   **Findings**: 2

## Verdicts
| Dimension | Verdict |
|---|---|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Kompetencje page background stays dark in light mode; light-theme text becomes unreadable
- **Severity**: CRITICAL
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `src/app/(dashboard)/layout.tsx:23-26` (wrapper `bg-slate-900`, no `light:` override); `<main className="flex-1 overflow-auto">` at `layout.tsx:27`; `src/app/(dashboard)/competencies/CompetenciesClient.tsx:55` (page root has no background)
- **Detail**: The dashboard shell wrapper paints `bg-slate-900` and `<main>` is transparent, so on the Kompetencje page the page canvas is still dark slate in light mode. Meanwhile this increment switches the heading to `light:text-slate-900`, labels to `light:text-slate-700`, subtitle to `light:text-slate-600`, and result cards to `light:bg-slate-50`: dark text on a dark canvas (title, subtitle, tabs, "Brak dopasowań", "Ładowanie…", editor section headings are effectively invisible), and light cards floating on dark. AC-01 (Kompetencje renders correctly in both themes) is not met. The Timeline already avoids this by giving its own page root `light:bg-slate-50` (`TimelineClient.tsx:32` on `feat/theme-preference/2`); no such root exists for Kompetencje, and the plan's Phase 10 file list did not mention a page background (a plan gap, as the implementer of increment 2 also noted). The same gap exists for People and Projects (increment 3 adds no page background either); see guard.
- **Fix**: In `CompetenciesClient.tsx:55`, wrap the content in a full-height canvas that mirrors Timeline's pattern, e.g. `<div className="min-h-full light:bg-slate-50"><div className="max-w-3xl mx-auto px-4 lg:px-8 py-8">…</div></div>` (dark theme unchanged since no unprefixed class changes). Alternative that fixes all three screens at once: add `light:bg-slate-50` to the wrapper className in `layout.tsx:25`; that file belongs to increment 1 (already merged), so the orchestrator should decide whether to apply it there instead of per page.
- **Decision**: FIX — unambiguous, dark appearance unaffected; chosen per-page option as the conservative one that stays inside increment 4's own file scope.

### F2 — Plan lists `ExperienceModal.tsx` but the diff does not touch it
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `src/components/competencies/ExperienceModal.tsx:1-130`
- **Detail**: The file was already fully themed on the base through the shared `themed*Class` helpers from increment 1 (`src/lib/utils.ts:17-28`); I read the whole file and no unprefixed dark-only class remains (only the indigo primary button and white check icon, which are intentionally theme-neutral). Nothing is missing.
- **Fix**: —
- **Decision**: ACCEPT — plan item already satisfied by the base; no change needed.

## Plan-drift classification
- In plan AND diff: `CompetenciesClient.tsx`, `CompetencyEditor.tsx`, `TagMultiSelect.tsx` (overrides read line by line; every slate/indigo/red/amber class carries a `light:` pair except theme-neutral indigo-600 buttons and the white check icon; amber info box themed as planned at `CompetenciesClient.tsx:153`; `<option>` elements use `themedOptionClass`).
- In plan NOT diff: `ExperienceModal.tsx` (F2, already themed).
- In diff NOT plan: none outside `context/changes/theme-preference/{plan,change}.md` state updates.
- `src/app/api/` and `mcp/`: no changes (criterion 10.3 PASS).

## Success criteria
| Criterion | Result |
|---|---|
| 10.1 `npm run build` | PASS (Next build completes, all routes listed) |
| 10.2 `npm run lint` | PASS for this diff: 4 errors / 3 warnings, all pre-existing in files this increment does not touch (`ProjectModal`, `AllocationModal`, `TimeOffModal`, `Timeline`, `PeopleClient`); none in the competencies files |
| 10.3 no diff under `src/app/api/` or `mcp/` | PASS (empty diff) |
| 10.4 (manual) Kompetencje tabs/search/chips/editor/ExperienceModal in both themes | PENDING; static review finds the page-background gap in F1 |

Architecture gate: `context/architecture/model.c4` not present, so SKIPPED (no boundary change in this diff; presentation classes only).

## Notes
- Round-3 rule: this is round 1; the fix goes through `rs-implement theme-preference increment 4 --from-review`.
