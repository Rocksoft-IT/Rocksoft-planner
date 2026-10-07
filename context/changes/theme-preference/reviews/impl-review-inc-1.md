<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Theme preference (light/dark)

**Plan**: context/changes/theme-preference/plan.md   **Scope**: Increment 1 (Phases 1-4)   **Date**: 2026-09-15
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

### F1 — `.light` class lives on `ThemeProvider`'s own element, not literally `layout.tsx`'s `<div>`
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `src/components/ThemeProvider.tsx:47-53`, `src/app/(dashboard)/layout.tsx:19-29`
- **Detail**: Phase 2's contract says the wrapper `<div>` in `layout.tsx:19` gets the `.light` class. The implementer instead renders that div inside the new Client Component `ThemeProvider`, passing `className` through, because a headless context provider has no DOM node to react to `setTheme` for instant switching. Verified this preserves the plan's actual intent: `layout.tsx` still computes `initialTheme` server-side from the already-fetched `profile` (no new query), `ThemeProvider` seeds `useState(initialTheme)` with that same value, so the class is present in the very first server-rendered HTML — no client effect toggles it after mount. Built the app and inspected the compiled CSS (`.next/static/chunks/*.css`): `.light\:bg-white:where(.light,.light *){background-color:var(--color-white)}` is generated and reachable exactly as designed. No-flash and zero-new-query properties both hold.
- **Fix**: —
- **Decision**: ACCEPT — the letter of "wrapper `<div>`" couldn't survive contact with React's server/client boundary (a Server Component can't hold the `setTheme` state), and the adaptation preserves every property the plan actually cared about (no new query, no flash, `/auth/*` untouched).

### F2 — Avatar `DropdownMenu` rendered without `DropdownMenu.Portal`
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `src/components/Sidebar.tsx:118-192`
- **Detail**: Phase 3's contract doesn't mention portaling one way or the other; the implementer explicitly chose no portal, matching `Modal.tsx`'s established no-portal convention (`src/components/ui/Modal.tsx:26-40`, and the plan's own stated reason for that convention: "a class scoped to an ancestor `<div>` (not `<html>`) still reaches every modal"). Verified in `node_modules/@radix-ui/react-popper/dist/index.mjs:93` that Radix's Popper positioning (`useFloating`) defaults to `strategy: "fixed"` regardless of portal use, so omitting the portal costs nothing positioning-wise while keeping the dropdown's DOM node a descendant of the `.light`-scoped ancestor, exactly as intended. `@radix-ui/react-dropdown-menu` was previously an installed-but-unused dependency (confirmed via `grep -r "@radix-ui" src/` returning only this new usage), so there was no prior in-repo convention to conflict with.
- **Fix**: —
- **Decision**: ACCEPT — matches the plan's own architectural reasoning for `Modal.tsx`, applied analogously to a component the plan's phase-3 wording didn't explicitly cover; verified against Radix's actual positioning implementation, not just the code comment's claim.

### F3 — Modal close-icon keeps `text-slate-400` at rest in light mode (only its hover state gets a `light:` override)
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `src/components/ui/Modal.tsx:32`
- **Detail**: `className="text-slate-400 hover:text-white light:hover:text-slate-900 transition"` — the resting-state color has no `light:` counterpart, unlike every other themed class in the same file. `#94a3b8` (slate-400) on a white panel is a legible mid-gray, so this is unlikely to read as a "dark leftover," but it's the one spot in this file's diff that doesn't follow the file's own pattern of pairing every dark class with a `light:` sibling.
- **Fix**: add `light:text-slate-500` (or similar) to the resting state for consistency with the rest of the file, if it reads too faint on the preview.
- **Decision**: ACCEPT — cosmetic, plausible as-is from the hex value, and Phase 4's manual criterion ("no dark leftovers in the overlay, panel, header, or close icon") is still pending human verification on the preview; flagging here so it's the first thing to look at if the close icon looks off.

## Notes on automated checks

- `npm run build` — **PASS** (Next.js 16.2.6/Turbopack, ran locally; compiled, typechecked, and generated all routes successfully).
- `npm run lint` — ran locally: 8 pre-existing problems (5 errors, 3 warnings) reported, all in files this increment never touches (`ProjectModal.tsx`, `AllocationModal.tsx`, `TimeOffModal.tsx`, `Timeline.tsx`). Verified by running the identical lint command against `origin/main` in a separate worktree: same 8 problems, same locations — confirmed pre-existing, not introduced by this increment. Ran `npx eslint` scoped to only this increment's touched files (`layout.tsx`, `Sidebar.tsx`, `ThemeProvider.tsx`, `Modal.tsx`, `types.ts`) — zero problems. **PASS** for this increment's scope.
- Phase 1's `#### Automated` schema-text-match criterion — verified by reading `migrations/2026-09-15-profile-theme.sql` against `supabase-schema.sql:15-23`: same column type/default (`text not null default 'dark'`) and same allowed values (`'light','dark'`), migration uses a named `alter table ... add constraint` (idempotent), mirror uses an inline `check(...)` — both forms already coexist elsewhere in `supabase-schema.sql` (e.g. `kind text not null check (kind in ('skill','technology'))` at `:180` vs. named constraints elsewhere). **PASS**.
- Tailwind 4 `@custom-variant` syntax (`src/app/globals.css:12`) — verified directly against the installed `tailwindcss@4.3.0` source (`node_modules/tailwindcss/dist/lib.mjs`, the `@custom-variant` selector-form parsing branch) rather than assuming; the syntax used is the documented selector form and compiles to the expected generated CSS (see F1's evidence). Satisfies the AGENTS.md instruction to check Next/Tailwind-specific patterns against the installed package rather than training-data assumptions.
- `git diff` scope — confirmed via `git diff origin/main...HEAD --stat` that only the planned files for Phases 1-4 changed in `src/`/`migrations/`/`supabase-schema.sql` (`migrations/2026-09-15-profile-theme.sql`, `src/app/(dashboard)/layout.tsx`, `src/app/globals.css`, `src/components/Sidebar.tsx`, `src/components/ThemeProvider.tsx` [new], `src/components/ui/Modal.tsx`, `src/lib/types.ts`, `supabase-schema.sql`); no Timeline/People/Projects/Kompetencje files were touched (increments 2-4 correctly untouched). `tailwind-merge`'s handling of the new `light:` prefix was spot-checked with a small Node script — it treats `light:` as a distinct variant and does not collapse `light:`-prefixed classes with their unprefixed counterparts.

## Soft guards raised

- **`adaptation`** — F1 and F2 above: both disclosed by the implementer up front, both verified to preserve the plan's actual intent rather than just its literal wording.
- **`out-of-plan-files`** — `context/foundation/tech-stack.md`, `context/foundation/README.md`, `context/changes/README.md` were added earlier on this branch (commit `cc680fd`, routine `rs-init` bootstrap because the repo had no `context/foundation/` yet) and `context/changes/theme-preference/research.md` (commit `bbeecac`). None are application code; none are mentioned in `plan.md`'s phase file lists because they are pipeline scaffolding, not part of the feature. No action needed.
- **`manual-pending`** — every `#### Manual` row for Phases 1-4 is still `- [ ]` in `plan.md`'s `## Progress` (1.3, 2.3-2.5, 3.3-3.4, 4.3). None were checked without evidence ("blind signing") — correctly left for hands-on verification on the preview. Code-level evidence supports each of them (see F1's no-flash evidence for 2.3/2.4; F2/F3 above for 3.3/4.3), but only a human on the actual preview can confirm the visual outcome.
