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
  `allocations` and `time_off` rows (explicitly, in the rpc) **and** their
  `team_member_competencies` + `project_experience` rows (implicitly, via the
  `on delete cascade` FKs on `team_members(id)` — `supabase-schema.sql:188,201`).
  The competency side was missed in the first draft of this plan; it is the larger half
  of the blast radius and the confirmation dialog must name it. Irreversible, no undo.
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
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'insufficient_privilege: admin required to delete a team member';
  end if;

  delete from public.allocations   where person_id = p_id;
  delete from public.time_off      where person_id = p_id;
  delete from public.team_members  where id = p_id;

  if not found then
    raise exception 'team_member % not found', p_id;
  end if;
end;
$$;

revoke execute on function public.delete_team_member(uuid) from public;
grant  execute on function public.delete_team_member(uuid) to authenticated;
```

Two guards the first draft of this plan missed, both inside the function because
`security definer` means RLS is not there to catch anything:

- **`revoke ... from public`** — Postgres grants EXECUTE to PUBLIC by default and
  Supabase's `anon` inherits it. Without the revoke, this RLS-bypassing destructive rpc
  is callable by anyone holding the browser-visible anon key. `search_experts` and
  `save_project_experience` already carry exactly this revoke
  (`migrations/2026-07-28-competency-base.sql:338-341,390-391`).
- **`is_admin` check** — a bare `grant to authenticated` lets any logged-in user delete
  any person. That is also an escalation around the competency policies, which gate much
  smaller writes on `is_admin` / `can_edit_member` while the cascade below destroys
  exactly that data.

### 2. Frontend — `src/components/people/PersonModal.tsx`

Rewrite `handleDelete` to: confirm → call the RPC → surface errors via the existing
`error` state. Uses the existing `error` banner so a future failure is visible.
`confirm()` is the minimal guard; a two-step inline confirm on the "Usuń" button is a
low-cost upgrade if we want to avoid the browser dialog.

No other files change — `PeopleClient.refresh()` (`onSaved`) already re-fetches `team_members`.

## Verification (client must run — no network / no live DB from this environment)

1. **Confirm the RLS root cause** (optional): `select polcmd, polname from pg_policy where polrelid = 'public.team_members'::regclass;` — expect no row with `polcmd = 'd'`. The RPC fixes it regardless.
2. **Settle the id-space question BEFORE running the migration** (the one that decides whether the cascade works at all): `select count(*) from public.allocations a join public.team_members tm on tm.id = a.person_id;` — a 0 here while allocations exist means `allocations.person_id` and `team_members.id` are disjoint, the rpc's `delete from allocations` is a no-op, and the cascade must be rewritten to resolve the person through `profiles` (by email, as `can_edit_member` does) before this ships.
3. **Confirm `time_off` shape** — `select column_name from information_schema.columns where table_name = 'time_off';` — expect `person_id` (already implied by `src/lib/types.ts:60-67`); adjust the migration if the table/column name differs.
4. **Confirm the tester is an admin** — `select email, is_admin from public.profiles where lower(email) = lower('<tester>');` — the rpc now refuses non-admins.
5. Apply the migration in Supabase SQL Editor.
6. Local ceiling: `npx tsc --noEmit` and `next dev` + open `/people` to force compile.
7. Client E2E on planner.rocksoft.pl: open a test person → **Usuń** → confirm → person + their timeline blocks gone; no orphaned allocations remain.
8. **Negative test**: call the rpc as a non-admin (and, with the anon key, as a logged-out client) — both must be refused.

## Risks / assumptions

- **id equality assumption** — the real unknown. `allocations.person_id` carries an FK to
  `profiles(id)` (`supabase-schema.sql:61`), yet the app matches it against
  `team_members.id`. That these are two different id spaces is what
  `can_edit_member` implies: it joins `team_members` to `profiles` on **email**, not on id
  (`migrations/2026-07-28-competency-base.sql:170-182`) — a join that would be pointless if
  the ids were shared. If they are disjoint, `delete from allocations` matches 0 rows, the
  `team_members` row still goes, and the person's allocations are orphaned — the exact
  outcome the cascade exists to prevent, caught only by verification step 5, in production.
  — **HIGH until one query settles it** (see the query in the migration header).
- **`time_off` shape** — the repo does document it after all: `src/lib/types.ts:60-67`
  declares `TimeOff.person_id` and `TimeOffModal.tsx:59` inserts that exact column. Still
  worth the one-line confirmation before applying, but not the headline risk. — LOW.
- **`is_admin` is now a hard precondition.** With the admin gate in place, whoever tests
  the delete must have `profiles.is_admin = true`, or the button fails with
  `insufficient_privilege`. Check with
  `select email, is_admin from public.profiles where lower(email) = lower('<tester>');`
- **Deploy**: `main` already has the button; the fix is the migration + the `handleDelete` rewrite. Both must reach production.
- Cascade is **irreversible** — the `confirm()` step is the only guard. Accepted (client chose cascade).

## Delivery

Delivered via `create_change_pr`. PR carries the change artifacts (`change.md`, `plan.md`),
the migration, and the updated `PersonModal.tsx`. `supabase-schema.sql` deliberately kept
OUT of the PR on the first pass. That has since been corrected: every prior migration is
mirrored into `supabase-schema.sql`, so leaving this one out would make the canonical
schema quietly wrong about a destructive function. The mirror now ships with the change.

## Progress

- [x] Write `migrations/2026-09-01-delete-team-member.sql` (RPC + grant)
- [x] Mirror the function into `supabase-schema.sql` (now shipped, not local-only)
- [x] Code review: add `revoke ... from public`, the `is_admin` gate and the not-found
      guard to the rpc; widen the confirm dialog to name competencies + experience
- [x] Rewrite `handleDelete` in `PersonModal.tsx` (confirm + rpc + error surfacing)
- [x] `npx tsc --noEmit` clean
- [x] Open PR via `create_change_pr`
- [ ] Client: settle the id-space question, confirm the tester is `is_admin`, then run the
      migration in Supabase
- [ ] Client: deploy + E2E test the delete on planner.rocksoft.pl
