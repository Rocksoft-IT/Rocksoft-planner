-- ============================================================
-- Migration: per-account theme preference (dark/light)
-- Feature: theme switch under the avatar menu (issue #68)
-- ============================================================
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → paste this file → Run.
--   Safe to run more than once (idempotent).
--
-- WHY
--   A signed-in user can switch between dark and light theme from the menu
--   under their avatar. The choice must follow the account across devices
--   and sign-ins (not browser-local storage), so it lives on `profiles`
--   rather than the client. Defaults to 'dark' so every existing and
--   future account keeps today's look with zero visual change on release
--   — no backfill needed, the column DEFAULT already gives every existing
--   row 'dark'. Sign-in/registration/password-reset stay dark
--   unconditionally regardless of this value, since there is no account to
--   read a preference from before login (handled in application code, not
--   here).
--
-- ROLLBACK
--   alter table public.profiles drop column if exists theme;
--   -- safe: no dependent data, no other table or view references this
--   -- column, no data migrated by this change.
-- ============================================================

-- 1. Add the column (defaults every existing + future row to 'dark').
alter table public.profiles
  add column if not exists theme text not null default 'dark';

-- 2. Restrict to known theme values. Idempotent drop/add, matching the
--    guard pattern used elsewhere in this schema (e.g.
--    tmc_years_experience_check in supabase-schema.sql).
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check
  check (theme in ('light', 'dark'));

-- Note: no RLS change is needed — the existing "profiles: update own"
-- policy (using (auth.uid() = id)) already allows a signed-in user to
-- write their own theme.
