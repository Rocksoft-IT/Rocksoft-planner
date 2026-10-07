<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Planners can switch RS Planner between dark and light theme

**Plan**: context/changes/theme-preference/plan.md   **Scope**: Increment 3 (Phases 8-9, People + Projects theming)   **Date**: 2026-10-07
**Round**: 2   **Verdict**: APPROVED   **Findings**: 4

## Verdicts
| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria run locally (worktree already had `node_modules`):
- `npm run build` — PASS (all routes compiled, incl. /people, /projects).
- `npm run lint` — PASS for "no new errors": 4 errors + 3 warnings exist, all in files this diff does not touch or on lines it does not touch (`ProjectModal.tsx:28`, `AllocationModal.tsx:51`, `TimeOffModal.tsx:36`, `Timeline.tsx:706` errors; `PeopleClient.tsx:103` `useMemo` deps warning, untouched). Scoped `eslint` over the 5 owned files: 0 errors, 1 pre-existing warning.
- Manual 8.3 / 9.3: pending (human on preview). Diff evidence below.

Diff scope: 5 code files (`PeopleClient.tsx`, `ProjectsClient.tsx`, `PersonModal.tsx`, `ColorPicker.tsx`, `RoleSelect.tsx`), ~100 changed lines; reviewed inline, no subagents. In plan NOT diff: `ProjectModal.tsx` and most of `PersonModal.tsx` (incl. the avatar swatch grid, `PersonModal.tsx:174`) — already themed in increment 1 (`7ed8b60`), so not missing. No out-of-plan files.

## Findings

### F1 — Dashboard page background stays dark in light theme; People/Projects headings become unreadable
- **Severity**: CRITICAL
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `src/app/(dashboard)/layout.tsx:25` (`className="flex h-screen bg-slate-900 overflow-hidden"`), consumed by `src/app/(dashboard)/people/PeopleClient.tsx:106` and `src/app/(dashboard)/projects/ProjectsClient.tsx:23` (both root `<div className="p-6">`, no background of their own)
- **Detail**: Confirmed the implementer's note. The themed wrapper carries `bg-slate-900` with no `light:` override and nothing downstream paints a background, so in light theme the area behind the cards is still dark slate. This increment then sets page-level text to dark: titles `light:text-slate-900` (`PeopleClient.tsx:110`, `ProjectsClient.tsx:26`), subtitles/labels `light:text-slate-600` (e.g. `PeopleClient.tsx:111,159,181`, empty states `:305,318`, `ProjectsClient.tsx:85`). Dark text on `#0f172a` is effectively invisible (slate-900 on slate-900 = 1:1; slate-600 on slate-900 ~ 2.7:1), while the white cards sit on a dark canvas. `grep` shows no `light:bg-slate-50`/similar anywhere in `src/` for the page canvas, and no phase in the plan owns the wrapper background (Phase 2 only added the `.light` class; layout.tsx is not in any later phase's file list), so increments 2 and 4 will hit the same gap. Phases 8/9's goal (FR-004: People and Projects render correctly in light theme) is not met.
- **Fix**: Give the page canvas a light background. Preferred for this increment (stays inside owned, file-disjoint files, no merge conflict with increments 2/4): add `min-h-full light:bg-slate-50` to the root `<div className="p-6">` of `PeopleClient.tsx` and `ProjectsClient.tsx` so it fills the visible `<main>` area. The one-token alternative, `light:bg-slate-50` on the wrapper in `layout.tsx:25`, is cleaner overall but touches increment 1's shared file; the orchestrator may apply it once instead (an identical edit from multiple increments merges cleanly).
- **Decision**: FIXED (5472b91) — verified r2

### F2 — Projects "Active" badge uses the raw project colour as text; unreadable for light-hue projects on a white card
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `src/app/(dashboard)/projects/ProjectsClient.tsx:70-76` (`backgroundColor: hexToRgba(project.color, 0.15), color: project.color`)
- **Detail**: Same pattern the plan already proved risky for allocation blocks (plan "Allocation-block text contrast"; Phase 6, increment 2), but Phase 9 did not cover it and the diff leaves it untouched. Computed WCAG contrast of each `PROJECT_COLORS` swatch (`src/lib/utils.ts:109-122`) as 12px text on its own 15% tint over a white card: lime `#84cc16` 1.78, amber `#f59e0b` 1.91, cyan `#06b6d4` 2.11, teal `#14b8a6` 2.17, emerald `#10b981` 2.19, orange `#f97316` 2.40, pink 2.94, blue 3.09, red 3.10, violet 3.53, indigo 3.70, rose 3.70. All 12 are below 4.5:1; the light hues are close to illegible. The same neutral text (slate-900) on that tint scores 14-16:1. Dark theme is unaffected (these colours read fine on slate-900).
- **Fix**: Keep the tint (`backgroundColor`) and the card's left border/dot as raw `project.color`; in light theme only switch the badge text to a fixed neutral. Because the colour is set via inline `style`, a plain `light:text-slate-800` class loses to it: use Tailwind 4's important modifier (`light:text-slate-800!`) or move the colour out of the inline style. Mirror whatever Phase 6 uses for allocation blocks so both stay consistent.
- **Decision**: FIXED (5472b91) — verified r2

### F3 — Availability status text (People list) coloured with Tailwind-500 hexes on white
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `src/app/(dashboard)/people/PeopleClient.tsx:265-270` (`style={{ color: av.color }}`, 10-11px)
- **Detail**: The label colours come from `formatAvailability()` (e.g. emerald `#10b981`, ~2.5:1 on white) and are deliberately left untouched by the plan's Implementation Approach ("formatAvailability() status colours ... left untouched in both themes ... legibility verified manually"). Bar fills/over-allocation red are fine. Small text at ~2.5:1 is below AA, but it is a recorded, deliberate trade-off.
- **Fix**: —  (human to eyeball on the preview under 8.3; revisit only if it reads poorly)
- **Decision**: ACCEPT — matches the plan's recorded decision on formatAvailability status colours (Implementation Approach, last paragraph).

### F4 — Phase 9 planned `ProjectModal.tsx`; Phase 8 planned most of `PersonModal.tsx`, none changed in this diff
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `src/components/projects/ProjectModal.tsx`, `src/components/people/PersonModal.tsx`
- **Detail**: Both were already themed by increment 1 (`7ed8b60 fix(theme): theme modal form content for light mode`, e.g. `ProjectModal.tsx:81`, `PersonModal.tsx:174` avatar swatch ring with `light:ring-slate-900 light:ring-offset-white`). Spot-grep finds no remaining unprefixed text/bg classes in either file except the white-on-indigo submit button (correct in both themes). The one remaining gap (`PersonModal.tsx:159` helper text) is fixed in this diff. Not a drift.
- **Fix**: —
- **Decision**: ACCEPT — work already present; plan's file list overlapped with increment 1's late fix.

## Manual criteria (diff evidence)
- 8.3 People list, group toggle, availability bars, PersonModal: list/toggle/search/empty states themed in the diff; avatar colour values untouched (`PeopleClient.tsx:241` inline `avatar_color`). Pending human check, **blocked on F1** (page canvas).
- 9.3 Projects cards, ProjectModal, swatch picker: cards and `ColorPicker.tsx:21` ring themed; project colours untouched. Pending human check, **blocked on F1 and F2**.

## Round 2
Re-review of fix commit `5472b91` (read `fix-r1.md` and the commit diff; no full-suite re-run, `fix-r1.md` carries the lint baseline comparison and test run).
- F1: `min-h-full light:bg-slate-50` added to the root div of `PeopleClient.tsx:106` and `ProjectsClient.tsx:23`; no dark-theme class touched, so dark is unchanged. The page canvas now turns light under `.light`; the dark titles/labels from round 1 sit on it legibly (slate-900 on slate-50 ~17:1, slate-600 ~7:1). Percent `min-h-full` resolves because `<main>` is a stretched flex item (`layout.tsx:29`).
- F2: `light:text-slate-800!` added to the Active badge (`ProjectsClient.tsx:73`); the inline tint and `project.color` are untouched, important modifier beats the inline `style` colour. Generated CSS contains both new variants (per `fix-r1.md`).
- Re-ran `npm run build`: exit 0. Fix commit touched only the two owned files plus `fix-r1.md`; no ACCEPT finding (F3, F4) was touched.
- Manual 8.3 / 9.3 remain pending (human on preview). Increment 3 is not the last increment, so `change.md` status is untouched.
