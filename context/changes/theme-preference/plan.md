# Theme preference (light/dark) — Implementation Plan

## Overview

RS Planner is dark-only today, with every colour hardcoded directly into components. This change lets a signed-in user switch to a light theme from a menu under their avatar in the sidebar, stores the choice on their Supabase profile so it follows them across devices and sign-ins, and defaults every existing/never-chosen account to the current dark look with zero visual change. Sign-in/registration/password-reset stay dark unconditionally, since there is no account to read a preference from before login.

## Current State Analysis

- No theming infrastructure exists: no `tailwind.config.*` (Tailwind 4 CSS-first, `@import "tailwindcss"` only in `src/app/globals.css:1`), no `dark:` variant anywhere in `src/`, no `darkMode` config, no CSS custom properties for colour, no design-token layer. All colour is either a hardcoded Tailwind utility class (slate/indigo dominate, ~260/~90 occurrences) or a raw hex string applied via inline `style` (project/avatar colours, availability-bar status colours, scrollbar colours).
- `profiles` (`supabase-schema.sql:10-20`) has no `theme` column. RLS already lets a user update their own row (`"profiles: update own"`, `supabase-schema.sql:117-118`) — no policy change needed.
- `(dashboard)/layout.tsx:8-24` is a Server Component that already does `supabase.auth.getUser()` and `profiles.select('*')...single()` before rendering `<Sidebar>` — a `theme` column arrives there with no new query, and its wrapper `<div>` (`:19`) is the natural place to attach an SSR-rendered theme class with zero flash.
- `/auth/*` pages have no shared layout with `(dashboard)` and never receive `profile` (confirmed: `src/app/auth/` has no `layout.tsx`) — they are already structurally isolated, so "always dark" requires no change to them or to the root layout.
- `src/components/ui/Modal.tsx` renders in-tree with no React portal — a theme class scoped to an ancestor element (not `<html>`) still reaches every modal despite their `fixed` positioning.
- `Modal.tsx` is the one primitive shared across all 4 screen areas (imported by all 5 modals). Timeline-only filters (`PeopleFilter`, `ProjectFilter`, `SkillsFilter`, `MonthPicker`) are consumed only by `Timeline.tsx`; People/Projects/Kompetencje have their own area-local components with no cross-area sharing besides `Modal.tsx`. This makes Timeline / People+Projects / Kompetencje file-disjoint once `Modal.tsx` and the theme mechanism are handled once, up front.
- The highest-risk spots are JS-computed colours that no Tailwind class sweep can reach: `formatAvailability()` (`src/lib/utils.ts:143-196`) returns bare hex literals including the over-allocation `#ef4444` red; the allocation-block renderer (`Timeline.tsx:169-189`) uses the same raw `project.color` hex as both the background-tint source and the literal text colour — safe on today's dark backdrop, not guaranteed once the backdrop turns light.
- `@radix-ui/react-dropdown-menu` and five sibling `@radix-ui/*` packages are already installed dependencies with zero usages in `src/` — available for the new avatar menu without adding a dependency.
- No automated test runner or CI exists in this repository (`context/foundation/tech-stack.md`). The only agent-runnable checks are `npm run lint` and `npm run build`; everything else — including the hardest acceptance criterion, "the dark theme looks the same as it does today, screen for screen" — can only be verified by hands-on, screen-by-screen review. This is a real, accepted risk, not a gap this plan can close.

Full detail and every citation: `research.md`.

## Desired End State

A signed-in user opens a menu under their avatar in the sidebar and switches between light and dark. The whole authenticated app — Timeline (grid, frozen pane, month header, availability bar, allocation and time-off blocks), People, Projects, Kompetencje, every modal, dropdown, filter, picker, empty state, error/validation message, and the custom scrollbar — renders correctly in the chosen theme immediately, with no reload and no flash of the wrong theme on load. The choice is stored on the user's profile and applies on every device after every sign-in. A user who has never chosen anything sees exactly today's dark theme, unchanged. Sign-in, registration, and password-reset always render dark, regardless of the signed-in account's stored preference, and switch to the chosen theme immediately once the user is signed in. User-picked project and avatar colours render exactly as picked in both themes, and text on allocation blocks and avatars stays readable. Over-allocation red on the availability bar stays clearly red in both themes.

### Key discoveries

- `(dashboard)/layout.tsx:12-16` already `select('*')`s the full profile row before rendering `<Sidebar>` — adding a `theme` column costs no new query and lets the SSR-rendered class be correct on first paint (no-flash NFR satisfied by construction).
- `src/components/ui/Modal.tsx:26-40` has no portal — a class scoped to an ancestor `<div>` (not `<html>`) still reaches every modal.
- `src/app/auth/` has no `layout.tsx` and auth pages never receive `profile` (`src/app/auth/login/page.tsx:34` renders standalone under the root layout) — "always dark" needs zero changes to auth pages or the root layout.
- The allocation-block text-legibility risk is provable today, not hypothetical: `PROJECT_COLORS` (`src/lib/utils.ts:99-112`) is a fixed 12-swatch palette, and `Timeline.tsx:182,187,189` sets text `color` to the exact same hex used as the background-tint source (`Timeline.tsx:169-172`) — several of those 12 swatches will read poorly as text against a light page backdrop even though the same combination reads fine against today's dark backdrop.
- `PeopleFilter.tsx`, `ProjectFilter.tsx`, `SkillsFilter.tsx`, `MonthPicker.tsx` are consumed only by `Timeline.tsx` (confirmed via import grep) — despite living in `src/components/ui/`, they are Timeline-scoped, not cross-area shared.
- `@radix-ui/react-dropdown-menu` is an installed, unused dependency — no new dependency needed for the avatar menu.

## What we're NOT doing

- No rebrand or new brand palette — light theme is an inversion of the existing look, not a new visual identity.
- No automatic switching by time of day or OS setting — the preference is explicit, set once from the avatar menu.
- No high-contrast mode and no WCAG accessibility audit.
- No touch/mobile support work.
- No theming of sign-in, registration, or password-reset screens — they stay dark unconditionally.
- No changes to the read-only Competency API (`src/app/api/*`) or the `rockplanner-competency` MCP server.
- No changes to availability/utilisation maths, Timeline drag/resize/filter interaction, or any allocation/time-off/project/competency data.
- No new automated visual-regression tooling — none exists today and introducing one is out of scope for this change.
- No wiring-up of the currently-unused per-type `TIME_OFF_LABELS` colours as a new feature — only the existing hardcoded time-off block chrome gets a light-mode equivalent.
- No restructuring of the existing sign-out control — the new avatar menu is additive alongside it.

## Implementation Approach

**Storage**: a new `profiles.theme text not null default 'dark' check (theme in ('light','dark'))` column, added via a dated idempotent migration mirrored into `supabase-schema.sql`, matching the repo's existing CHECK-constraint and migration conventions (`migrations/2026-07-16-allocation-updated-by.sql`, `supabase-schema.sql:175,266-268`). The `handle_new_user()` trigger is left untouched — like `capacity_hours_per_day`, `theme` relies on its column `DEFAULT` rather than being seeded explicitly, matching existing convention.

**Theming mechanism**: additive, not a rewrite. Every existing hardcoded class already *is* the dark appearance; the plan leaves all of them untouched and layers new light-mode-only overrides on top via a Tailwind 4 class-scoped variant (exact CSS-first syntax to be confirmed against the installed `tailwindcss` package docs at implementation time, per `AGENTS.md`). This was chosen over rewriting the base classes into a token system, because a rewrite would touch and risk every one of the same ~350 colour-class occurrences with no corresponding safety benefit, given there is no automated visual-regression coverage to catch a mistake — and it makes FR-006 ("the dark theme looks the same as it does today") true by construction for every line that isn't deliberately touched.

The scoping class is applied to the `(dashboard)` layout's wrapper `<div>` (`(dashboard)/layout.tsx:19`), not to `<html>` in the root layout. This costs no new query (the profile is already fetched there), requires no change to the root layout, and leaves `/auth/*` untouched by construction since those routes never render inside that wrapper. Because `Modal.tsx` has no portal, this scoping still reaches every modal, dropdown, and picker despite their `fixed` positioning.

**Instant switch + persistence**: a client-side theme context (`ThemeProvider`) wraps the dashboard content, seeded from the server-fetched `profile.theme` (no flash on load), holding the active theme in React state so the UI updates the instant the user picks a new value (no reload). Selecting a new theme also persists it via the browser Supabase client (`.from('profiles').update({ theme }).eq('id', profileId)`), mirroring the existing update pattern already used by `ProjectModal.tsx:58`, `PersonModal.tsx:58`, and `TimeOffModal.tsx:62`.

**Avatar menu**: a new dropdown, built on the already-installed-but-unused `@radix-ui/react-dropdown-menu`, triggered from the existing avatar/user row in `Sidebar.tsx`, added alongside (not replacing) the existing sign-out button.

**Allocation-block text contrast** (resolved via one `rs-advisor` consult, given no option was clearly better on evidence alone): the background tint and left border keep using the raw `project.color` hex exactly as today in both themes — the stored colour value is never altered, satisfying "project colours keep the exact values users picked." In light theme only, the text glyph switches from the raw hex to a fixed, readable neutral colour instead of literally rendering in `project.color`; the colour identity stays visible via the background tint and border. This was chosen over (a) leaving the pattern untouched and hoping manual QA catches it — rejected because the failure is provable today from the fixed 12-swatch palette, not hypothetical — and (b) raising the background-tint alpha in light mode to compensate — rejected because it is mathematically backwards (pulling the tint's colour toward the text's own colour collapses contrast further, it does not improve it).

**formatAvailability() status colours** (including the `#ef4444` over-allocation red) and the Tailwind 500-weight semantic colours used elsewhere (emerald/amber/red status borders and chips) are left untouched in both themes: Tailwind's 500-weight shades are designed for reasonable legibility against both light and dark backdrops, unlike the allocation-block pattern above which reads the *same* palette as literal text over a variable-luminance tint. Legibility is verified manually per phase, consistent with the repo having no automated visual-regression coverage.

## Increments

| # | Name | Phases | Depends on | User-visible | Status | PR |
|---|---|---|---|---|---|---|
| 1 | Theme foundation (schema, mechanism, avatar menu, shared modal chrome) | 1-4 | — | yes | pending | — |
| 2 | Timeline theming | 5-7 | 1 | yes | pending | — |
| 3 | People + Projects theming | 8-9 | 1 | yes | pending | — |
| 4 | Kompetencje theming | 10 | 1 | yes | pending | — |

Increments 2, 3, and 4 are file-disjoint from each other (confirmed in research) and may run in parallel once increment 1 is merged.

## Phase 1: Profile theme column

### Overview
Add the schema this whole change depends on: a per-user `theme` preference that defaults to today's dark appearance for every existing and future account.

### Required changes
#### 1. Profiles schema
- **File**: `migrations/2026-09-15-profile-theme.sql` (new)
- **Goal**: persist the theme choice per account so it follows the user across devices and sign-ins (FR-002), defaulting to dark so no existing account changes appearance on release (FR-003).
- **Contract**: idempotent `alter table public.profiles add column if not exists theme text not null default 'dark';` plus an idempotent CHECK constraint restricting values to `'light'`/`'dark'` (`drop constraint if exists` + `add constraint`, matching `supabase-schema.sql:266-268`'s pattern), a WHY/HOW header banner matching `migrations/2026-07-16-allocation-updated-by.sql`'s format, and an explicit rollback note (`alter table public.profiles drop column if exists theme;` — safe, no dependent data, no other table references this column).

#### 2. Schema mirror
- **File**: `supabase-schema.sql`
- **Goal**: keep fresh-install schema in lockstep with the live-database migration, per repo convention.
- **Contract**: the same column + CHECK constraint added to the `profiles` table definition, with a comment pointing back at the migration file for WHY/HOW (matching the style at `supabase-schema.sql:167-170,462-465`).

#### 3. Profile type
- **File**: `src/lib/types.ts`
- **Goal**: make the new field visible to TypeScript consumers.
- **Contract**: `Profile.theme: 'light' | 'dark'` added to the interface (`types.ts:1-11`); `TeamMember` is unaffected (it has no theme concept — themes are per signed-in account, not per team-member record).

### Success criteria
#### Automated
- [ ] `npm run lint` passes with no new errors
- [ ] the column/constraint text added to `supabase-schema.sql` matches the migration's column/constraint (manual diff, agent-checkable)
#### Manual
- [ ] the migration applied via the Supabase Dashboard SQL editor on a dev/staging project leaves every existing profile row reading `theme = 'dark'`, with no other column affected

## Phase 2: Theme mechanism (no-flash SSR + instant client switch)

### Overview
Build the plumbing every other phase relies on: a light-mode-scoped styling variant that leaves the dark appearance untouched by default, an SSR-rendered theme class with zero flash, and a client-side context that flips instantly and persists the choice.

### Required changes
#### 1. Light-mode variant
- **File**: `src/app/globals.css`
- **Goal**: a way to write light-mode-only colour overrides without touching any existing (dark) class, satisfying FR-006 by construction for every untouched line.
- **Contract**: a Tailwind 4 CSS-first custom variant scoped to a `.light` ancestor class (exact directive verified against the installed `tailwindcss` package docs before writing, per `AGENTS.md` — `node_modules` is not present in this worktree and was not available to verify during planning). Custom-scrollbar rules (`globals.css:16-29`) get light-mode equivalents scoped the same way.

#### 2. SSR theme class, no flash
- **File**: `src/app/(dashboard)/layout.tsx`
- **Goal**: first paint already matches the signed-in user's stored preference, satisfying "no flash of the wrong theme" without any client-side effect.
- **Contract**: the wrapper `<div>` (`:19`) gets the `.light` class added when `profile?.theme === 'light'`, using the profile already fetched at `:12-16` — no new query. `/auth/*` and the root layout are untouched.

#### 3. Theme context
- **File**: `src/components/ThemeProvider.tsx` (new)
- **Goal**: let a deeply nested component (the new avatar menu) change the theme instantly, and persist the choice to the account.
- **Contract**: a client component wrapping the dashboard content, taking `initialTheme` and `profileId` props; exposes the active theme and a setter via context; the setter updates local state immediately (instant switch, no reload) and issues `supabase.from('profiles').update({ theme }).eq('id', profileId)` via the browser client (`src/lib/supabase/client.ts`), mirroring the existing `.update()` convention at `ProjectModal.tsx:58`.

### Success criteria
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with no new errors
#### Manual
- [ ] with no theme set (new/never-chosen account), the dashboard renders identically to before this change (AC-03)
- [ ] a hard reload of a light-preference account shows the light theme on first paint, no dark flash (NFR)
- [ ] sign-in, registration, and password-reset screens render dark regardless of the signed-in account's stored preference, because they render outside the themed wrapper entirely (AC-04)

## Phase 3: Avatar menu + Sidebar theming

### Overview
Give the user the control the issue asks for, and theme the sidebar chrome itself.

### Required changes
#### 1. Avatar menu
- **File**: `src/components/Sidebar.tsx`
- **Goal**: let a signed-in user switch theme from the menu under their avatar (FR-001), without disturbing the existing sign-out control.
- **Contract**: a new dropdown menu (built on `@radix-ui/react-dropdown-menu`, already an installed dependency) triggered from the existing avatar/user row (`:102-124`), containing a light/dark switch wired to `ThemeProvider`'s setter; the existing sign-out button (`:114-122`) is untouched and remains a separate control.

#### 2. Sidebar theming
- **File**: `src/components/Sidebar.tsx`
- **Goal**: the sidebar itself (logo, nav, user block) renders correctly in both themes.
- **Contract**: `light:`-prefixed overrides added alongside the existing (untouched) classes at `:68,70,71,76,90-96,102-122`.

### Success criteria
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with no new errors
#### Manual
- [ ] clicking the avatar opens the menu; selecting light recolors the sidebar immediately, with no reload (AC-01)
- [ ] signing in again on a light-preference account shows light without re-selecting it (AC-02)

## Phase 4: Shared modal chrome theming

### Overview
Theme the one primitive shared by every modal in every area, so increments 2-4 inherit correct modal chrome without each needing to touch it.

### Required changes
#### 1. Modal chrome
- **File**: `src/components/ui/Modal.tsx`
- **Goal**: every modal across all 4 areas (People, Projects, Kompetencje, Timeline) renders correctly in both themes without duplicated work.
- **Contract**: `light:`-prefixed overrides added alongside the existing overlay/panel/header/title/close-icon classes (`:28-32`).

### Success criteria
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with no new errors
#### Manual
- [ ] any modal opened in light mode shows no dark leftovers in the overlay, panel, header, or close icon (AC-01)

## Phase 5: Timeline grid, frozen pane, month header

### Overview
Theme the Timeline's structural chrome: the grid, the sticky person-name column, and the month/date header row.

### Required changes
#### 1. Timeline shell and grid
- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: FR-004 coverage for the Timeline grid, frozen pane, and month header.
- **Contract**: `light:`-prefixed overrides for the grid/header/sticky-column backgrounds, borders, and text (`:581,669-718,729-787` and related), leaving every unprefixed (dark) class untouched.

#### 2. Timeline page wrapper
- **File**: `src/app/(dashboard)/timeline/TimelineClient.tsx`
- **Goal**: the page-level header around the Timeline matches.
- **Contract**: `light:`-prefixed overrides at `:33-35`.

### Success criteria
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with no new errors
#### Manual
- [ ] the Timeline grid, frozen person-name column, and month header render correctly in both themes, with the sticky column still visually separated from scrolled content (AC-01)

## Phase 6: Availability bar, allocation blocks, time-off blocks

### Overview
Theme the Timeline's data-carrying surfaces without altering any stored colour value, and fix the one proven text-legibility risk.

### Required changes
#### 1. Allocation block text contrast
- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: preserve `project.color` exactly (FR-005) while keeping allocation-block text readable in light theme, per the resolved design (Implementation Approach).
- **Contract**: background tint (`:169-171`) and left border (`:172`) keep using the raw `project.color`/`bg` hex unchanged in both themes; in light theme only, the text glyph at `:182,187,189` uses a fixed, readable neutral colour instead of the raw hex.

#### 2. Availability bar and time-off blocks
- **File**: `src/components/timeline/Timeline.tsx`
- **Goal**: FR-004 coverage for the availability bar and time-off blocks, with the over-allocation red staying clearly red in both themes.
- **Contract**: `formatAvailability()`'s four status colours (`src/lib/utils.ts:173-179`, incl. `#ef4444`) are left unchanged in both themes; the availability track (`:752`, `bg-slate-700`) gets a `light:` override. The time-off block's hardcoded gradient/border (`:237-238`) gets a light-mode equivalent of its own hex chrome; the text class (`:246`) gets a `light:` override. `TIME_OFF_LABELS[...].color` stays unused, as today.

### Success criteria
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with no new errors
#### Manual
- [ ] an allocation block using a light-hue project colour keeps readable text in light theme, while the block still visibly carries that project's colour via its background/border (AC-05)
- [ ] over-allocation (red) on the availability bar is clearly red in both themes (guardrail)
- [ ] time-off blocks render with a legible light-mode gradient and border

## Phase 7: Timeline modals and Timeline-only filters

### Overview
Finish Timeline-area coverage: its two modals, its three filter dropdowns, and the month picker.

### Required changes
#### 1. Timeline modals
- **File**: `src/components/timeline/AllocationModal.tsx`, `src/components/timeline/TimeOffModal.tsx`
- **Goal**: FR-004 coverage for allocation/time-off create-edit modals.
- **Contract**: `light:`-prefixed overrides for each file's hardcoded classes (status toggles, inputs, error banners); project-colour dots (`AllocationModal.tsx:371`) stay untouched (already theme-agnostic hex).

#### 2. Timeline filters and month picker
- **File**: `src/components/ui/PeopleFilter.tsx`, `src/components/ui/ProjectFilter.tsx`, `src/components/ui/SkillsFilter.tsx`, `src/components/ui/MonthPicker.tsx`
- **Goal**: FR-004 coverage for Timeline's filter dropdowns and month picker (confirmed Timeline-only consumers, no cross-area impact).
- **Contract**: `light:`-prefixed overrides for each file's trigger/popover/row classes; avatar/project colour chips stay untouched.

### Success criteria
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with no new errors
#### Manual
- [ ] AllocationModal, TimeOffModal, and all three Timeline filter dropdowns plus the month picker render correctly with no dark leftovers in light mode (AC-01)

## Phase 8: People theming

### Overview
Theme the People screen and its person-editing modal.

### Required changes
#### 1. People screen and modal
- **File**: `src/app/(dashboard)/people/PeopleClient.tsx`, `src/components/people/PersonModal.tsx`, `src/components/ui/RoleSelect.tsx`
- **Goal**: FR-004 coverage for People.
- **Contract**: `light:`-prefixed overrides for each file's hardcoded classes, including `PersonModal.tsx`'s duplicated avatar-colour swatch grid (`:131-144`); avatar colour values stay untouched (FR-005).

### Success criteria
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with no new errors
#### Manual
- [ ] the People list, group toggle, availability bars, and PersonModal (including its avatar-colour picker) render correctly in both themes with avatar colours unchanged (AC-01, AC-05)

## Phase 9: Projects theming

### Overview
Theme the Projects screen and its project-editing modal.

### Required changes
#### 1. Projects screen and modal
- **File**: `src/app/(dashboard)/projects/ProjectsClient.tsx`, `src/components/projects/ProjectModal.tsx`, `src/components/ui/ColorPicker.tsx`
- **Goal**: FR-004 coverage for Projects.
- **Contract**: `light:`-prefixed overrides for each file's hardcoded classes, including the shared `ColorPicker.tsx` swatch grid; project colour values stay untouched (FR-005).

### Success criteria
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with no new errors
#### Manual
- [ ] Projects cards, ProjectModal, and the colour-swatch picker render correctly in both themes with project colours unchanged (AC-01, AC-05)

## Phase 10: Kompetencje theming

### Overview
Theme the Kompetencje screen, its inline competency editor, and its experience modal.

### Required changes
#### 1. Kompetencje screen and components
- **File**: `src/app/(dashboard)/competencies/CompetenciesClient.tsx`, `src/components/competencies/CompetencyEditor.tsx`, `src/components/competencies/ExperienceModal.tsx`, `src/components/competencies/TagMultiSelect.tsx`
- **Goal**: FR-004 coverage for Kompetencje, including its distinct amber info-box hue.
- **Contract**: `light:`-prefixed overrides for each file's hardcoded classes. No change to `src/app/api/*` or `mcp/` — the read-only Competency API and MCP server are out of the blast radius.

### Success criteria
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with no new errors
- [ ] `git diff` shows no changes under `src/app/api/` or `mcp/`
#### Manual
- [ ] Kompetencje tabs, search, tag chips, the inline competency editor, and ExperienceModal render correctly in both themes (AC-01)

## Testing Strategy

No automated test runner or CI exists in this repository. Every phase's Automated criteria are limited to `npm run lint` and `npm run build` (type-checking runs as part of `next build`). All visual and behavioural verification — including AC-03, "the dark theme looks the same as it does today, screen for screen" — is manual, screen by screen, per phase. This is an accepted, real risk carried from the issue itself (its own Open Questions section says the same), not something this plan can close by inventing test tooling that doesn't exist.

## Migration Notes

One migration, `migrations/2026-09-15-profile-theme.sql`: adds `profiles.theme text not null default 'dark' check (theme in ('light','dark'))`, idempotently (`add column if not exists`, `drop constraint if exists` + `add constraint`), mirrored into `supabase-schema.sql`. No backfill needed — the column default already gives every existing row `'dark'`. No RLS change needed — `"profiles: update own"` already permits a user to write their own row. **Rollback**: `alter table public.profiles drop column if exists theme;` — safe, no dependent data, no other table or view references this column, no data migrated by this change.

## References

- `context/changes/theme-preference/research.md` — full citations for every fact above.
- `context/changes/theme-preference/change.md` — issue #68 verbatim (Summary, Scope, FR-001..FR-007, AC-01..AC-05, Constraints, NFRs, Open questions).
- `migrations/2026-07-16-allocation-updated-by.sql` — migration convention this plan follows.
- `supabase-schema.sql:10-20,109-123,167-170,266-268,462-465` — `profiles` table, RLS, and CHECK/mirror conventions.

## Progress

### Phase 1: Profile theme column
#### Automated
- [x] 1.1 npm run lint passes with no new errors — 5b09645
- [x] 1.2 the column/constraint text added to supabase-schema.sql matches the migration's column/constraint — 5b09645
#### Manual
- [ ] 1.3 the migration applied via the Supabase Dashboard SQL editor on a dev/staging project leaves every existing profile row reading theme = 'dark', with no other column affected

### Phase 2: Theme mechanism (no-flash SSR + instant client switch)
#### Automated
- [x] 2.1 npm run build succeeds — b49a7e4
- [x] 2.2 npm run lint passes with no new errors — b49a7e4
#### Manual
- [ ] 2.3 with no theme set (new/never-chosen account), the dashboard renders identically to before this change
- [ ] 2.4 a hard reload of a light-preference account shows the light theme on first paint, no dark flash
- [ ] 2.5 sign-in, registration, and password-reset screens render dark regardless of the signed-in account's stored preference

### Phase 3: Avatar menu + Sidebar theming
#### Automated
- [x] 3.1 npm run build succeeds — 1b87fca
- [x] 3.2 npm run lint passes with no new errors — 1b87fca
#### Manual
- [ ] 3.3 clicking the avatar opens the menu; selecting light recolors the sidebar immediately, with no reload
- [ ] 3.4 signing in again on a light-preference account shows light without re-selecting it

### Phase 4: Shared modal chrome theming
#### Automated
- [x] 4.1 npm run build succeeds
- [x] 4.2 npm run lint passes with no new errors
#### Manual
- [ ] 4.3 any modal opened in light mode shows no dark leftovers in the overlay, panel, header, or close icon

### Phase 5: Timeline grid, frozen pane, month header
#### Automated
- [ ] 5.1 npm run build succeeds
- [ ] 5.2 npm run lint passes with no new errors
#### Manual
- [ ] 5.3 the Timeline grid, frozen person-name column, and month header render correctly in both themes, with the sticky column still visually separated from scrolled content

### Phase 6: Availability bar, allocation blocks, time-off blocks
#### Automated
- [ ] 6.1 npm run build succeeds
- [ ] 6.2 npm run lint passes with no new errors
#### Manual
- [ ] 6.3 an allocation block using a light-hue project colour keeps readable text in light theme, while the block still visibly carries that project's colour via its background/border
- [ ] 6.4 over-allocation (red) on the availability bar is clearly red in both themes
- [ ] 6.5 time-off blocks render with a legible light-mode gradient and border

### Phase 7: Timeline modals and Timeline-only filters
#### Automated
- [ ] 7.1 npm run build succeeds
- [ ] 7.2 npm run lint passes with no new errors
#### Manual
- [ ] 7.3 AllocationModal, TimeOffModal, and all three Timeline filter dropdowns plus the month picker render correctly with no dark leftovers in light mode

### Phase 8: People theming
#### Automated
- [ ] 8.1 npm run build succeeds
- [ ] 8.2 npm run lint passes with no new errors
#### Manual
- [ ] 8.3 the People list, group toggle, availability bars, and PersonModal (including its avatar-colour picker) render correctly in both themes with avatar colours unchanged

### Phase 9: Projects theming
#### Automated
- [ ] 9.1 npm run build succeeds
- [ ] 9.2 npm run lint passes with no new errors
#### Manual
- [ ] 9.3 Projects cards, ProjectModal, and the colour-swatch picker render correctly in both themes with project colours unchanged

### Phase 10: Kompetencje theming
#### Automated
- [ ] 10.1 npm run build succeeds
- [ ] 10.2 npm run lint passes with no new errors
- [ ] 10.3 git diff shows no changes under src/app/api/ or mcp/
#### Manual
- [ ] 10.4 Kompetencje tabs, search, tag chips, the inline competency editor, and ExperienceModal render correctly in both themes
