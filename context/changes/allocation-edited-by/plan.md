# Show who added an allocation to a person (edited by) — Implementation Plan

<!-- AS-BUILT: reconstructed from PRs #45, #46, #47 (range bd76026^1..efb5a44); not a forward plan -->

## Overview

Allocation rows on `/timeline` carried no visible authorship, so a Planner
looking at someone's assignment could not tell which manager had made it. This
change surfaces **who last edited** an allocation (and, secondarily, who created
it) in the allocation detail panel, and makes that attribution reliable by
stamping the actor in the database rather than trusting the browser.

## Current State Analysis

Reconstructed from the diff; this is the state the code was in **before** the
change:

- `public.allocations` already had a `created_by uuid references profiles(id)`
  column (`supabase-schema.sql:68`) but nothing ever wrote to it — it was NULL
  on every row.
- The timeline queries selected `'*, project:projects(*)'` only
  (`src/app/(dashboard)/timeline/page.tsx:12`,
  `src/app/(dashboard)/timeline/TimelineClient.tsx:24`), so no actor data
  reached the client even if the column had been populated.
- `AllocationModal` built its `payload` from form fields and wrote it straight
  through `supabase.from('allocations').insert/update`
  (`src/components/timeline/AllocationModal.tsx:80`); it surfaced the raw
  `dbError.message` to the user.
- `Allocation` in `src/lib/types.ts:45` exposed `created_by` but no joined actor.

## Desired End State

Opening an allocation on `/timeline` shows, at the bottom of the detail panel,
"Ostatnio edytowane przez <name> · <date>" with a secondary "Utworzone przez
<name> · <date>" beneath it. Allocations that predate the change show "Brak
informacji o ostatniej edycji" until first edited. The attribution is written by
the database from the authenticated session, so it is correct for every write
path — including the drag-move / drag-resize handlers that never touch the modal.

### Key discoveries

- The browser client (`supabase.auth.getUser()`) did **not** reliably return the
  logged-in user, so a first implementation that stamped the actor client-side
  wrote NULL silently, with no save error. Diagnosed on live data: freshly
  edited rows had `updated_by = NULL`.
- Stamping in a `before insert or update` trigger from `auth.uid()` (the identity
  in the request JWT) removes the client from the trust path entirely, and also
  covers write paths that never set the field.
- Looking the actor up via `select id from profiles where id = auth.uid()`
  doubles as an FK guard: it yields a valid profile id or NULL, never an id
  absent from `profiles`.
- No RLS change was needed — the existing "allocations: authenticated update"
  policy (`using (true)`) already permits writing the new column.

## What we're NOT doing

- No full audit log / history of edits — only the *last* editor and the original
  creator are kept, one column each.
- No backfill of the true historical editor: existing rows get
  `updated_by = created_by`, which is itself NULL for everything created before
  the change.
- No UI anywhere but the allocation detail panel; the timeline blocks themselves
  are unchanged.

## Implementation Approach

Three layers, in dependency order: a database column plus a trigger that stamps
the actor; the timeline queries widened to embed the two profiles; and a footer
in the detail panel that renders them.

The load-bearing decision is **server-side stamping**. The first cut (PR #45)
attributed only the creator and set `created_by` from the client at insert time;
it was superseded by PR #46, which added `updated_by`, and then corrected in
PR #47 once the client-side identity turned out to be unreliable in production.
Doing it in a trigger is what makes the feature correct rather than
best-effort — it cannot be forged by a crafted request, and it cannot be skipped
by a write path that forgot to set the field.

## Critical Implementation Details

- Two migration files exist and both define a stamping trigger:
  `migrations/2026-07-16-allocation-updated-by.sql` creates
  `set_allocation_audit_fields`, and
  `migrations/2026-07-20-allocation-actor-trigger.sql` creates
  `allocations_set_actor`. `supabase-schema.sql` declares only
  `allocations_set_actor`. Replaying the `migrations/` directory in order on a
  live database therefore leaves **both** triggers installed, while a fresh
  install provisioned from `supabase-schema.sql` gets one. Recorded here as the
  as-built state — see *Migration Notes*.
- The comment in `AllocationModal.tsx` names the `set_allocation_audit_fields`
  trigger, which is not the one in the canonical schema.
- `updated_at` is stamped by the trigger too, so the drag-move / drag-resize
  handlers stay in sync with `updated_by` without being changed.

## Phase 1: Data layer — actor columns and server-side stamping

### Overview
Add the `updated_by` column, backfill it, and stamp both actor columns from the
authenticated session in the database.

### Required changes

#### 1. Allocation table
- **File**: `supabase-schema.sql`, `migrations/2026-07-16-allocation-updated-by.sql`
- **Goal**: record who last edited a row alongside who created it
- **Contract**: `allocations.updated_by uuid references profiles(id) on delete set null`, nullable; existing rows backfilled from `created_by`

#### 2. Actor trigger
- **File**: `migrations/2026-07-20-allocation-actor-trigger.sql`, `supabase-schema.sql`
- **Goal**: make attribution independent of what the client sends
- **Contract**: `set_allocation_actor()` on `before insert or update`; INSERT sets `created_by`/`updated_by` from `auth.uid()` via a `profiles` lookup, UPDATE sets `updated_by` and refreshes `updated_at`

### Success criteria
#### Automated
- `npm run build` succeeds
#### Manual
- After running both migrations, editing an allocation sets `updated_by` to the logged-in user's profile id
- Creating an allocation sets both `created_by` and `updated_by`
- A drag-move or drag-resize on the timeline also updates `updated_by` and `updated_at`

## Phase 2: Query layer — embed the actors

### Overview
Widen the timeline queries so the joined profiles reach the client, and type them.

### Required changes

#### 1. Timeline queries
- **File**: `src/app/(dashboard)/timeline/page.tsx`, `src/app/(dashboard)/timeline/TimelineClient.tsx`
- **Goal**: deliver the actor names with the allocations, in the same round trip
- **Contract**: select `'*, project:projects(*), creator:profiles!created_by(id, full_name, email), editor:profiles!updated_by(id, full_name, email)'` in both the server load and the client `refresh`

#### 2. Allocation type
- **File**: `src/lib/types.ts`
- **Goal**: type the new column and the two embeds
- **Contract**: `updated_by: string | null`; `creator?` / `editor?` as `{ id, full_name, email } | null`

### Success criteria
#### Automated
- `npm run build` succeeds
- `npm run lint` reports no new errors
#### Manual
- The allocations payload on `/timeline` carries `creator` and `editor` objects for rows that have them
- Both the initial server render and a client refresh return the same shape

## Phase 3: UI — audit footer in the allocation detail

### Overview
Render the attribution at the bottom of the allocation panel, and stop leaking
raw database errors.

### Required changes

#### 1. Audit footer
- **File**: `src/components/timeline/AllocationModal.tsx`
- **Goal**: show who to contact about an assignment, without leaving the panel
- **Contract**: rendered only for an existing allocation; primary line "Ostatnio edytowane przez <name> · <date>" falling back to "Brak informacji o ostatniej edycji"; secondary "Utworzone przez …" shown only when a creator is known; name resolves `full_name` then `email`; dates formatted `pl-PL`

#### 2. Save error handling
- **File**: `src/components/timeline/AllocationModal.tsx`
- **Goal**: keep database detail out of the UI
- **Contract**: log the raw error to the console, show "Nie udało się zapisać alokacji. Spróbuj ponownie."

### Success criteria
#### Automated
- `npm run build` succeeds
#### Manual
- Opening an allocation edited after the migration shows the editor's name and date
- An allocation created before the change shows "Brak informacji o ostatniej edycji"
- A failed save shows the generic message, with the real error in the console

## Testing Strategy

The project has no automated test runner (`package.json` exposes `dev`, `build`,
`start`, `lint` only), so verification is `npm run build` + `npm run lint` plus
the manual checks above against a Supabase instance with both migrations applied.

## Migration Notes

Both files under `migrations/` must be run in the Supabase SQL Editor before, or
together with, the code deploy. They are individually idempotent
(`add column if not exists`, `create or replace function`,
`drop trigger if exists`), but they are **not** consolidated: running both leaves
two stamping triggers on `allocations` (`set_allocation_audit_fields` from the
first, `allocations_set_actor` from the second), whereas a database provisioned
from `supabase-schema.sql` has only `allocations_set_actor`. Reconciling the two
is out of scope for this record and is left to review.

Rollback is `drop trigger …; drop function …; alter table public.allocations drop
column updated_by;` — the UI degrades to "Brak informacji o ostatniej edycji"
without it.

## References

- `context/changes/allocation-edited-by/change.md` — the client request and the three-stage history
- PRs #45, #46, #47 — commit range `bd76026^1..efb5a44`
- `README.md` § Database migrations — the `migrations/` + `supabase-schema.sql` lockstep convention added by this change

## Progress
<!-- AS-BUILT: criteria left unchecked — rs-impl_review verifies them against the diff. -->

### Phase 1: Data layer — actor columns and server-side stamping
#### Automated
- [ ] 1.1 `npm run build` succeeds
#### Manual
- [ ] 1.2 After running both migrations, editing an allocation sets `updated_by` to the logged-in user's profile id
- [ ] 1.3 Creating an allocation sets both `created_by` and `updated_by`
- [ ] 1.4 A drag-move or drag-resize on the timeline also updates `updated_by` and `updated_at`

### Phase 2: Query layer — embed the actors
#### Automated
- [ ] 2.1 `npm run build` succeeds
- [ ] 2.2 `npm run lint` reports no new errors
#### Manual
- [ ] 2.3 The allocations payload on `/timeline` carries `creator` and `editor` objects for rows that have them
- [ ] 2.4 Both the initial server render and a client refresh return the same shape

### Phase 3: UI — audit footer in the allocation detail
#### Automated
- [ ] 3.1 `npm run build` succeeds
#### Manual
- [ ] 3.2 Opening an allocation edited after the migration shows the editor's name and date
- [ ] 3.3 An allocation created before the change shows "Brak informacji o ostatniej edycji"
- [ ] 3.4 A failed save shows the generic message, with the real error in the console
