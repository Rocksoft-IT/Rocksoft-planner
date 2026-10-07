# Theme persistence fix — Implementation Plan

## Overview
After the merged `theme-preference` change, a user who switches to light sees the app flip back to dark by itself. The only code path that does this is the rollback in `ThemeProvider` when the save to `profiles.theme` fails, and a failed save is currently invisible to the user and nearly undiagnosable (it logs only `error.message`). This change makes the failure visible and diagnosable, and schedules the verification that confirms and removes the underlying cause (the manually applied migration not being present on the deployed database). The dark default, Timeline behaviour and all data stay untouched.

## Current State Analysis
Code confirmed by reading (no live DB reachable from the planning environment):
- `src/components/ThemeProvider.tsx:48-85` — `persistTheme` writes `profiles.theme` with `update(..., { count: 'exact' }).eq('id', profileId)`. On `error` or `count === 0` it only `console.error`s the message (`:69`) and calls `setThemeState(previous)` (`:81`), i.e. the UI flips back to the old theme with no message to the user. Rollback was added deliberately (commits 146b3c4, 9d6d630).
- `src/app/(dashboard)/layout.tsx:19` — the server maps anything other than `'light'` to `'dark'`, so a failed save also shows dark after a reload; `select('*')` (`:15`) never errors when the column is missing, it just yields `undefined`.
- `migrations/2026-09-15-profile-theme.sql:7-9` — the `theme` column exists only via a manual "paste into the Supabase SQL editor" step; the original plan recorded that no tooling can apply migrations (`context/archive/2026-09-15-theme-preference/plan-brief.md`, Key decisions). Nothing in the repo proves it was applied to the deployed database.
- RLS is not the likely cause: `supabase-schema.sql:122` already has "profiles: update own"; no other code writes `profiles.theme` or remounts the provider (grep of `src/`, `scripts/`, `mcp/`), and `initialTheme` is only read as `useState` seed so a server re-render cannot overwrite the choice.
- `src/components/ThemeProvider.test.tsx:76-98` already asserts the rollback itself; nothing asserts the user is told.
- Assumption still to verify (Phase 1, Manual): the live save fails with column-not-found (`42703` / `PGRST204`) rather than a 0-row match.

## Desired End State
- Switching theme and the save succeeding: unchanged (choice sticks, follows the account).
- If the save fails: the UI still rolls back (so it never shows an unsaved theme), but a visible, dismissible, theme-aware message tells the user the choice could not be saved, and the console error carries the error code, details/hint and, for a missing column, a pointer to `migrations/2026-09-15-profile-theme.sql`.
- On the deployed database the `theme` column exists, and a switch to light survives reload and a new sign-in on another browser.

### Key discoveries
- The reported symptom ("switches, then goes back to dark") is exactly the failure branch at `ThemeProvider.tsx:68-82`; no other path resets the theme.
- The save failure is the same on every device, so the choice can never "follow the account" until the column exists.

## What we're NOT doing
- Not removing the rollback or keeping an unsaved choice for the session (hides the failure, breaks FR-002 across reload).
- Not changing the migration, `supabase-schema.sql`, RLS, the dark default, `layout.tsx`, `Sidebar.tsx`, the serialization/retry logic, Timeline or any data.
- Not adding a new migration or tooling to apply migrations.
- Not touching sign-in screens (stay dark).

## Implementation Approach
Chosen (Consult, rs-advisor agreed): ship small code hardening plus a mandatory verification of the deployed schema. The real fix for a missing column is a human SQL step that code cannot perform, so the code change makes the failure impossible to miss next time and gives the exact cause in the console, and Phase 1's Manual criteria confirm the cause and the end-to-end behaviour. The message is rendered inside `ThemeProvider` (not the avatar menu) because the menu closes on selection, before the async save fails; this also keeps the change to two files. Rejected: ops-only (leaves the same silent blind spot), dropping the rollback (hides the failure; choice lost on reload).

## Increments
| # | Name | Phases | Depends on | User-visible | Status | PR |
|---|---|---|---|---|---|---|
| 1 | Surface and diagnose theme save failures | 1 | — | yes | in-progress | — |

## Phase 1: Surface and diagnose theme save failures

### Overview
Make a failed theme save visible to the user and diagnosable from the console, keep the existing rollback and serialization behaviour, and verify the deployed database end to end.

### Required changes
#### 1. Failure state and message in the provider
- **File**: `src/components/ThemeProvider.tsx`
- **Goal**: When a save fails and no newer choice supersedes it (the same branch that rolls back today), record a user-facing failure and render a dismissible `role="alert"` message inside the themed wrapper (fixed-position, in-tree so it follows `.light`, using the existing `light:` variant classes). The message says the theme could not be saved and was reverted, and to try again or contact an administrator. It clears when dismissed, when the user toggles again, or after a later successful save. Extend the `console.error` to include the error `code`, `details`/`hint` and, when the code is `42703` or `PGRST204` (or the message names the `theme` column), a hint to apply `migrations/2026-09-15-profile-theme.sql`.
- **Contract**: `useTheme()` shape (`theme`, `setTheme`) unchanged. Rollback, write serialization and queued retry semantics unchanged. No new props. Message copy is English like the rest of the app.

#### 2. Regression tests
- **File**: `src/components/ThemeProvider.test.tsx`
- **Goal**: Cover: failed save rolls back AND shows the alert; 0-row match shows the alert; a missing-column error code logs the migration hint; the alert clears on dismiss and on the next toggle; a successful save shows no alert; a failed write that is superseded by a queued newer choice shows no alert for the superseded one. Extend the mocked update result type with the error `code`.
- **Contract**: existing tests keep passing unchanged.

### Success criteria
#### Automated
- `npm test` passes, including the new ThemeProvider tests (new alert tests fail on the unmodified provider)
- `npm run lint` passes
- `npm run build` succeeds

#### Manual
- On the deployed Supabase, `profiles.theme` exists (SQL editor: `select column_name from information_schema.columns where table_name='profiles' and column_name='theme'` returns a row); if absent, `migrations/2026-09-15-profile-theme.sql` is applied first
- With DevTools open, switching to light on a preview issues a PATCH to `/rest/v1/profiles` that succeeds, the theme stays light after reload and after signing in on another browser
- With the column temporarily unavailable (or a forced failure), the user sees the "could not save" message and the console shows the migration hint
- Dark default for an account that never chose a theme, the sign-in screens in dark, and Timeline behaviour are unchanged

## Testing Strategy
Vitest + Testing Library in `ThemeProvider.test.tsx` (mocked Supabase client, caller-controlled promises as in the existing tests) for the failure/alert logic; the deployed-database check and cross-device persistence are Manual because no agent can reach the live Supabase.

## Migration Notes
No new migration. The existing `migrations/2026-09-15-profile-theme.sql` (idempotent, rollback documented in its header) must be applied to any deployed database that lacks the column; applying it is a human step and the PR must state it plainly so the change is not merged as "fixed" while the database is unmigrated.

## References
- `src/components/ThemeProvider.tsx`, `src/components/ThemeProvider.test.tsx`, `src/app/(dashboard)/layout.tsx:15-19`
- `migrations/2026-09-15-profile-theme.sql`, `supabase-schema.sql:18-22,118-124`
- `context/archive/2026-09-15-theme-preference/` (original plan, rollback commits 146b3c4, 9d6d630)
- Issue: https://github.com/Rocksoft-IT/Rocksoft-planner/issues/68

## Progress

### Phase 1: Surface and diagnose theme save failures
#### Automated
- [ ] 1.1 `npm test` passes, including the new ThemeProvider tests (new alert tests fail on the unmodified provider)
- [ ] 1.2 `npm run lint` passes
- [ ] 1.3 `npm run build` succeeds
#### Manual
- [ ] 1.4 On the deployed Supabase, `profiles.theme` exists (SQL editor: `select column_name from information_schema.columns where table_name='profiles' and column_name='theme'` returns a row); if absent, `migrations/2026-09-15-profile-theme.sql` is applied first
- [ ] 1.5 With DevTools open, switching to light on a preview issues a PATCH to `/rest/v1/profiles` that succeeds, the theme stays light after reload and after signing in on another browser
- [ ] 1.6 With the column temporarily unavailable (or a forced failure), the user sees the "could not save" message and the console shows the migration hint
- [ ] 1.7 Dark default for an account that never chose a theme, the sign-in screens in dark, and Timeline behaviour are unchanged
