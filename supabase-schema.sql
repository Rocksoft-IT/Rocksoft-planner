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

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, avatar_color)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', ''),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#6366f1')
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
  person_id     uuid not null references public.profiles(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  start_date    date not null,
  end_date      date not null,
  hours_per_day numeric(4,1) not null default 8,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  updated_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint valid_date_range check (end_date >= start_date)
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
    new.created_by := coalesce(new.created_by, actor);
    new.updated_by := coalesce(new.updated_by, actor);
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

-- 4. ROW LEVEL SECURITY

alter table public.profiles  enable row level security;
alter table public.projects   enable row level security;
alter table public.allocations enable row level security;

-- Profiles: authenticated users can read all, update own
create policy "profiles: authenticated read all"
  on public.profiles for select to authenticated using (true);

create policy "profiles: update own"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Admins can update any profile
create policy "profiles: admin update all"
  on public.profiles for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Projects: authenticated users can read/write all
create policy "projects: authenticated read"
  on public.projects for select to authenticated using (true);

create policy "projects: authenticated insert"
  on public.projects for insert to authenticated with check (true);

create policy "projects: authenticated update"
  on public.projects for update to authenticated using (true);

create policy "projects: authenticated delete"
  on public.projects for delete to authenticated using (true);

-- Allocations: authenticated users can read/write all
create policy "allocations: authenticated read"
  on public.allocations for select to authenticated using (true);

create policy "allocations: authenticated insert"
  on public.allocations for insert to authenticated with check (true);

create policy "allocations: authenticated update"
  on public.allocations for update to authenticated using (true);

create policy "allocations: authenticated delete"
  on public.allocations for delete to authenticated using (true);

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
returns trigger language plpgsql as $$
declare
  actor uuid := (select id from public.profiles where id = auth.uid());
begin
  if (tg_op = 'INSERT') then
    new.created_by := coalesce(new.created_by, actor);
    new.updated_by := coalesce(new.updated_by, actor);
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

alter table public.competency_tags           enable row level security;
alter table public.team_member_competencies  enable row level security;
alter table public.project_experience         enable row level security;
alter table public.project_experience_tags    enable row level security;

create policy "competency_tags: read"
  on public.competency_tags for select to authenticated using (true);
create policy "competency_tags: insert"
  on public.competency_tags for insert to authenticated with check (true);
create policy "competency_tags: admin update"
  on public.competency_tags for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
create policy "competency_tags: admin delete"
  on public.competency_tags for delete to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Broad authenticated CRUD for the join/experience tables (see migration for the DO-block form).
create policy "team_member_competencies: read"   on public.team_member_competencies for select to authenticated using (true);
create policy "team_member_competencies: insert" on public.team_member_competencies for insert to authenticated with check (true);
create policy "team_member_competencies: update" on public.team_member_competencies for update to authenticated using (true);
create policy "team_member_competencies: delete" on public.team_member_competencies for delete to authenticated using (true);
create policy "project_experience: read"   on public.project_experience for select to authenticated using (true);
create policy "project_experience: insert" on public.project_experience for insert to authenticated with check (true);
create policy "project_experience: update" on public.project_experience for update to authenticated using (true);
create policy "project_experience: delete" on public.project_experience for delete to authenticated using (true);
create policy "project_experience_tags: read"   on public.project_experience_tags for select to authenticated using (true);
create policy "project_experience_tags: insert" on public.project_experience_tags for insert to authenticated with check (true);
create policy "project_experience_tags: update" on public.project_experience_tags for update to authenticated using (true);
create policy "project_experience_tags: delete" on public.project_experience_tags for delete to authenticated using (true);

create or replace function public.search_experts(
  p_skill_slugs text[] default '{}',
  p_tech_slugs  text[] default '{}',
  p_query       text    default null
)
returns table (team_member_id uuid, full_name text, email text, role text, score numeric, matched jsonb)
language sql stable security invoker set search_path = public
as $$
  with wanted as (
    select distinct slug, kind from (
      select unnest(coalesce(p_skill_slugs, '{}')) as slug, 'skill'::text      as kind
      union all
      select unnest(coalesce(p_tech_slugs,  '{}')) as slug, 'technology'::text as kind
    ) s
    where slug is not null and slug <> ''
  ),
  tag_hits as (
    select tmc.team_member_id, ct.kind, ct.name, ct.slug
    from public.team_member_competencies tmc
    join public.competency_tags ct on ct.id = tmc.competency_tag_id
    join wanted w on w.slug = ct.slug and w.kind = ct.kind
  ),
  agg_tags as (
    select team_member_id, count(*)::numeric as tag_count,
           jsonb_agg(jsonb_build_object('kind', kind, 'name', name, 'slug', slug)) as tags
    from tag_hits group by team_member_id
  ),
  exp_hits as (
    select pe.team_member_id,
           sum(ts_rank(pe.search_tsv, plainto_tsquery('simple', p_query)))::numeric as rank,
           jsonb_agg(jsonb_build_object('id', pe.id, 'title', pe.title, 'role', pe.role)) as experiences
    from public.project_experience pe
    where p_query is not null and p_query <> '' and pe.search_tsv @@ plainto_tsquery('simple', p_query)
    group by pe.team_member_id
  ),
  combined as (
    select tm.id as team_member_id, tm.full_name, tm.email, tm.role,
           coalesce(at.tag_count, 0) + coalesce(eh.rank, 0) as score,
           jsonb_build_object('skills_technologies', coalesce(at.tags, '[]'::jsonb),
                              'experience', coalesce(eh.experiences, '[]'::jsonb)) as matched
    from public.team_members tm
    left join agg_tags at on at.team_member_id = tm.id
    left join exp_hits eh on eh.team_member_id = tm.id
  )
  select team_member_id, full_name, email, role, score, matched
  from combined where score > 0 order by score desc, full_name asc;
$$;

grant execute on function public.search_experts(text[], text[], text) to authenticated;
