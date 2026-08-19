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
--   set_allocation_audit_fields then overwrites its result — which means:
--
--     - the profiles lookup that guards the created_by / updated_by foreign
--       key is discarded. An authenticated user with no matching profiles row
--       gets a raw auth.uid() written, raising an FK violation on save instead
--       of the intended NULL.
--     - on INSERT, created_by is overwritten unconditionally rather than via
--       coalesce(new.created_by, actor), so an explicitly supplied author is
--       silently replaced.
--
--   allocations_set_actor is the intended behaviour (it is what the schema
--   file declares), so this migration removes the other one.
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → paste this file → Run.
--   Safe to run more than once (drop ... if exists / create or replace).
--
-- REQUIRES
--   2026-07-16-allocation-updated-by.sql and
--   2026-07-20-allocation-actor-trigger.sql (either order).
-- ============================================================

-- 1. Remove the superseded trigger and its function. Dropping the trigger
--    first leaves nothing depending on the function.
drop trigger if exists set_allocation_audit_fields on public.allocations;
drop function if exists public.set_allocation_audit_fields();

-- 2. Re-assert the surviving trigger so this file is enough to reach the
--    intended state on its own, whatever ran before it. Identical to
--    supabase-schema.sql and 2026-07-20-allocation-actor-trigger.sql.
create or replace function public.set_allocation_actor()
returns trigger language plpgsql as $$
declare
  actor uuid := (select id from public.profiles where id = auth.uid());
begin
  if (tg_op = 'INSERT') then
    new.created_by := coalesce(new.created_by, actor);
    new.updated_by := coalesce(new.updated_by, actor);
  elsif (tg_op = 'UPDATE') then
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
