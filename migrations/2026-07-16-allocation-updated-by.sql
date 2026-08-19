-- ============================================================
-- Migration: track who LAST edited an allocation
-- Feature: "Ostatnio edytowane przez …" on the /timeline allocation detail
-- ============================================================
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → paste this file → Run.
--   Safe to run more than once (idempotent). Step 3 is commented out — see
--   the note there before re-enabling anything in this file.
--
-- IMPORTANT
--   `created_by`/`updated_by` are stamped by the trigger below, not by the
--   app code directly. If this migration hasn't run yet when the matching
--   code deploys, saves will NOT fail — they'll succeed silently with
--   `updated_by` (and `created_by`) left NULL, quietly losing the audit
--   trail until the migration is applied. Run this migration before (or
--   together with) deploying the matching code.
-- ============================================================

-- 1. Add the column (nullable FK to the person who last edited the row).
alter table public.allocations
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

-- 2. Backfill existing rows: assume the original creator was also the
--    last editor, so old allocations show a sensible name instead of blank.
update public.allocations
  set updated_by = created_by
  where updated_by is null
    and created_by is not null;

-- 3. SUPERSEDED, AND DELIBERATELY NOT EXECUTABLE.
--
--    This step created a second stamping trigger. It has been replaced by
--    allocations_set_actor, consolidated in
--    2026-08-19-consolidate-allocation-actor-trigger.sql — which DROPS the
--    trigger below. The DDL is commented out rather than deleted so this file
--    stays an accurate record of what was originally run: re-running this file
--    (which the header invites) must not resurrect a trigger a later migration
--    removed. Its anti-forgery property — assigning the actor rather than
--    honouring a client-supplied value — lives on in allocations_set_actor.
--
--    Original intent, for the record: stamp created_by/updated_by from the
--    authenticated session rather than trusting the client-supplied value in
--    the request payload, otherwise any authenticated user could attribute a
--    change to someone else. updated_at was stamped here too so every write
--    path (modal edits, and the Timeline drag-move/resize handlers, which
--    never set it themselves) stayed in sync with updated_by.
--
-- create or replace function public.set_allocation_audit_fields()
-- returns trigger language plpgsql security definer set search_path = public
-- as $$
-- begin
--   if tg_op = 'INSERT' then
--     new.created_by := auth.uid();
--   end if;
--   new.updated_by := auth.uid();
--   new.updated_at := now();
--   return new;
-- end;
-- $$;
--
-- drop trigger if exists set_allocation_audit_fields on public.allocations;
-- create trigger set_allocation_audit_fields
--   before insert or update on public.allocations
--   for each row execute procedure public.set_allocation_audit_fields();

-- Note: no RLS change is needed — the existing
-- "allocations: authenticated update" policy (using (true)) already allows
-- writing this column for authenticated users.
