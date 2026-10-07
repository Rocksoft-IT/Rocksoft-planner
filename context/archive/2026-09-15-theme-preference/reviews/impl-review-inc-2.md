<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Theme preference (light/dark)

**Plan**: context/changes/theme-preference/plan.md   **Scope**: Increment 2 (Phases 5-7)   **Date**: 2026-10-07
**Round**: 1   **Verdict**: APPROVED   **Findings**: 3

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

### F1 — `ContractTypeBadge.tsx` touched, not in the plan
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Scope Discipline
- **Location**: `src/components/ui/ContractTypeBadge.tsx:5-10`
- **Detail**: The badge renders inside the Timeline's frozen person column (`Timeline.tsx:~798`) and its `*-300` text on a 15% tint is illegible on a white row. The edit only adds `light:text-*-700` siblings; unprefixed (dark) classes are untouched. Import grep shows the only consumer is `Timeline.tsx`, so no People/Projects/Kompetencje file (increments 3/4) is affected and file-disjointness holds.
- **Fix**: —
- **Decision**: ACCEPT — needed for Phase 5's frozen-column criterion; Timeline-only consumer, additive-only edit. `out-of-plan-files` guard raised.

### F2 — Phase 7 Part 1 (`AllocationModal.tsx`, `TimeOffModal.tsx`) has no diff
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `src/components/timeline/AllocationModal.tsx`, `src/components/timeline/TimeOffModal.tsx`
- **Detail**: Both files are "in plan, not in diff", but they are already themed on `origin/main` (30 and 4 `light:` classes; commits `7ed8b60`, `45972e2`). I read every `className` in both files: remaining unprefixed classes are the indigo submit button, white check-mark glyphs and a hex project dot, all theme-agnostic by the plan's own wording. No dark leftover found by class inspection.
- **Fix**: —
- **Decision**: ACCEPT — the work is already merged; nothing to add.

### F3 — Page background `light:bg-slate-50` added locally in `TimelineClient`; layout wrapper still has no light background
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Architecture
- **Location**: `src/app/(dashboard)/timeline/TimelineClient.tsx:32`, `src/app/(dashboard)/layout.tsx:25`
- **Detail**: Increment 1 left the layout wrapper at `bg-slate-900` with no `light:` override. The implementer worked around it on the Timeline page root (within the plan's file list for Phase 5). It works, but increments 3 and 4 hit the same gap and would each need their own local patch; a single `light:bg-slate-50` on the wrapper would cover all pages.
- **Fix**: Follow-up (any later increment or a separate change): add `light:bg-slate-50` to the layout wrapper class and drop the per-page copies.
- **Decision**: ACCEPT — correct and within scope for this increment; `layout.tsx` belongs to merged increment 1. Raised as an `adaptation` guard.

## Notes on automated checks

- `npm run build` — **PASS** (Next.js 16 / Turbopack, exit 0, all routes generated). Compiled CSS confirmed to contain the new rules, e.g. `light:text-slate-800!` -> `:where(.light,.light *){color:var(--color-slate-800)!important}`, the `light:[background:repeating-linear-gradient(...)]!` rule and `light:border-l-slate-400!`. The `!important` forms are required because the OOO block and allocation text colours are set by inline `style`; verified they win over the inline values.
- `npm run lint` — exit 1 with 7 problems (4 errors, 3 warnings), all pre-existing and on lines this increment does not touch (`Timeline.tsx` `assignLanes`, `_event`, `isDragging.current` at render; `TimeOffModal.tsx` setState-in-effect, etc.). Increment 1 recorded 8 on the baseline, so no new problems. `eslint` scoped to the 6 changed files other than `Timeline.tsx`: 0 problems. Treated as PASS ("no new errors").
- Contrast-direction check: every `hover:*` that changes background/text also has a `light:hover:*` sibling in the diff, so the higher-specificity `:hover` rule does not leak dark colours in light mode.
- Architecture gate: `context/architecture/model.c4` exists; the diff changes only `className` strings and adds no imports, data access, routes or externals, so no boundary can be crossed. `facts.mjs` was not run separately.
- Colour-preservation: allocation background tint and left border still read raw `project.color` (`Timeline.tsx:169-176` unchanged); only the text glyph gets `light:text-slate-800!`. `formatAvailability()` colours and `utils.ts` untouched; the availability track gets `light:bg-slate-200` only.

## Soft guards raised

- **`out-of-plan-files`** — `src/components/ui/ContractTypeBadge.tsx` (F1).
- **`adaptation`** — page background applied in `TimelineClient` rather than the layout (F3); Phase 7 Part 1 satisfied by earlier merged work (F2).
- **`manual-pending`** — 5.3, 6.3, 6.4, 6.5, 7.3 remain `- [ ]`, correctly unchecked; they need the preview (light-hue project colours, red over-allocation, time-off gradient, filters/month picker).
