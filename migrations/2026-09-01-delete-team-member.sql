-- 2026-09-01 delete-team-member
--
-- Cascade-delete a person from the /people directory: remove their allocations and
-- their time-off, then the team_members row itself.
--
-- WHY a SECURITY DEFINER rpc instead of a plain client .delete():
--   * public.team_members has RLS enabled with NO delete policy, so a client-side
--     delete removes 0 rows and returns no error (silent no-op — the "Usuń button
--     does nothing" bug). This function runs with definer rights, bypassing that.
--   * allocations / time_off have no FK to team_members (they reference profiles),
--     so there is no DB-level cascade. This function performs the cascade explicitly.
--   * Doing all three deletes in one function call makes it atomic (all-or-nothing).
--
-- Mirrors the existing search_experts rpc pattern (called via supabase.rpc(...)).
--
-- FULL BLAST RADIUS — deleting a team_members row also removes, via ON DELETE CASCADE
-- FKs declared on team_members(id):
--   * public.team_member_competencies  (the person's whole competency profile)
--   * public.project_experience        (and its project_experience_tags, in turn)
-- Those two are NOT deleted by this function directly; the FKs do it. They are listed
-- here because the confirmation dialog in PersonModal.tsx must name them — this is an
-- irreversible delete and the dialog is its only guard.
--
-- BEFORE APPLYING, settle the id-space question (see plan.md "Risks"):
--   select count(*) from public.allocations a
--     join public.team_members tm on tm.id = a.person_id;
-- allocations.person_id carries an FK to profiles(id), yet the app matches it against
-- team_members.id. If that count is 0 while allocations exist, the ids are disjoint,
-- the `delete from allocations` below is a no-op, and this function will orphan a
-- deleted person's allocations instead of cascading them.

create or replace function public.delete_team_member(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Authorization must live INSIDE the function: security definer bypasses RLS, so
  -- without this check every authenticated user could delete anyone. That would also
  -- be an escalation around the competency policies, which gate far less destructive
  -- writes on is_admin / can_edit_member — yet the cascade above wipes exactly that
  -- data. Admin-only is the conservative gate for removing a directory entry.
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'insufficient_privilege: admin required to delete a team member';
  end if;

  delete from public.allocations   where person_id = p_id;
  delete from public.time_off      where person_id = p_id;
  delete from public.team_members  where id = p_id;

  -- Without this the caller cannot tell "deleted" from "no such id" — the rpc returns
  -- void either way and the UI reports success for a delete that removed nothing.
  if not found then
    raise exception 'team_member % not found', p_id;
  end if;
end;
$$;

-- Revoke the implicit PUBLIC execute so anon can't call this. Postgres grants EXECUTE
-- to PUBLIC by default and Supabase's anon role inherits it; combined with security
-- definer that would expose a destructive, RLS-bypassing endpoint to anyone holding
-- the browser-visible anon key. Same lock-down as search_experts / save_project_experience.
revoke execute on function public.delete_team_member(uuid) from public;
grant execute on function public.delete_team_member(uuid) to authenticated;
