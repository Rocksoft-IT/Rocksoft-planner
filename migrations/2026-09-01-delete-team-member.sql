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

create or replace function public.delete_team_member(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.allocations   where person_id = p_id;
  delete from public.time_off      where person_id = p_id;
  delete from public.team_members  where id = p_id;
end;
$$;

grant execute on function public.delete_team_member(uuid) to authenticated;
