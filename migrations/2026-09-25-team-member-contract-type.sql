-- ============================================================
-- Migration: team member contract type
-- Feature: contract type on the team member profile + timeline sort (issue #71)
-- ============================================================
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → paste this file → Run.
--   Safe to run more than once (idempotent).
--
-- WHY
--   A team member's profile can record how they are engaged — UoP (Polish
--   employment contract), B2B or Freelance — so the Timeline can group
--   people by it. The field is optional: existing team members have no
--   contract type recorded anywhere, and nothing requires backfilling one,
--   so the column stays nullable with no default. Every existing row is
--   already valid as `contract_type IS NULL`, which is exactly the "unset"
--   state the feature treats as its own sort group — no backfill needed.
--
-- ROLLBACK
--   alter table public.team_members drop constraint if exists
--     team_members_contract_type_check;
--   alter table public.team_members drop column if exists contract_type;
--   -- safe: no dependent data, no other table or view references this
--   -- column, no data migrated by this change.
-- ============================================================

-- 1. Add the column (nullable, no default — unset is a valid, common state).
alter table public.team_members
  add column if not exists contract_type text;

-- 2. Restrict to known contract types. Idempotent drop/add, matching the
--    guard pattern used elsewhere in this schema (e.g.
--    tmc_years_experience_check in supabase-schema.sql).
alter table public.team_members drop constraint if exists team_members_contract_type_check;
alter table public.team_members add constraint team_members_contract_type_check
  check (contract_type is null or contract_type in ('UoP', 'B2B', 'Freelance'));

-- Note: no RLS change is needed — team_members RLS is row-level, not
-- column-level, so whoever can already write full_name/role/email/etc. on
-- this row is authorized to write contract_type too.
