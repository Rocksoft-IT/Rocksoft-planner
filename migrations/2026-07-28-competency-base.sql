-- ============================================================
-- Competency base — skills / technologies / project experience
-- change: competency-database (PR 1 — base + API)
--
-- WHY: central, searchable registry of employee competencies so teams
--   can be staffed by skill/tech/experience, and an external API + MCP
--   can recommend experts from a project description.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run.
--   Idempotent: safe to run more than once.
--
-- NOTES:
--   * People live in public.team_members (the full directory, 23 rows);
--     public.profiles is only the subset with logins (auth.users). So
--     competencies reference team_members(id). "Who edited" is stamped
--     into created_by/updated_by (→ profiles(id)) via a trigger, matching
--     the existing set_allocation_actor() pattern.
--   * RLS matches the app's existing posture: any authenticated user may
--     read/write (internal tool). Catalog edits (update/delete of tags)
--     are gated on profiles.is_admin. The public API bypasses RLS via the
--     service-role key and is guarded by its own API-key check in-app.
-- ============================================================

-- ---------- Tables ----------

-- Unified catalog of skills and technologies (hybrid: curated + user-added).
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

-- M:N — a team member has skills/technologies, with optional proficiency.
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

-- Per-employee project experience (internal projects or external/pre-system work).
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

-- M:N — tag a project-experience entry with the technologies/skills it used,
-- so experience is searchable by tech (e.g. "Three.js" → 3D configurator work).
create table if not exists public.project_experience_tags (
  experience_id     uuid not null references public.project_experience(id) on delete cascade,
  competency_tag_id uuid not null references public.competency_tags(id) on delete cascade,
  constraint project_experience_tags_pkey primary key (experience_id, competency_tag_id)
);

-- ---------- Actor-stamping trigger (clone of set_allocation_actor) ----------
-- Stamps created_by/updated_by from the authenticated user; the profiles
-- lookup guards the FK (valid profile id or NULL, never a dangling id).
-- Reused across all three audited competency tables.
create or replace function public.set_competency_actor()
returns trigger language plpgsql security definer set search_path = public as $$
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

-- ---------- Indexes ----------
create extension if not exists pg_trgm;

create index if not exists competency_tags_slug_idx on public.competency_tags(slug);
create index if not exists competency_tags_name_trgm_idx on public.competency_tags using gin (name gin_trgm_ops);
create index if not exists tmc_team_member_idx on public.team_member_competencies(team_member_id);
create index if not exists tmc_tag_idx on public.team_member_competencies(competency_tag_id);
create index if not exists project_experience_member_idx on public.project_experience(team_member_id);
create index if not exists project_experience_tsv_idx on public.project_experience using gin (search_tsv);
create index if not exists pet_tag_idx on public.project_experience_tags(competency_tag_id);

-- ---------- Row Level Security ----------
alter table public.competency_tags           enable row level security;
alter table public.team_member_competencies  enable row level security;
alter table public.project_experience         enable row level security;
alter table public.project_experience_tags    enable row level security;

-- competency_tags: everyone reads; authenticated may add tags; only admins edit/remove.
drop policy if exists "competency_tags: read" on public.competency_tags;
create policy "competency_tags: read"
  on public.competency_tags for select to authenticated using (true);

drop policy if exists "competency_tags: insert" on public.competency_tags;
create policy "competency_tags: insert"
  on public.competency_tags for insert to authenticated with check (true);

drop policy if exists "competency_tags: admin update" on public.competency_tags;
create policy "competency_tags: admin update"
  on public.competency_tags for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "competency_tags: admin delete" on public.competency_tags;
create policy "competency_tags: admin delete"
  on public.competency_tags for delete to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- team_member_competencies / project_experience / _tags: broad authenticated CRUD
-- (matches projects/allocations posture; self-service scoping is done in the UI).
do $$
declare t text;
begin
  foreach t in array array['team_member_competencies','project_experience','project_experience_tags']
  loop
    execute format('drop policy if exists "%s: read" on public.%s', t, t);
    execute format('create policy "%s: read" on public.%s for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s: insert" on public.%s', t, t);
    execute format('create policy "%s: insert" on public.%s for insert to authenticated with check (true)', t, t);
    execute format('drop policy if exists "%s: update" on public.%s', t, t);
    execute format('create policy "%s: update" on public.%s for update to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s: delete" on public.%s', t, t);
    execute format('create policy "%s: delete" on public.%s for delete to authenticated using (true)', t, t);
  end loop;
end $$;

-- ---------- Search function ----------
-- Ranks team members by (# matching skill/tech tags) + (full-text rank of their
-- project experience against a free-text query). Callable via PostgREST rpc from
-- the web app (as the authenticated user, RLS applies) and from the API/MCP (via
-- service role). Any of the three arguments may be empty/null.
create or replace function public.search_experts(
  p_skill_slugs text[] default '{}',
  p_tech_slugs  text[] default '{}',
  p_query       text    default null
)
returns table (
  team_member_id uuid,
  full_name      text,
  email          text,
  role           text,
  score          numeric,
  matched        jsonb
)
language sql
stable
security invoker
set search_path = public
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
    select team_member_id,
           count(*)::numeric as tag_count,
           jsonb_agg(jsonb_build_object('kind', kind, 'name', name, 'slug', slug)) as tags
    from tag_hits
    group by team_member_id
  ),
  exp_hits as (
    select pe.team_member_id,
           sum(ts_rank(pe.search_tsv, plainto_tsquery('simple', p_query)))::numeric as rank,
           jsonb_agg(jsonb_build_object('id', pe.id, 'title', pe.title, 'role', pe.role)) as experiences
    from public.project_experience pe
    where p_query is not null and p_query <> ''
      and pe.search_tsv @@ plainto_tsquery('simple', p_query)
    group by pe.team_member_id
  ),
  combined as (
    -- score = (# matching skill/tech tags) + (weighted full-text rank).
    -- ts_rank returns tiny values (~0.05–0.1), so without a weight a text match
    -- would be dwarfed by a single tag. The 10× weight makes a strong experience
    -- match worth roughly one matching tag.
    select tm.id as team_member_id, tm.full_name, tm.email, tm.role,
           coalesce(at.tag_count, 0) + coalesce(eh.rank, 0) * 10 as score,
           jsonb_build_object(
             'skills_technologies', coalesce(at.tags, '[]'::jsonb),
             'experience',          coalesce(eh.experiences, '[]'::jsonb)
           ) as matched
    from public.team_members tm
    left join agg_tags at on at.team_member_id = tm.id
    left join exp_hits eh on eh.team_member_id = tm.id
  )
  select team_member_id, full_name, email, role, score, matched
  from combined
  where score > 0
  order by score desc, full_name asc;
$$;

grant execute on function public.search_experts(text[], text[], text) to authenticated;

-- ---------- Seed: curated catalog (safe to re-run) ----------
insert into public.competency_tags (kind, name, slug, is_curated) values
  ('skill','Frontend Development','frontend-development',true),
  ('skill','Backend Development','backend-development',true),
  ('skill','Full-stack Development','full-stack-development',true),
  ('skill','Mobile Development','mobile-development',true),
  ('skill','DevOps','devops',true),
  ('skill','UI/UX Design','ui-ux-design',true),
  ('skill','Project Management','project-management',true),
  ('skill','QA / Testing','qa-testing',true),
  ('skill','Data / AI','data-ai',true),
  ('skill','Solution Architecture','solution-architecture',true),
  ('skill','3D / WebGL','3d-webgl',true),
  ('technology','React','react',true),
  ('technology','Next.js','next-js',true),
  ('technology','TypeScript','typescript',true),
  ('technology','JavaScript','javascript',true),
  ('technology','Node.js','node-js',true),
  ('technology','PostgreSQL','postgresql',true),
  ('technology','Supabase','supabase',true),
  ('technology','Python','python',true),
  ('technology','Three.js','three-js',true),
  ('technology','WebGL','webgl',true),
  ('technology','React Native','react-native',true),
  ('technology','Docker','docker',true),
  ('technology','AWS','aws',true),
  ('technology','PHP','php',true),
  ('technology','Laravel','laravel',true),
  ('technology','WordPress','wordpress',true)
on conflict (kind, slug) do nothing;
