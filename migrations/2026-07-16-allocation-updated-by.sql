-- ============================================================
-- Migration: track who LAST edited an allocation
-- Feature: "Ostatnio edytowane przez …" on the /timeline allocation detail
-- ============================================================
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → paste this file → Run.
--   Safe to run more than once (idempotent).
--
-- IMPORTANT
--   The app code writes `allocations.updated_by` on every create/update.
--   Until this column exists, saving an allocation will fail. Run this
--   migration before (or together with) deploying the matching code.
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

-- 3. Stamp created_by/updated_by from the authenticated session rather than
--    trusting the client-supplied value in the request payload — otherwise
--    any authenticated user could attribute a change to someone else.
create or replace function public.set_allocation_audit_fields()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_allocation_audit_fields on public.allocations;
create trigger set_allocation_audit_fields
  before insert or update on public.allocations
  for each row execute procedure public.set_allocation_audit_fields();

-- Note: no RLS change is needed — the existing
-- "allocations: authenticated update" policy (using (true)) already allows
-- writing this column for authenticated users.
