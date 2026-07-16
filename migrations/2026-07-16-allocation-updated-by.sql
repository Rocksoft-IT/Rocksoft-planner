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

-- Note: no RLS change is needed — the existing
-- "allocations: authenticated update" policy (using (true)) already allows
-- writing this column for authenticated users.
