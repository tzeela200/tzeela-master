-- =====================================================================
-- צאלה — Migration 0002: skills registry, canonical agents, teams,
-- niches & projects, tasks, activity log
-- Run once in Supabase Dashboard → SQL Editor (project: tzeela master)
-- Additive only: no drops of tables/columns, no data changes to existing rows.
-- Safe to re-run.
-- Requires 0001_init.sql (public.is_owner, agents, sessions).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guard: a different "skills" table (e.g. from an external seed script)
-- would silently break this migration. Stop with a clear message instead.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'skills' and column_name = 'parent_folder'
  ) then
    raise exception 'public.skills already exists with a different structure (parent_folder column). Rename or drop it before running 0002.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Skill taxonomy: 14 parent folders + subfolders (catalog only, not niches)
-- id = folder key ("01_…") or "<parent key>/<Subfolder_Key>"
-- ---------------------------------------------------------------------
create table if not exists public.skill_folders (
  id                 text primary key,
  parent_id          text null references public.skill_folders (id) on delete cascade,
  key                text not null,
  code               text null,
  name_he            text not null default '',
  description        text not null default '',
  default_agent_slug text null,
  sort               int  not null default 0
);
create index if not exists skill_folders_parent_idx on public.skill_folders (parent_id, sort);

-- ---------------------------------------------------------------------
-- Skills catalog. id = canonical slug.
-- availability_status separates "documented" from "actually runnable".
-- ---------------------------------------------------------------------
create table if not exists public.skills (
  id                  text primary key,
  name_he             text not null default '',
  name_en             text not null default '',
  aliases             text[] not null default '{}',
  description         text not null default '',
  instructions        text not null default '',
  when_to_use         text not null default '',
  when_not_to_use     text not null default '',
  input_schema        jsonb null,
  output_schema       jsonb null,
  reliability_score   int  null,
  version             text null,
  source_url          text not null default '',
  sources             text[] not null default '{}',
  review_refs         text[] not null default '{}',
  is_pack             boolean not null default false,
  pack_size           int  null,
  runtime             text not null default 'guidance',
  availability_status text not null default 'documented',
  mapping_conflict    text not null default '',
  is_enabled          boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint skills_runtime_chk check (runtime in ('guidance', 'code_tool', 'none')),
  constraint skills_status_chk  check (availability_status in
    ('documented', 'linked', 'instructions_available', 'imported', 'loadable', 'verified', 'disabled'))
);
create index if not exists skills_status_idx on public.skills (availability_status);
create index if not exists skills_search_idx on public.skills
  using gin (to_tsvector('simple', id || ' ' || name_he || ' ' || name_en || ' ' || description || ' ' || when_to_use));

drop trigger if exists skills_touch_updated_at on public.skills;
create trigger skills_touch_updated_at
  before update on public.skills
  for each row execute function public.touch_updated_at();

-- skill ↔ folder (a skill can live in several subfolders)
create table if not exists public.skill_folder_links (
  skill_id    text not null references public.skills (id) on delete cascade,
  folder_id   text not null references public.skill_folders (id) on delete cascade,
  source      text not null default '',
  raw_mapping text not null default '',
  primary key (skill_id, folder_id)
);
create index if not exists skill_folder_links_folder_idx on public.skill_folder_links (folder_id);

-- ---------------------------------------------------------------------
-- Agents: canonical slug + type. Existing agents stay 'custom'.
-- ---------------------------------------------------------------------
alter table public.agents add column if not exists slug       text null;
alter table public.agents add column if not exists agent_type text not null default 'custom';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agents_type_chk') then
    alter table public.agents
      add constraint agents_type_chk check (agent_type in ('master', 'core', 'domain', 'custom'));
  end if;
end $$;
create unique index if not exists agents_slug_uidx on public.agents (slug) where slug is not null;

create table if not exists public.agent_skills (
  agent_id   uuid not null references public.agents (id) on delete cascade,
  skill_id   text not null references public.skills (id) on delete cascade,
  is_active  boolean not null default true,
  source     text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now(),
  primary key (agent_id, skill_id)
);
create index if not exists agent_skills_skill_idx on public.agent_skills (skill_id);

-- ---------------------------------------------------------------------
-- Expert teams: roles pulled in dynamically, not extra fixed agents.
-- owner_agent_id null = "separate home" (waiting for assignment)
-- ---------------------------------------------------------------------
create table if not exists public.agent_teams (
  id             text primary key,
  name_he        text not null,
  owner_agent_id uuid null references public.agents (id) on delete set null,
  folder_id      text null references public.skill_folders (id) on delete set null,
  source         text not null default '',
  sort           int  not null default 0
);

create table if not exists public.team_roles (
  id          text primary key,
  team_id     text not null references public.agent_teams (id) on delete cascade,
  name_he     text not null,
  role_prompt text not null default '',
  skill_ids   text[] not null default '{}',
  sort        int  not null default 0
);
create index if not exists team_roles_team_idx on public.team_roles (team_id, sort);

-- ---------------------------------------------------------------------
-- Niches (user-created life/work areas) and projects
-- ---------------------------------------------------------------------
create table if not exists public.niches (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid null references public.niches (id) on delete cascade,
  name        text not null,
  description text not null default '',
  color       text null,
  icon        text null,
  pinned      boolean not null default false,
  sort        int  not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint niches_name_len check (char_length(btrim(name)) between 1 and 60)
);
create index if not exists niches_parent_idx on public.niches (parent_id, sort);

drop trigger if exists niches_touch_updated_at on public.niches;
create trigger niches_touch_updated_at
  before update on public.niches
  for each row execute function public.touch_updated_at();

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  niche_id    uuid not null references public.niches (id) on delete cascade,
  name        text not null,
  description text not null default '',
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint projects_name_len   check (char_length(btrim(name)) between 1 and 80),
  constraint projects_status_chk check (status in ('active', 'paused', 'done', 'archived'))
);
create index if not exists projects_niche_idx on public.projects (niche_id, created_at desc);

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

create table if not exists public.agent_niches (
  agent_id uuid not null references public.agents (id) on delete cascade,
  niche_id uuid not null references public.niches (id) on delete cascade,
  primary key (agent_id, niche_id)
);

-- threads can belong to a niche / project (optional)
alter table public.sessions add column if not exists niche_id   uuid null references public.niches (id)   on delete set null;
alter table public.sessions add column if not exists project_id uuid null references public.projects (id) on delete set null;
create index if not exists sessions_niche_idx on public.sessions (niche_id, updated_at desc);

-- ---------------------------------------------------------------------
-- Open tasks (simple now; workflow sub-tasks extend this later)
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  niche_id    uuid null references public.niches (id)   on delete set null,
  project_id  uuid null references public.projects (id) on delete set null,
  agent_id    uuid null references public.agents (id)   on delete set null,
  status      text not null default 'open',
  source      text not null default 'user',
  due_at      timestamptz null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tasks_title_len  check (char_length(btrim(title)) between 1 and 200),
  constraint tasks_status_chk check (status in ('open', 'queued', 'running', 'waiting', 'failed', 'done', 'cancelled'))
);
create index if not exists tasks_niche_status_idx on public.tasks (niche_id, status, updated_at desc);

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Activity log: what the user did vs. what agents did (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  actor       text not null,
  agent_id    uuid null references public.agents (id)   on delete set null,
  action      text not null,
  entity_type text not null default '',
  entity_id   text null,
  title       text not null default '',
  niche_id    uuid null references public.niches (id)   on delete set null,
  project_id  uuid null references public.projects (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint activity_actor_chk check (actor in ('user', 'agent', 'system'))
);
create index if not exists activity_created_idx on public.activity_log (created_at desc);
create index if not exists activity_niche_idx   on public.activity_log (niche_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS: owner only, same as 0001
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'skill_folders', 'skills', 'skill_folder_links', 'agent_skills', 'agent_teams', 'team_roles',
    'niches', 'projects', 'agent_niches', 'tasks', 'activity_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()))',
      t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- activity_log is append-only for the app
revoke update, delete on public.activity_log from authenticated;
