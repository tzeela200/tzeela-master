-- =====================================================================
-- צאלה — Migration 0001: schema, RLS, storage
-- Run once in Supabase Dashboard → SQL Editor (project: tzeela master)
-- Idempotent where practical, safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Owner check: the single authorized user.
-- Defense in depth on top of "signups disabled". Change the email here
-- (and re-run this function) if the login email ever changes.
-- ---------------------------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'tzeela200@gmail.com';
$$;

-- ---------------------------------------------------------------------
-- agents
-- ---------------------------------------------------------------------
create table if not exists public.agents (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  description        text not null,
  icon               text null,
  system_prompt      text not null,
  category           text not null,
  is_master          boolean not null default false,
  is_image_generator boolean not null default false,
  is_favorite        boolean not null default false,
  created_at         timestamptz not null default now(),
  constraint agents_name_len          check (char_length(btrim(name)) between 2 and 60),
  constraint agents_description_len   check (char_length(description) <= 180),
  constraint agents_system_prompt_len check (char_length(btrim(system_prompt)) >= 30),
  constraint agents_category_nonempty check (char_length(btrim(category)) > 0)
);

create index if not exists agents_category_idx    on public.agents (category);
create index if not exists agents_is_favorite_idx on public.agents (is_favorite);
create index if not exists agents_created_at_idx  on public.agents (created_at desc);

-- ---------------------------------------------------------------------
-- sessions (threads)
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references public.agents (id) on delete cascade,
  title      text null,
  messages   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint sessions_messages_is_array check (jsonb_typeof(messages) = 'array')
);

create index if not exists sessions_agent_updated_idx on public.sessions (agent_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sessions_touch_updated_at on public.sessions;
create trigger sessions_touch_updated_at
  before update on public.sessions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- agent_outputs
-- ---------------------------------------------------------------------
create table if not exists public.agent_outputs (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.agents (id) on delete cascade,
  category     text not null,
  output_type  text not null,
  summary_text text not null,
  file_url     text null,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  constraint agent_outputs_status_chk check (status in ('pending', 'review', 'done')),
  constraint agent_outputs_type_chk   check (output_type in ('text', 'pdf', 'docx', 'xlsx', 'csv', 'image'))
);

create index if not exists agent_outputs_agent_created_idx on public.agent_outputs (agent_id, created_at desc);
create index if not exists agent_outputs_category_idx      on public.agent_outputs (category);
create index if not exists agent_outputs_status_idx        on public.agent_outputs (status);

-- ---------------------------------------------------------------------
-- RLS: only the authenticated owner. No roles.
-- ---------------------------------------------------------------------
alter table public.agents        enable row level security;
alter table public.sessions      enable row level security;
alter table public.agent_outputs enable row level security;

drop policy if exists owner_all on public.agents;
create policy owner_all on public.agents
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

drop policy if exists owner_all on public.sessions;
create policy owner_all on public.sessions
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

drop policy if exists owner_all on public.agent_outputs;
create policy owner_all on public.agent_outputs
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- anon gets nothing
revoke all on public.agents, public.sessions, public.agent_outputs from anon;

-- ---------------------------------------------------------------------
-- Storage: private buckets, 20MB per file
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('uploads', 'uploads', false, 20971520),
  ('outputs', 'outputs', false, 20971520)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists tzeela_owner_objects on storage.objects;
create policy tzeela_owner_objects on storage.objects
  for all to authenticated
  using (bucket_id in ('uploads', 'outputs') and (select public.is_owner()))
  with check (bucket_id in ('uploads', 'outputs') and (select public.is_owner()));
