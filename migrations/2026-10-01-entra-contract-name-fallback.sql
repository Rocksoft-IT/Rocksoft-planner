-- Apply after 2026-09-30-entra-contract-sync.sql, before deploying the name fallback.
-- No tables/columns or existing contracts are changed by this migration.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Fail before replacing live definitions if the base integration is incomplete.
do $$
begin
  if to_regprocedure('public.sync_entra_contract_types(jsonb,timestamp with time zone)') is null
    or exists (
      select 1 from unnest(array[
        'id', 'email', 'full_name', 'contract_type', 'entra_contract_type',
        'entra_user_id', 'entra_contract_synced_at', 'updated_at'
      ]) as required_column(name)
      where not exists (
        select 1 from pg_attribute a
        where a.attrelid = to_regclass('public.team_members')
          and a.attname = required_column.name and not a.attisdropped
      )
    ) then
    raise exception 'Run 2026-09-30-entra-contract-sync.sql before this migration.';
  end if;
end;
$$;

create or replace function public.team_member_contract_source()
returns trigger language plpgsql set search_path = public as $$
begin
  -- A name becomes part of the identity only when there is no email.
  if lower(trim(new.email)) is distinct from lower(trim(old.email))
    or (coalesce(new.email, '') ~ '^[[:space:]]*$'
      and btrim(regexp_replace(lower(new.full_name), '[[:space:]]+', ' ', 'g'))
        is distinct from btrim(regexp_replace(lower(old.full_name), '[[:space:]]+', ' ', 'g'))) then
    new.contract_type := null;
    new.entra_contract_type := null;
    new.entra_user_id := null;
    new.entra_contract_synced_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists team_member_contract_source on public.team_members;
create trigger team_member_contract_source before update of email, full_name on public.team_members
  for each row execute function public.team_member_contract_source();

-- Retain the existing RPC signature and email-only caller compatibility.
create or replace function public.sync_entra_contract_types(p_updates jsonb, p_synced_at timestamptz)
returns integer language plpgsql security invoker
set search_path = public
set lock_timeout = '5s' as $$
declare
  incoming record;
  email_filled boolean;
  updated_count integer := 0;
begin
  -- Lock identities before filling emails. A separate contract write restores
  -- metadata after the existing email-change trigger resets it, in one transaction.
  for incoming in
    select payload.*, tm.contract_type as previous_contract_type,
      tm.entra_contract_type as previous_entra_contract_type
    from jsonb_to_recordset(p_updates) as payload(
      id uuid, email text, full_name text, match_by_name boolean,
      entra_user_id text, contract_type text, email_to_fill text, sync_contract boolean
    )
    join public.team_members tm on tm.id = payload.id
    where tm.email is not distinct from payload.email
      and (tm.entra_contract_synced_at is null or tm.entra_contract_synced_at < p_synced_at)
      and (payload.match_by_name is not true or (
        coalesce(tm.email, '') ~ '^[[:space:]]*$'
        and tm.full_name = payload.full_name
        and btrim(regexp_replace(lower(tm.full_name), '[[:space:]]+', ' ', 'g')) <> ''
        and not exists (
          select 1 from public.team_members other
          where other.id <> tm.id
            and btrim(regexp_replace(lower(other.full_name), '[[:space:]]+', ' ', 'g'))
              = btrim(regexp_replace(lower(tm.full_name), '[[:space:]]+', ' ', 'g'))
        )
      ))
    order by tm.id
    for update of tm
  loop
    -- A cursor snapshot can predate a wait for a row lock. Recheck names with
    -- a fresh statement snapshot before writing, including new committed peers.
    if incoming.match_by_name is true and exists (
      select 1 from public.team_members other
      where other.id <> incoming.id
        and btrim(regexp_replace(lower(other.full_name), '[[:space:]]+', ' ', 'g'))
          = btrim(regexp_replace(lower(incoming.full_name), '[[:space:]]+', ' ', 'g'))
    ) then
      continue;
    end if;
    email_filled := false;
    if incoming.match_by_name is true
      and incoming.email_to_fill ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      and position('#ext#' in lower(incoming.email_to_fill)) = 0
      and not exists (
        select 1 from public.team_members other
        where other.id <> incoming.id
          and lower(btrim(other.email)) = lower(btrim(incoming.email_to_fill))
      ) then
      update public.team_members
      set email = lower(btrim(incoming.email_to_fill))
      where id = incoming.id;
      email_filled := true;
    end if;

    if coalesce(incoming.sync_contract, true) or email_filled then
      update public.team_members
      set contract_type = case when coalesce(incoming.sync_contract, true)
            then incoming.contract_type else incoming.previous_contract_type end,
          entra_contract_type = case when coalesce(incoming.sync_contract, true)
            then incoming.contract_type else incoming.previous_entra_contract_type end,
          entra_user_id = incoming.entra_user_id,
          entra_contract_synced_at = p_synced_at,
          updated_at = now()
      where id = incoming.id;
      updated_count := updated_count + 1;
    end if;
  end loop;
  return updated_count;
end;
$$;

revoke all on function public.sync_entra_contract_types(jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.sync_entra_contract_types(jsonb, timestamptz) to service_role;
commit;
