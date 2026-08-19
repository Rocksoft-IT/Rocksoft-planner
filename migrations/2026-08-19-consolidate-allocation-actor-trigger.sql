-- ============================================================
-- Migration: consolidate the allocation actor-stamping triggers into one
-- Feature: "Ostatnio edytowane przez …" on the /timeline allocation detail
-- ============================================================
--
-- WHY
--   Two BEFORE INSERT OR UPDATE triggers ended up on public.allocations,
--   both stamping created_by / updated_by:
--
--     set_allocation_audit_fields  -- 2026-07-16-allocation-updated-by.sql
--     allocations_set_actor        -- 2026-07-20-allocation-actor-trigger.sql
--
--   supabase-schema.sql declares only allocations_set_actor, so a database
--   provisioned fresh has one trigger while a live database that ran both
--   migrations has two. Postgres fires BEFORE triggers in alphabetical order
--   by trigger name, so allocations_set_actor runs first and
--   set_allocation_audit_fields overwrites its result. Each trigger carried
--   one half of the intended behaviour:
--
--     - allocations_set_actor resolves the actor through a profiles lookup,
--       which guards the created_by / updated_by foreign key: it yields a
--       valid profile id or NULL, never an id absent from profiles. That guard
--       was being discarded, so an authenticated user with no profiles row got
--       a raw auth.uid() written and the save failed with an FK violation
--       instead of the intended NULL.
--     - set_allocation_audit_fields assigned auth.uid() unconditionally, so a
--       client-supplied created_by / updated_by in the request payload could
--       never win. That matters: RLS on allocations is
--       `for insert to authenticated with check (true)` with no column grants,
--       so without it any authenticated user can POST an allocation carrying a
--       colleague's uuid and have the timeline attribute it to them.
--
--   This migration keeps ONE trigger that carries BOTH properties: the profiles
--   lookup (FK guard) and unconditional stamping (anti-forgery).
--
-- ALSO CHANGED
--   - created_by is now immutable on UPDATE (restored from the existing row),
--     matching the documented intent that the author is the manager who first
--     made the assignment and does not change when someone else edits it.
--   - The function is SECURITY DEFINER with a pinned search_path, so resolving
--     the actor does not depend on the profiles SELECT policy staying open. As
--     an invoker-rights function the lookup runs under RLS: narrowing
--     "profiles: authenticated read all" would silently make every stamp NULL.
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → paste this file → Run.
--   Safe to run more than once (drop ... if exists / create or replace).
--
-- REQUIRES
--   2026-07-16-allocation-updated-by.sql (the updated_by column).
--   Supersedes the trigger DDL in that file and in
--   2026-07-20-allocation-actor-trigger.sql; both have been commented out
--   there, so re-running either cannot reintroduce the old behaviour.
-- ============================================================

-- 1. Remove the superseded trigger and its function. Dropping the trigger
--    first leaves nothing depending on the function.
drop trigger if exists set_allocation_audit_fields on public.allocations;
drop function if exists public.set_allocation_audit_fields();

-- 2. The surviving trigger, carrying both guarantees. Identical to the
--    definition in supabase-schema.sql.
create or replace function public.set_allocation_actor()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  -- Resolving through profiles guards the FK: a valid profile id, or NULL —
  -- never an id absent from profiles. SECURITY DEFINER keeps this working
  -- regardless of how the profiles SELECT policy is scoped.
  actor uuid := (select id from public.profiles where id = auth.uid());
begin
  if (tg_op = 'INSERT') then
    -- Assigned, not coalesced: the client must never be able to choose the
    -- author. RLS allows any authenticated user to insert any row, so honouring
    -- a client-supplied created_by would let anyone attribute work to a
    -- colleague.
    new.created_by := actor;
    new.updated_by := actor;
  elsif (tg_op = 'UPDATE') then
    -- The author is whoever first made the assignment and does not change when
    -- someone else edits the allocation; restore it from the stored row so a
    -- crafted payload cannot rewrite history.
    new.created_by := old.created_by;
    new.updated_by := actor;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists allocations_set_actor on public.allocations;
create trigger allocations_set_actor
  before insert or update on public.allocations
  for each row execute function public.set_allocation_actor();

-- 3. Verify: this should return exactly one row, allocations_set_actor.
--
--   select tgname
--   from pg_trigger
--   where tgrelid = 'public.allocations'::regclass
--     and not tgisinternal;
