-- ============================================================
-- Competency base security hardening
--
-- Replaces mutable email-based ownership with an immutable profile link,
-- prevents self-service privilege escalation, restricts directory writes to
-- admins, and enforces the company email domain at the database boundary.
-- Run after 2026-07-28-competency-base.sql.
-- ============================================================

-- A login profile can own at most one directory record. Existing rows are
-- backfilled only when their email matches exactly; future links are maintained
-- by triggers below.
alter table public.team_members
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

create unique index if not exists team_members_profile_id_unique_idx
  on public.team_members(profile_id)
  where profile_id is not null;

update public.team_members tm
set profile_id = pr.id
from public.profiles pr
where tm.profile_id is null
  and trim(tm.email) <> ''
  and lower(trim(tm.email)) = lower(trim(pr.email))
  and not exists (
    select 1 from public.team_members linked where linked.profile_id = pr.id
  )
  and 1 = (
    select count(*)
    from public.team_members same_email
    where lower(trim(same_email.email)) = lower(trim(tm.email))
  );

-- Security-definer helpers avoid recursive RLS checks when a policy needs the
-- current profile. They expose booleans only and use a fixed search_path.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_admin from public.profiles p where p.id = auth.uid()
  ), false);
$$;

create or replace function public.is_organization_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select lower(trim(p.email)) ~ '^[^@]+@rocksoft\.pl$'
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

revoke execute on function public.is_current_user_admin() from public;
revoke execute on function public.is_organization_user() from public;
grant execute on function public.is_current_user_admin() to authenticated, service_role;
grant execute on function public.is_organization_user() to authenticated, service_role;

-- Browser clients may update presentation fields on their own profile, but they
-- must never be able to change the identity/admin fields used by authorization.
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.is_admin is distinct from old.is_admin then
      raise exception 'Profile identity and admin fields can only be changed by the service role.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_security_fields on public.profiles;
create trigger profiles_protect_security_fields
  before update on public.profiles
  for each row execute function public.protect_profile_security_fields();

-- Keep directory ownership synchronized when an admin creates or changes a team
-- member. Email is used only to establish the immutable link, never to authorize.
create or replace function public.link_team_member_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.id into new.profile_id
  from public.profiles p
  where lower(trim(p.email)) = lower(trim(new.email))
  limit 1;
  return new;
end;
$$;

drop trigger if exists team_members_link_profile on public.team_members;
create trigger team_members_link_profile
  before insert or update of email on public.team_members
  for each row execute function public.link_team_member_profile();

-- Reject direct Supabase sign-ups outside the organization and link an accepted
-- account to its pre-existing directory row. The frontend check is UX only; this
-- trigger is the authoritative boundary.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or lower(trim(new.email)) !~ '^[^@]+@rocksoft\.pl$' then
    raise exception 'Only @rocksoft.pl accounts are allowed.';
  end if;

  insert into public.profiles (id, email, full_name, role, avatar_color)
  values (
    new.id,
    lower(trim(new.email)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', ''),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#6366f1')
  );

  update public.team_members
  set profile_id = new.id
  where profile_id is null
    and lower(trim(email)) = lower(trim(new.email))
    and 1 = (
      select count(*)
      from public.team_members same_email
      where lower(trim(same_email.email)) = lower(trim(new.email))
    );

  return new;
end;
$$;

-- Profile policies no longer recurse through profiles, and the trigger above
-- protects privileged columns even when a user updates their own row.
drop policy if exists "profiles: authenticated read all" on public.profiles;
drop policy if exists "profiles: organization read" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "profiles: admin update all" on public.profiles;

create policy "profiles: organization read"
  on public.profiles for select to authenticated
  using (public.is_organization_user());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles: admin update all"
  on public.profiles for update to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- Directory data is readable internally, but only admins may create, rename or
-- delete people. This prevents a user from claiming a row by changing its email.
alter table public.team_members enable row level security;

do $$
declare policy_name text;
begin
  for policy_name in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'team_members'
  loop
    execute format('drop policy %I on public.team_members', policy_name);
  end loop;
end;
$$;

create policy "team_members: organization read"
  on public.team_members for select to authenticated
  using (public.is_organization_user());
create policy "team_members: admin insert"
  on public.team_members for insert to authenticated
  with check (public.is_current_user_admin());
create policy "team_members: admin update"
  on public.team_members for update to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());
create policy "team_members: admin delete"
  on public.team_members for delete to authenticated
  using (public.is_current_user_admin());

-- Ownership now depends exclusively on profile_id. Admins retain support access.
create or replace function public.can_edit_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.id = p_member_id and tm.profile_id = auth.uid()
  ) or public.is_current_user_admin();
$$;

revoke execute on function public.can_edit_member(uuid) from public;
grant execute on function public.can_edit_member(uuid) to authenticated, service_role;

-- Internal competency data is available only to organization users. The
-- service-role client used by the external API bypasses RLS after API-key auth.
drop policy if exists "competency_tags: read" on public.competency_tags;
create policy "competency_tags: read"
  on public.competency_tags for select to authenticated
  using (public.is_organization_user());

drop policy if exists "competency_tags: insert" on public.competency_tags;
create policy "competency_tags: insert"
  on public.competency_tags for insert to authenticated
  with check (
    public.is_organization_user()
    and (is_curated = false or public.is_current_user_admin())
  );

drop policy if exists "team_member_competencies: read" on public.team_member_competencies;
create policy "team_member_competencies: read"
  on public.team_member_competencies for select to authenticated
  using (public.is_organization_user());

drop policy if exists "project_experience: read" on public.project_experience;
create policy "project_experience: read"
  on public.project_experience for select to authenticated
  using (public.is_organization_user());

drop policy if exists "project_experience_tags: read" on public.project_experience_tags;
create policy "project_experience_tags: read"
  on public.project_experience_tags for select to authenticated
  using (public.is_organization_user());

-- Audit actors must come from the authenticated session, never client input.
create or replace function public.set_competency_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select id from public.profiles where id = auth.uid());
begin
  if tg_op = 'INSERT' then
    new.created_by := actor;
    new.updated_by := actor;
  elsif tg_op = 'UPDATE' then
    new.updated_by := actor;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
