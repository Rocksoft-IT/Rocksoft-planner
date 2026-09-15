---
change_id: theme-preference
title: Planners can switch RS Planner between dark and light theme
status: planned
created: 2026-09-15
updated: 2026-09-15
archived_at: null
---

## Notes

https://github.com/Rocksoft-IT/Rocksoft-planner/issues/68

<!-- rs-feature · track: feature · client: piotr@rocksoft.pl · repository: RS Planner -->

## Summary

RS Planner is dark-only today. Several people on the team have said they would rather work in a light interface all day — this is a standing personal preference, not something they toggle situationally. We want each user to be able to pick light or dark once, from inside the app, and have that choice follow their account.

## Problem & context

- **Who / when / cost:** multiple Rocksoft staff who use the planner daily. It is not tied to a particular moment (daylight, screen sharing, screenshots) — people simply prefer a light interface and currently have no way to get one.
- **Current system:** the app ships a single dark slate/indigo look. Colours are written directly into the components across every screen (Timeline, People, Projects, Kompetencje, all modals, pickers and filters, the auth screens, the app shell background and the custom scrollbar). There is no theme layer, no per-user appearance setting, and no automated tests or CI to catch visual regressions.

## Scope

### In scope

1. A signed-in user opens the menu under their avatar in the sidebar.
2. They switch the theme between dark and light.
3. The whole authenticated app — every screen, modal, dropdown, filter, picker and scrollbar — immediately renders in the chosen theme.
4. The choice is stored on their user account, so it applies on every device and after every sign-in.
5. A user who has never chosen anything keeps seeing the current dark theme.

### Out of scope (non-goals)

- Rebranding or a new brand palette — this is only an inversion of the existing look, the same visual identity in a light variant.
- Automatic switching by time of day or by the operating system setting — the preference is explicit and set once.
- High-contrast mode and any WCAG accessibility audit — separate concern.
- Touch or mobile support — the app stays desktop mouse/trackpad only.
- Light theme on the sign-in, registration and password-reset screens — before login there is no account to read the preference from, so they stay dark.

## Access & roles

No change planned — existing model preserved. Every signed-in user sets their own theme; there is no admin gating and no one sets the theme for anybody else.

## Success criteria

- **Primary:** a user switches to light from the avatar menu, works through Timeline, People, Projects and Kompetencje without hitting an unreadable or still-dark element, signs in the next day on another machine and is still in light.
- **Secondary:** the team stops treating "the planner is too dark" as a reason not to use it in a bright room.
- **Guardrails:** the dark theme is unchanged for everyone who does not switch; Timeline interaction (drag, resize, filtering, availability maths) is untouched; no allocation, time-off, project or competency data changes.

## Requirements

- FR-001: A signed-in user can switch between dark and light from the menu under their avatar in the sidebar. Priority: must-have. Change: new
- FR-002: A user's theme choice is stored per account and applies on any device and after any sign-in. Priority: must-have. Change: new
- FR-003: A user who has never made a choice sees the dark theme. No existing account changes appearance on release. Priority: must-have. Change: new
- FR-004: Every authenticated surface renders correctly in both themes — Timeline (grid, frozen pane, month header, availability bar, allocation and time-off blocks), People, Projects, Kompetencje, all modals, dropdowns, filters, pickers, empty states, error and validation messages, and the custom scrollbar. Priority: must-have. Change: new
- FR-005: Project colours and avatar colours keep the exact values users picked; text on allocation blocks and avatars stays readable in both themes. Priority: must-have. Change: modified
- FR-006: The dark theme looks the same as it does today, screen for screen. Priority: must-have. Change: preserved
  > Challenge: the risk in this change sits in the dark theme, not the light one — introducing a theme layer touches colour declarations across the whole UI while the team's daily view is dark and there are no tests to catch a regression. Accepted as a hard acceptance criterion rather than splitting the work per screen.
- FR-007: A user can still create, move, resize, edit and delete allocations and time off on the Timeline, and use all filters, exactly as today. Priority: must-have. Change: preserved

## Acceptance criteria

### AC-01: Switching the theme

- **Given** a signed-in user on any app screen in the dark theme
- **When** they open the avatar menu and switch to light
- **Then** the current screen and every other app screen render in the light theme, with no dark leftovers in modals, dropdowns, filters or scrollbars

### AC-02: The choice follows the account

- **Given** a user who has switched to light
- **When** they sign in again, on the same or another device or browser
- **Then** the app opens in the light theme without them setting it again

### AC-03: Nothing changes for everyone else

- **Given** an existing account that has never touched the theme setting
- **When** the change is released and the user signs in
- **Then** the app looks exactly as it does today, screen for screen

### AC-04: Sign-in stays dark

- **Given** a user whose account is set to light
- **When** they open the sign-in, registration or password-reset screen
- **Then** those screens render in the dark theme, and the app switches to light once they are signed in

### AC-05: Readability of user-picked colours

- **Given** projects and avatars with colours picked for the dark theme
- **When** the user views the Timeline and People in the light theme
- **Then** project and avatar colours are unchanged and the text drawn on allocation blocks and avatars remains readable

## Constraints & preserved behavior

- Storing the preference per account requires a schema change. Rocksoft's convention applies: an idempotent dated migration in `migrations/` **and** the same edit mirrored into `supabase-schema.sql`, with the WHY/HOW rationale in the SQL header comment.
- The read-only Competency API (`/api/*`) and the `rockplanner-competency` MCP server are out of the blast radius and must not change.
- Availability and utilisation maths is untouched, including over-allocation shown in red rather than blocked — the red must stay clearly red in both themes.
- No migration of existing data and no change to allocations, time off, projects or competencies.

## Non-functional requirements

- Switching the theme is immediate — the user does not reload the page or navigate away to see it applied.
- On loading the app, the user does not see a flash of the wrong theme before their preference is applied.
- Supported environment is unchanged: desktop browsers, mouse and trackpad.

## Open questions

- A user set to light will see a dark sign-in screen and then a light app. Accepted consciously; consequence is a visible jump right after sign-in.
- There are no automated tests or CI in the repository, so AC-03 can only be verified by hands-on review screen by screen. Consequence: a missed spot in a rarely opened modal may reach the team before anyone notices.

## Technical notes from the client

- The preference should live on the user's profile in Supabase rather than in browser-local storage, so it follows the person between devices.

## Metadata

- **Client:** piotr@rocksoft.pl
- **Repository:** RS Planner (git@github.com:Rocksoft-IT/Rocksoft-planner.git)
- **Track:** feature
- **Created with:** rocksoft-koda rs-feature 0.2.0
