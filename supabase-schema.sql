-- ============================================================
-- Rocksoft Planner — Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. PROFILES
-- Extends auth.users. A row is created automatically via trigger
-- when a new user signs up.

create table if not exists public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  email                  text not null default '',
  full_name              text not null default '',
  role                   text not null default '',
  capacity_hours_per_day numeric(4,1) not null default 8,
  is_admin               boolean not null default false,
  avatar_color           text not null default '#6366f1',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Directory records are independent from login accounts so contractors or
-- future hires can exist without access. profile_id is the immutable ownership
-- link used by competency RLS; email is only used to establish that link.
create table if not exists public.team_members (
  id                     uuid primary key default gen_random_uuid(),
  profile_id             uuid references public.profiles(id) on delete set null,
  full_name              text not null,
  role                   text not null default '',
  email                  text not null default '',
  capacity_hours_per_day numeric(4,1) not null default 8
                           check (capacity_hours_per_day > 0 and capacity_hours_per_day <= 24),
  avatar_color           text not null default '#6366f1',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists team_members_profile_id_unique_idx
  on public.team_members(profile_id)
  where profile_id is not null;

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. PROJECTS

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#6366f1',
  description text,
  start_date  date,
  end_date    date,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3. ALLOCATIONS

create table if not exists public.allocations (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.team_members(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  start_date    date not null,
  end_date      date not null,
  hours_per_day numeric(4,1) not null default 8,
  status        text not null default 'confirmed' check (status in ('confirmed','tentative')),
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  updated_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint valid_date_range check (end_date >= start_date)
);

create table if not exists public.time_off (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.team_members(id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  type       text not null check (type in ('vacation','sick_leave','other')),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_off_valid_date_range check (end_date >= start_date)
);

-- Trigger: stamp created_by / updated_by from the authenticated user (auth.uid()),
-- so author tracking is reliable even when the client doesn't send the id. The
-- profiles lookup guards the FK: it yields a valid profile id or NULL, never an
-- id absent from profiles.
create or replace function public.set_allocation_actor()
returns trigger language plpgsql as $$
declare
  actor uuid := (select id from public.profiles where id = auth.uid());
begin
  if (tg_op = 'INSERT') then
    new.created_by := actor;
    new.updated_by := actor;
  elsif (tg_op = 'UPDATE') then
    new.updated_by := actor;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists allocations_set_actor on public.allocations;
create trigger allocations_set_actor
  before insert or update on public.allocations
  for each row execute function public.set_allocation_actor();

-- Authorization helpers use SECURITY DEFINER to avoid recursive profile-policy
-- evaluation. They return booleans only and run with a fixed search_path.
create or replace function public.is_current_user_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_organization_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select lower(trim(p.email)) ~ '^[^@]+@rocksoft\.pl$'
    from public.profiles p where p.id = auth.uid()
  ), false);
$$;

revoke execute on function public.is_current_user_admin() from public;
revoke execute on function public.is_organization_user() from public;
grant execute on function public.is_current_user_admin() to authenticated, service_role;
grant execute on function public.is_organization_user() to authenticated, service_role;

-- Identity and authorization fields cannot be changed through an authenticated
-- browser session. Service-role and SQL maintenance remain available.
create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and (
    new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.is_admin is distinct from old.is_admin
  ) then
    raise exception 'Profile identity and admin fields can only be changed by the service role.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_security_fields on public.profiles;
create trigger profiles_protect_security_fields
  before update on public.profiles
  for each row execute function public.protect_profile_security_fields();

-- Admin directory edits keep the immutable login ownership link synchronized.
create or replace function public.link_team_member_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select p.id into new.profile_id
  from public.profiles p
  where lower(trim(p.email)) = lower(trim(new.email))
  limit 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists team_members_link_profile on public.team_members;
create trigger team_members_link_profile
  before insert or update of email on public.team_members
  for each row execute function public.link_team_member_profile();

-- 4. ROW LEVEL SECURITY

alter table public.profiles  enable row level security;
alter table public.team_members enable row level security;
alter table public.projects   enable row level security;
alter table public.allocations enable row level security;
alter table public.time_off enable row level security;

-- Profiles: organization users read all; users update their non-security fields.
create policy "profiles: organization read"
  on public.profiles for select to authenticated using (public.is_organization_user());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Admins can update any profile
create policy "profiles: admin update all"
  on public.profiles for update to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());

-- Team directory: internal read, admin-only maintenance.
create policy "team_members: organization read"
  on public.team_members for select to authenticated using (public.is_organization_user());
create policy "team_members: admin insert"
  on public.team_members for insert to authenticated with check (public.is_current_user_admin());
create policy "team_members: admin update"
  on public.team_members for update to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());
create policy "team_members: admin delete"
  on public.team_members for delete to authenticated using (public.is_current_user_admin());

-- Projects: organization users can read/write all.
create policy "projects: authenticated read"
  on public.projects for select to authenticated using (public.is_organization_user());

create policy "projects: authenticated insert"
  on public.projects for insert to authenticated with check (public.is_organization_user());

create policy "projects: authenticated update"
  on public.projects for update to authenticated
  using (public.is_organization_user()) with check (public.is_organization_user());

create policy "projects: authenticated delete"
  on public.projects for delete to authenticated using (public.is_organization_user());

-- Allocations: organization users can read/write all.
create policy "allocations: authenticated read"
  on public.allocations for select to authenticated using (public.is_organization_user());

create policy "allocations: authenticated insert"
  on public.allocations for insert to authenticated with check (public.is_organization_user());

create policy "allocations: authenticated update"
  on public.allocations for update to authenticated
  using (public.is_organization_user()) with check (public.is_organization_user());

create policy "allocations: authenticated delete"
  on public.allocations for delete to authenticated using (public.is_organization_user());

create policy "time_off: authenticated read"
  on public.time_off for select to authenticated using (public.is_organization_user());
create policy "time_off: authenticated insert"
  on public.time_off for insert to authenticated with check (public.is_organization_user());
create policy "time_off: authenticated update"
  on public.time_off for update to authenticated
  using (public.is_organization_user()) with check (public.is_organization_user());
create policy "time_off: authenticated delete"
  on public.time_off for delete to authenticated using (public.is_organization_user());

-- 5. INDEXES

create index if not exists allocations_person_id_idx on public.allocations(person_id);
create index if not exists allocations_project_id_idx on public.allocations(project_id);
create index if not exists allocations_dates_idx on public.allocations(start_date, end_date);

-- 6. SAMPLE DATA (optional — remove if not needed)
-- Uncomment to pre-populate with demo data:
--
-- insert into public.projects (name, color, description) values
--   ('Website Redesign', '#6366f1', 'Full redesign of company website'),
--   ('Mobile App v2',    '#ec4899', 'Second version of the mobile application'),
--   ('API Integration',  '#10b981', 'Third-party API integration project'),
--   ('Internal Tooling', '#f59e0b', 'Internal developer productivity tools');

-- ============================================================
-- 7. COMPETENCY BASE  (change: competency-database)
-- Mirror of migrations/2026-07-28-competency-base.sql. See that file for the
-- WHY/HOW rationale. People live in public.team_members; competencies reference
-- team_members(id). "Who edited" is stamped into created_by/updated_by (→ profiles).
-- ============================================================

create table if not exists public.competency_tags (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('skill','technology')),
  name       text not null,
  slug       text not null,
  is_curated boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competency_tags_kind_slug_key unique (kind, slug)
);

create table if not exists public.team_member_competencies (
  id                uuid primary key default gen_random_uuid(),
  team_member_id    uuid not null references public.team_members(id) on delete cascade,
  competency_tag_id uuid not null references public.competency_tags(id) on delete cascade,
  proficiency       smallint check (proficiency between 1 and 5),
  years_experience  numeric(4,1),
  created_by        uuid references public.profiles(id) on delete set null,
  updated_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint team_member_competencies_unique unique (team_member_id, competency_tag_id)
);

create table if not exists public.project_experience (
  id             uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  project_id     uuid references public.projects(id) on delete set null,
  title          text not null,
  role           text,
  description    text,
  start_date     date,
  end_date       date,
  search_tsv     tsvector generated always as (
                   to_tsvector('simple',
                     coalesce(title,'') || ' ' || coalesce(role,'') || ' ' || coalesce(description,''))
                 ) stored,
  created_by     uuid references public.profiles(id) on delete set null,
  updated_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint project_experience_valid_dates check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.project_experience_tags (
  experience_id     uuid not null references public.project_experience(id) on delete cascade,
  competency_tag_id uuid not null references public.competency_tags(id) on delete cascade,
  constraint project_experience_tags_pkey primary key (experience_id, competency_tag_id)
);

create or replace function public.set_competency_actor()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := (select id from public.profiles where id = auth.uid());
begin
  if (tg_op = 'INSERT') then
    new.created_by := actor;
    new.updated_by := actor;
  elsif (tg_op = 'UPDATE') then
    new.updated_by := actor;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists competency_tags_set_actor on public.competency_tags;
create trigger competency_tags_set_actor
  before insert or update on public.competency_tags
  for each row execute function public.set_competency_actor();

drop trigger if exists team_member_competencies_set_actor on public.team_member_competencies;
create trigger team_member_competencies_set_actor
  before insert or update on public.team_member_competencies
  for each row execute function public.set_competency_actor();

drop trigger if exists project_experience_set_actor on public.project_experience;
create trigger project_experience_set_actor
  before insert or update on public.project_experience
  for each row execute function public.set_competency_actor();

create extension if not exists pg_trgm;
create index if not exists competency_tags_slug_idx on public.competency_tags(slug);
create index if not exists competency_tags_name_trgm_idx on public.competency_tags using gin (name gin_trgm_ops);
create index if not exists tmc_team_member_idx on public.team_member_competencies(team_member_id);
create index if not exists tmc_tag_idx on public.team_member_competencies(competency_tag_id);
create index if not exists project_experience_member_idx on public.project_experience(team_member_id);
create index if not exists project_experience_tsv_idx on public.project_experience using gin (search_tsv);
create index if not exists pet_tag_idx on public.project_experience_tags(competency_tag_id);

-- Guard years_experience even on direct (non-UI) writes. Idempotent drop/add.
alter table public.team_member_competencies drop constraint if exists tmc_years_experience_check;
alter table public.team_member_competencies add constraint tmc_years_experience_check
  check (years_experience is null or (years_experience >= 0 and years_experience <= 80));

alter table public.competency_tags           enable row level security;
alter table public.team_member_competencies  enable row level security;
alter table public.project_experience         enable row level security;
alter table public.project_experience_tags    enable row level security;

-- Policies use drop-if-exists guards so this file stays idempotent (re-runnable),
-- matching the create-if-not-exists posture of the tables above.
drop policy if exists "competency_tags: read" on public.competency_tags;
create policy "competency_tags: read"
  on public.competency_tags for select to authenticated using (public.is_organization_user());
drop policy if exists "competency_tags: insert" on public.competency_tags;
create policy "competency_tags: insert"
  on public.competency_tags for insert to authenticated
  -- Only admins may mint curated tags (otherwise a user could self-elevate is_curated).
  with check (
    public.is_organization_user()
    and (is_curated = false or public.is_current_user_admin())
  );
drop policy if exists "competency_tags: admin update" on public.competency_tags;
create policy "competency_tags: admin update"
  on public.competency_tags for update to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());
drop policy if exists "competency_tags: admin delete" on public.competency_tags;
create policy "competency_tags: admin delete"
  on public.competency_tags for delete to authenticated
  using (public.is_current_user_admin());

-- Ownership helpers: a profile owns a team_member through immutable profile_id;
-- admins may edit anyone.
-- security definer so the lookups aren't themselves gated by RLS. (See migration for rationale.)
create or replace function public.can_edit_member(p_member_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.id = p_member_id and tm.profile_id = auth.uid()
  ) or public.is_current_user_admin();
$$;

revoke execute on function public.can_edit_member(uuid) from public;
grant execute on function public.can_edit_member(uuid) to authenticated, service_role;

create or replace function public.can_edit_experience(p_experience_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_edit_member(pe.team_member_id)
  from public.project_experience pe
  where pe.id = p_experience_id;
$$;

-- Join/experience tables: organization users read; only the owner/admin writes.
drop policy if exists "team_member_competencies: read"   on public.team_member_competencies;
create policy "team_member_competencies: read"   on public.team_member_competencies for select to authenticated using (public.is_organization_user());
drop policy if exists "team_member_competencies: insert" on public.team_member_competencies;
create policy "team_member_competencies: insert" on public.team_member_competencies for insert to authenticated with check (public.can_edit_member(team_member_id));
drop policy if exists "team_member_competencies: update" on public.team_member_competencies;
create policy "team_member_competencies: update" on public.team_member_competencies for update to authenticated using (public.can_edit_member(team_member_id)) with check (public.can_edit_member(team_member_id));
drop policy if exists "team_member_competencies: delete" on public.team_member_competencies;
create policy "team_member_competencies: delete" on public.team_member_competencies for delete to authenticated using (public.can_edit_member(team_member_id));
drop policy if exists "project_experience: read"   on public.project_experience;
create policy "project_experience: read"   on public.project_experience for select to authenticated using (public.is_organization_user());
drop policy if exists "project_experience: insert" on public.project_experience;
create policy "project_experience: insert" on public.project_experience for insert to authenticated with check (public.can_edit_member(team_member_id));
drop policy if exists "project_experience: update" on public.project_experience;
create policy "project_experience: update" on public.project_experience for update to authenticated using (public.can_edit_member(team_member_id)) with check (public.can_edit_member(team_member_id));
drop policy if exists "project_experience: delete" on public.project_experience;
create policy "project_experience: delete" on public.project_experience for delete to authenticated using (public.can_edit_member(team_member_id));
drop policy if exists "project_experience_tags: read"   on public.project_experience_tags;
create policy "project_experience_tags: read"   on public.project_experience_tags for select to authenticated using (public.is_organization_user());
drop policy if exists "project_experience_tags: insert" on public.project_experience_tags;
create policy "project_experience_tags: insert" on public.project_experience_tags for insert to authenticated with check (public.can_edit_experience(experience_id));
drop policy if exists "project_experience_tags: update" on public.project_experience_tags;
create policy "project_experience_tags: update" on public.project_experience_tags for update to authenticated using (public.can_edit_experience(experience_id)) with check (public.can_edit_experience(experience_id));
drop policy if exists "project_experience_tags: delete" on public.project_experience_tags;
create policy "project_experience_tags: delete" on public.project_experience_tags for delete to authenticated using (public.can_edit_experience(experience_id));

create or replace function public.search_experts(
  p_skill_slugs text[] default '{}',
  p_tech_slugs  text[] default '{}',
  p_query       text    default null
)
returns table (team_member_id uuid, full_name text, email text, role text, score numeric, matched jsonb)
language sql stable security invoker set search_path = public
as $$
  with q as (
    -- OR tsquery so ANY brief word can match (plainto_tsquery ANDs them). 'simple' =
    -- no stemming; proper Polish stemming needs a dedicated dictionary (tracked separately).
    select to_tsquery('simple', string_agg(tok, ' | ')) as query
    from (
      select regexp_replace(lower(w), '[^a-z0-9ąćęłńóśźż]+', '', 'g') as tok
      from unnest(regexp_split_to_array(coalesce(p_query, ''), '\s+')) as w
    ) tokens
    where tok <> ''
  ),
  wanted as (
    select distinct slug, kind from (
      select unnest(coalesce(p_skill_slugs, '{}')) as slug, 'skill'::text      as kind
      union all
      select unnest(coalesce(p_tech_slugs,  '{}')) as slug, 'technology'::text as kind
    ) s
    where slug is not null and slug <> ''
  ),
  tag_hits as (
    -- Match wanted slugs on own competencies AND on project-experience tags (union dedups).
    select tmc.team_member_id, ct.kind, ct.name, ct.slug
    from public.team_member_competencies tmc
    join public.competency_tags ct on ct.id = tmc.competency_tag_id
    join wanted w on w.slug = ct.slug and w.kind = ct.kind
    union
    select pe.team_member_id, ct.kind, ct.name, ct.slug
    from public.project_experience pe
    join public.project_experience_tags pet on pet.experience_id = pe.id
    join public.competency_tags ct on ct.id = pet.competency_tag_id
    join wanted w on w.slug = ct.slug and w.kind = ct.kind
  ),
  agg_tags as (
    select team_member_id, count(*)::numeric as tag_count,
           jsonb_agg(jsonb_build_object('kind', kind, 'name', name, 'slug', slug)) as tags
    from tag_hits group by team_member_id
  ),
  exp_hits as (
    select pe.team_member_id,
           sum(ts_rank(pe.search_tsv, (select query from q)))::numeric as rank,
           jsonb_agg(jsonb_build_object('id', pe.id, 'title', pe.title, 'role', pe.role)) as experiences
    from public.project_experience pe
    where (select query from q) is not null and pe.search_tsv @@ (select query from q)
    group by pe.team_member_id
  ),
  combined as (
    -- score = (# matching tags) + (full-text rank × 10). ts_rank is tiny (~0.05–0.1),
    -- so the weight keeps a strong experience match on par with one matching tag.
    select tm.id as team_member_id, tm.full_name, tm.email, tm.role,
           coalesce(at.tag_count, 0) + coalesce(eh.rank, 0) * 10 as score,
           jsonb_build_object('skills_technologies', coalesce(at.tags, '[]'::jsonb),
                              'experience', coalesce(eh.experiences, '[]'::jsonb)) as matched
    from public.team_members tm
    left join agg_tags at on at.team_member_id = tm.id
    left join exp_hits eh on eh.team_member_id = tm.id
  )
  select team_member_id, full_name, email, role, score, matched
  from combined where score > 0 order by score desc, full_name asc;
$$;

-- Revoke the implicit PUBLIC execute so anon can't bypass the API-key check.
revoke execute on function public.search_experts(text[], text[], text) from public;
grant execute on function public.search_experts(text[], text[], text) to authenticated, service_role;

-- Atomic save of a project-experience row + its technology tags (one transaction).
-- security invoker so RLS ownership applies to every write. Returns the row id.
create or replace function public.save_project_experience(
  p_experience_id uuid,
  p_member_id     uuid,
  p_title         text,
  p_role          text,
  p_description   text,
  p_start_date    date,
  p_end_date      date,
  p_tag_ids       uuid[] default '{}'
)
returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_experience_id is null then
    insert into public.project_experience (team_member_id, title, role, description, start_date, end_date)
    values (p_member_id, p_title, p_role, p_description, p_start_date, p_end_date)
    returning id into v_id;
  else
    update public.project_experience
       set title = p_title, role = p_role, description = p_description,
           start_date = p_start_date, end_date = p_end_date
     where id = p_experience_id
    returning id into v_id;
    if v_id is null then
      raise exception 'project_experience % not found', p_experience_id;
    end if;
  end if;

  delete from public.project_experience_tags where experience_id = v_id;
  if array_length(p_tag_ids, 1) is not null then
    insert into public.project_experience_tags (experience_id, competency_tag_id)
    select v_id, unnest(p_tag_ids)
    on conflict do nothing;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.save_project_experience(uuid, uuid, text, text, text, date, date, uuid[]) from public;
grant execute on function public.save_project_experience(uuid, uuid, text, text, text, date, date, uuid[]) to authenticated;
