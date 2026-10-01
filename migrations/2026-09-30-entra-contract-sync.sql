-- Entra contract sync. The application's contract field is read-only.
-- Direct database edits remain allowed by the existing permissions/RLS.
-- Run this file in Supabase SQL Editor.
-- Idempotent; supports both first installation and earlier Entra migrations.
begin;
-- Fail instead of waiting indefinitely for a busy live table; all DDL is atomic.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.team_members
  add column if not exists contract_type text,
  add column if not exists entra_contract_type text,
  add column if not exists entra_user_id text,
  add column if not exists entra_contract_synced_at timestamptz;

alter table public.team_members drop constraint if exists team_members_contract_type_check;
alter table public.team_members add constraint team_members_contract_type_check
  check (contract_type is null or contract_type in (
    'UoP', 'B2B', 'Freelance', 'Umowa Zlecenie', 'Umowa o Dzieło', 'Powołanie do Zarządu'
  ));

alter table public.team_members drop constraint if exists team_members_entra_contract_type_check;
alter table public.team_members add constraint team_members_entra_contract_type_check
  check (entra_contract_type is null or entra_contract_type in (
    'UoP', 'B2B', 'Freelance', 'Umowa Zlecenie', 'Umowa o Dzieło', 'Powołanie do Zarządu'
  ));

drop trigger if exists team_member_contract_source on public.team_members;

-- Preserve existing values during rollout. Sync replaces them only after a
-- successful Entra lookup; missing credentials, unknown types or a Graph outage must not
-- erase the current contracts. The legacy manual flag, if present, is ignored.

create or replace function public.team_member_contract_source()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Reset a changed identity without restricting contract edits or inserts.
  if lower(trim(new.email)) is distinct from lower(trim(old.email)) then
    new.contract_type := null;
    new.entra_contract_type := null;
    new.entra_user_id := null;
    new.entra_contract_synced_at := null;
  end if;
  return new;
end;
$$;

create trigger team_member_contract_source before update of email on public.team_members
  for each row execute function public.team_member_contract_source();

-- One atomic write, available only to the server integration. Reject stale syncs
-- and snapshots for an email that has changed since the lookup began.
create or replace function public.sync_entra_contract_types(p_updates jsonb, p_synced_at timestamptz)
returns integer language plpgsql security invoker set search_path = public as $$
declare updated_count integer;
begin
  update public.team_members tm
  set entra_contract_type = incoming.contract_type,
      entra_user_id = incoming.entra_user_id,
      entra_contract_synced_at = p_synced_at,
      contract_type = incoming.contract_type,
      updated_at = now()
  from jsonb_to_recordset(p_updates) as incoming(id uuid, email text, entra_user_id text, contract_type text)
  where tm.id = incoming.id and tm.email = incoming.email
    and (tm.entra_contract_synced_at is null or tm.entra_contract_synced_at < p_synced_at);
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.sync_entra_contract_types(jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.sync_entra_contract_types(jsonb, timestamptz) to service_role;

-- Do not drop legacy columns: existing views/integrations may still reference
-- them. This integration neither creates nor uses contract_type_manual.
commit;
