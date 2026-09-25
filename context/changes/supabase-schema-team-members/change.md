---
change_id: supabase-schema-team-members
title: Add the missing team_members table to supabase-schema.sql
status: implemented
created: 2026-09-25
updated: 2026-09-25
archived_at: null
---

## Notes

https://github.com/Rocksoft-IT/Rocksoft-planner/issues/74

Found during code review of #72 (pre-existing gap, extended by the new `alter table` in that PR).

`supabase-schema.sql` has `create table` statements for profiles/projects/allocations/etc. but **none for `team_members`**, even though foreign keys reference it (around lines 193/206) and #72 appends `alter table public.team_members ...` (~line 503).

**Effect:** running `supabase-schema.sql` on a fresh database fails before it reaches the new block — the committed script is not a runnable from-scratch schema. The only real apply path today is the per-change migration files under `migrations/`.

**Suggested fix:** either add the missing `create table public.team_members (...)` to `supabase-schema.sql` so it is a true from-scratch schema, or document that it is a reference mirror only and that `migrations/` is the source of truth.

Severity: low / non-blocking.
