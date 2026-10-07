# Theme preference (light/dark) — Plan Brief

Full plan: `plan.md`. Research: `research.md`. Issue text: `change.md`. rs-frame was skipped (see Scope note below).

## What & why

RS Planner is dark-only today, and colours are hardcoded into every component. Several staff would rather work in a light interface all day. This change lets a signed-in user switch between light and dark from a menu under their avatar in the sidebar, stores the choice on their Supabase profile so it follows them across devices and sign-ins, and leaves every existing/never-chosen account looking exactly as it does today.

## Starting point

No theming infrastructure exists: no Tailwind dark-mode config, no `dark:` variant anywhere, no CSS variables for colour, no design tokens. All colour is hardcoded Tailwind utility classes (slate/indigo dominate) or raw hex strings in inline `style` (project/avatar colours, availability-bar status colours). `profiles` has no `theme` column. `(dashboard)/layout.tsx` already fetches the full profile server-side before rendering the sidebar. `/auth/*` pages are structurally isolated from the dashboard (no shared layout, no profile). See `research.md` for full citations.

## Desired end state

Switching in the avatar menu recolors the whole authenticated app immediately, with no reload and no flash on load. The choice follows the account. Never-chosen accounts stay pixel-identical to today. Sign-in/registration/password-reset stay dark always. User-picked project/avatar colours are unchanged in both themes, with allocation-block text kept readable; over-allocation red stays clearly red in both themes.

## Complexity

**HIGH.** The change touches colour declarations across ~30 files and every authenticated screen, requires a schema change with a migration, introduces a new SSR-safe/no-flash theming mechanism from scratch, and carries a hard "no visual change for the default theme" acceptance criterion in a repo with zero automated test coverage — so the biggest risk (a missed dark-mode regression) can only be caught by hands-on review, not by a build or lint check.

## Skipped steps

- **rs-frame skipped**: the issue already carries a full rs-feature spec (Summary, Scope in/out, FR-001..FR-007, AC-01..AC-05, Constraints, NFRs, Open questions) with no bug shape and no open scope/design question — nothing to reframe.
- **rs-research run**: the change touches colour declarations across essentially every screen; research grounded the plan in exact file:line references for the current styling approach, the Supabase schema/migration convention, the SSR/auth structure, and every screen area's file ownership, instead of guessing.

## Key decisions made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Storage location & schema | New `profiles.theme text not null default 'dark' check (theme in ('light','dark'))` | Issue requires per-account storage (not localStorage); default `'dark'` satisfies "no existing account changes appearance"; enum matches existing CHECK convention (`competency_tags.kind`) | Issue + Research |
| Migration filename/pattern | `migrations/2026-09-15-profile-theme.sql`, idempotent `add column if not exists` + `drop constraint if exists`/`add constraint`, WHY/HOW header, mirrored into `supabase-schema.sql` | Matches existing migration convention exactly (`migrations/2026-07-16-allocation-updated-by.sql`) | Research |
| Migration rollback | `alter table public.profiles drop column if exists theme;` documented in the migration | rs-core hard guard requires every migration to have a rollback | Auto (rs-core §1) |
| `handle_new_user()` trigger | Left untouched; new column relies on its own DB default | Trigger already doesn't seed every column (e.g. `capacity_hours_per_day`) — matches existing convention, avoids touching a working trigger unnecessarily | Research |
| Theming mechanism | Additive: leave all existing hardcoded classes as-is (= today's dark appearance); add a Tailwind 4 class-scoped light variant on top | Zero risk to the untouched-by-construction dark path (FR-006), given zero automated test coverage; a token/rewrite approach would touch the same ~350 occurrences with no added safety | Auto |
| Where the theme class is applied | `(dashboard)/layout.tsx`'s wrapper `<div>`, not `<html>`/root layout | Reuses the profile fetch already there (no new query); leaves `/auth/*` and root layout untouched by construction; confirmed `Modal.tsx` has no portal so this scope still reaches every modal | Auto (Research) |
| Instant switch + persistence | Client `ThemeProvider` context seeded from server-fetched `profile.theme`; setter updates state immediately and persists via `supabase.from('profiles').update(...)` | Satisfies "immediate, no reload" NFR; persistence mirrors the existing `.update()` pattern already used by `ProjectModal.tsx`/`PersonModal.tsx`/`TimeOffModal.tsx` | Research |
| Avatar menu component | `@radix-ui/react-dropdown-menu` | Already an installed, unused dependency — no new dependency, better accessibility/dismiss behaviour than hand-rolling a 4th ad-hoc dropdown pattern | Auto (Research) |
| Avatar menu scope | Additive alongside the existing sign-out button, not a restructure | Issue's in-scope bullets ask only for a theme switch from the avatar menu; no request to change sign-out UX | Auto (Issue) |
| Allocation-block text contrast | Background/border keep the raw `project.color` hex unchanged in both themes; in light theme only, text glyph switches to a fixed readable neutral instead of the raw hex | The bare-hex-as-text pattern has no contrast safety net and the failure is provable today from the fixed 12-swatch palette, not hypothetical; raising the tint alpha instead is mathematically backwards (pulls tint color toward text color, collapsing contrast further) | **Consult (rs-advisor)** |
| `formatAvailability()` status colours (incl. over-allocation red) | Left unchanged in both themes | Tailwind 500-weight shades are designed for reasonable legibility on both light and dark backdrops, unlike the allocation-block pattern; verified manually per phase | Auto |
| Time-off block chrome | Existing hardcoded gradient/border gets a light-mode equivalent; per-type `TIME_OFF_LABELS.color` stays unused (not newly wired up) | In scope is theming existing chrome, not adding a new per-type-colour feature that was never requested | Auto (Issue scope discipline) |
| Increment split | Foundation (schema+mechanism+avatar menu+shared Modal) blocks 3 file-disjoint, parallel increments: Timeline / People+Projects / Kompetencje | `Modal.tsx` is the only cross-area shared file; Timeline-only filters (`PeopleFilter`/`ProjectFilter`/`SkillsFilter`/`MonthPicker`) confirmed via import grep to have no other consumers | Research |
| Automated success criteria | `npm run lint` + `npm run build` only, everything else Manual | No test runner/CI exists in the repo (`tech-stack.md`); no Supabase CLI/psql available to automate migration application | Research |

## Scope

**In**: avatar-menu theme switch; per-account storage; default-dark for existing/never-chosen accounts; every authenticated screen (Timeline incl. grid/frozen pane/month header/availability bar/allocation & time-off blocks, People, Projects, Kompetencje, all modals/dropdowns/filters/pickers, scrollbar); preserved project/avatar colours and text readability; preserved over-allocation red.

**Out**: rebrand; auto/system-based theme switching; high-contrast/WCAG audit; mobile/touch; theming pre-auth screens (sign-in/registration/password-reset stay dark always); changes to the read-only Competency API or MCP server; changes to Timeline interaction (drag/resize/filter/math) or any allocation/time-off/project/competency data; new automated visual-regression tooling; wiring up the unused per-type time-off colours as a new feature; restructuring the existing sign-out control.

## Architecture / Approach

Additive Tailwind 4 light-variant layered on unchanged existing classes, scoped to the `(dashboard)` layout's wrapper `<div>` (not `<html>`), server-rendered from the already-fetched profile for zero flash, with a client `ThemeProvider` context for instant switching and Supabase persistence. See `plan.md`'s Implementation Approach for full reasoning, including the allocation-block text-contrast resolution.

## Increments at a glance

| # | Delivers | Depends on | User-visible | Key risk |
|---|---|---|---|---|
| 1 | Schema, theming mechanism (no-flash SSR + instant switch), avatar menu, shared Modal chrome, Sidebar theming | — | yes | Gets the mechanism wrong here and every later increment inherits it; must not regress default dark (FR-006) |
| 2 | Timeline theming (grid, frozen pane, month header, availability bar, allocation/time-off blocks, Timeline modals & filters) | 1 | yes | JS-computed colours (formatAvailability, allocation-block text) — the one spot needing more than a class sweep |
| 3 | People + Projects theming | 1 | yes | Duplicated colour-picker markup (PersonModal's inline swatch grid vs. shared ColorPicker) must both be themed independently |
| 4 | Kompetencje theming | 1 | yes | Must not touch `src/app/api/*` or `mcp/` (read-only Competency API/MCP server out of blast radius) |

Increments 2, 3, 4 are file-disjoint (confirmed in research) and can run in parallel once increment 1 is merged.

## Phases at a glance

| Phase | Increment | Delivers | Key risk |
|---|---|---|---|
| 1 | 1 | `profiles.theme` column + migration + mirror + type | Migration must be idempotent and rollback-documented |
| 2 | 1 | Light-mode Tailwind variant, SSR theme class (no flash), `ThemeProvider` | Exact Tailwind 4 custom-variant syntax must be verified against installed docs before writing CSS |
| 3 | 1 | Avatar menu + Sidebar theming | Must not disturb existing sign-out control |
| 4 | 1 | Shared `Modal.tsx` chrome theming | Unlocks increments 2-4's modals without their own edits |
| 5 | 2 | Timeline grid/frozen pane/month header + page wrapper | Sticky-column visual separation must survive theming |
| 6 | 2 | Availability bar, allocation blocks, time-off blocks | Allocation-block text-contrast fix (Consult decision); over-allocation red must stay red |
| 7 | 2 | Timeline modals + Timeline-only filters/month picker | — |
| 8 | 3 | People screen + PersonModal + RoleSelect | Avatar-colour swatch grid duplicated from ColorPicker, must theme both |
| 9 | 3 | Projects screen + ProjectModal + ColorPicker | — |
| 10 | 4 | Kompetencje screen + editor + experience modal + tag select | Must not touch `src/app/api/*` or `mcp/` |

Prerequisites: increment 1 (all of phases 1-4) must be merged before increments 2, 3, or 4 start.

## Open risks & assumptions

- No automated test runner or CI exists; AC-03 ("dark theme looks exactly the same") can only be verified by hands-on, screen-by-screen review — a real, accepted risk carried from the issue itself, not closed by this plan.
- Exact Tailwind 4 CSS-first custom-variant syntax could not be verified against installed package docs during planning (`node_modules` absent in this worktree); flagged in Phase 2 for verification against the installed `tailwindcss` docs before writing `globals.css`, per `AGENTS.md`.
- Legibility of the 12 `PROJECT_COLORS`/8 `AVATAR_COLORS` swatches and the `formatAvailability()` status hexes against a light background was not empirically rendered/verified during research; flagged as Manual verification in Phases 6, 8, and 9.
- A sibling branch (`autofix/cezar-issue-68-6a7e93ec`) has unreviewed, ad-hoc theme-related commits; per the task's explicit instruction, this plan was built fresh from the issue and the current codebase and does not treat that branch as authoritative.

## Success criteria (summary)

AC-01 (switching recolors every screen with no dark leftovers), AC-02 (choice follows the account across devices/sign-ins), AC-03 (never-chosen accounts unchanged — manual verification only), AC-04 (pre-auth screens always dark, immediate switch to chosen theme post-sign-in), AC-05 (project/avatar colours unchanged, text stays readable) — mapped to Manual criteria per phase in `plan.md`'s `## Progress`, since no automated visual-regression coverage exists in this repository.
