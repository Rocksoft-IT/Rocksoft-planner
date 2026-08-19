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
-- so author tracking is reliable even when the client doesn't send the id, and
-- cannot be forged when it does. RLS lets any authenticated user insert any
-- allocation row, so these columns are assigned rather than defaulted.
-- SECURITY DEFINER keeps the profiles lookup working however the profiles
-- SELECT policy is scoped.
create or replace function public.set_allocation_actor()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  -- Guards the FK: a valid profile id, or NULL — never an id absent from profiles.
  actor uuid := (select id from public.profiles where id = auth.uid());
begin
  if (tg_op = 'INSERT') then
    new.created_by := actor;
    new.updated_by := actor;
  elsif (tg_op = 'UPDATE') then
    -- The author does not change when someone else edits the allocation.
    new.created_by := old.created_by;
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
