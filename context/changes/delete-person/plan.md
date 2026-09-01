# Plan — delete-person

Add the ability to delete a person from the `/people` tab.

## TL;DR — this is NOT a "build the button" task

The UI already exists on `main` (initial commit): `PersonModal.tsx:141-150` renders the
red **"Usuń"** button and `handleDelete` (lines 67-75) already calls
`supabase.from('team_members').delete()`. The button is live on planner.rocksoft.pl
but **clicking it does nothing** (confirmed by the client).

Two real defects make it a no-op, and one decision (cascade) must be implemented:

1. **Root cause — silent RLS block.** `public.team_members` has RLS enabled with **no
   DELETE policy**, so `.delete()` removes 0 rows and returns no error. `handleDelete`
   (`PersonModal.tsx:71`) **ignores the Supabase result**, so the user sees nothing —
   unlike `handleSubmit` (line 62) which surfaces `dbError`.
2. **No cascade.** `allocations` and `time_off` reference `profiles(id)`, NOT
   `team_members(id)` — there is no FK from either table to `team_members`, so no
   DB-level cascade or restrict fires when a team member is deleted. Client decision:
   **cascade — delete the person's allocations and time-off too.**
3. **No confirmation** before an irreversible, now-cascading delete.

## Decision

- Orphan policy: **CASCADE** (client-chosen). Deleting a person also deletes their
  `allocations` and `time_off` rows. Irreversible, no undo.
- Implement the cascade + fix the RLS block with a single **`SECURITY DEFINER` RPC**,
  mirroring the existing `search_experts` pattern (`supabase-schema.sql:288`, called via
  `supabase.rpc(...)` in `src/app/api/search/experts/route.ts:14`). One RPC:
  - is **atomic** (all three deletes in one function call — no partial-delete state),
  - **bypasses RLS** cleanly on all three tables (fixes the `team_members` no-DELETE-policy
    root cause AND the unknown `time_off` RLS in one move — no need to author three
    separate DELETE policies),
  - centralizes the cascade in the DB, consistent with this project's DB-side conventions
    (`set_allocation_actor` trigger, `search_experts` RPC).

Rejected alternatives: (a) app-side sequential deletes in `handleDelete` — not atomic,
and needs a working DELETE policy on each table incl. the unknown `time_off`; (b) adding
`ON DELETE CASCADE` FKs from allocations/time_off to `team_members` — bigger schema change,
conflicts with the existing `profiles(id)` FK on `allocations.person_id`.

## Changes

### 1. DB migration (delivered as SQL — user pastes into Supabase SQL Editor; no network here)

New file `migrations/2026-09-01-delete-team-member.sql`, mirrored into `supabase-schema.sql`:

```sql
create or replace function public.delete_team_member(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.allocations   where person_id = p_id;
  delete from public.time_off      where person_id = p_id;
  delete from public.team_members  where id = p_id;
end;
$$;

grant execute on function public.delete_team_member(uuid) to authenticated;
```

### 2. Frontend — `src/components/people/PersonModal.tsx`

Rewrite `handleDelete` to: confirm → call the RPC → surface errors via the existing
`error` state. Uses the existing `error` banner so a future failure is visible.
`confirm()` is the minimal guard; a two-step inline confirm on the "Usuń" button is a
low-cost upgrade if we want to avoid the browser dialog.

No other files change — `PeopleClient.refresh()` (`onSaved`) already re-fetches `team_members`.

## Verification (client must run — no network / no live DB from this environment)

1. **Confirm the RLS root cause** (optional): `select polcmd, polname from pg_policy where polrelid = 'public.team_members'::regclass;` — expect no row with `polcmd = 'd'`. The RPC fixes it regardless.
2. **Confirm `time_off` shape BEFORE running the migration** — table not in repo: `select column_name from information_schema.columns where table_name = 'time_off';` — confirm a `person_id` column exists; adjust the migration if the table/column name differs.
3. Apply the migration in Supabase SQL Editor.
4. Local ceiling: `npx tsc --noEmit` (clean) and `next dev` + open `/people` to force compile.
5. Client E2E on planner.rocksoft.pl: open a test person → **Usuń** → confirm → person + their timeline blocks gone; no orphaned allocations remain.

## Risks / assumptions

- **`time_off` is unverified** (not in repo). RPC assumes `public.time_off(person_id)`. Verification step 2 gates this. — HIGH until confirmed.
- **id equality assumption**: allocations/time_off `person_id` FK → `profiles(id)`, but the app filters by `a.person_id === person.id` where `person.id` is a `team_members.id`. The RPC deletes on that same assumption — consistent with existing app behavior. — LOW.
- **Deploy**: `main` already has the button; the fix is the migration + the `handleDelete` rewrite. Both must reach production.
- Cascade is **irreversible** — the `confirm()` step is the only guard. Accepted (client chose cascade).

## Delivery

Delivered via `create_change_pr`. PR carries the change artifacts (`change.md`, `plan.md`),
the migration, and the updated `PersonModal.tsx`. `supabase-schema.sql` deliberately kept
OUT of the PR — the local schema file already carries ~200 lines of prior-change content
not yet in `main`; the migration file is the self-contained functional artifact. The
canonical-schema mirror edit was applied locally for later reconciliation.

## Progress

- [x] Write `migrations/2026-09-01-delete-team-member.sql` (RPC + grant)
- [x] Mirror the function into `supabase-schema.sql` (local only — not in PR)
- [x] Rewrite `handleDelete` in `PersonModal.tsx` (confirm + rpc + error surfacing)
- [x] `npx tsc --noEmit` clean
- [x] Open PR via `create_change_pr`
- [ ] Client: verify `time_off(person_id)` shape, then run migration in Supabase
- [ ] Client: deploy + E2E test the delete on planner.rocksoft.pl
