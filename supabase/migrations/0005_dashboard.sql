-- =====================================================================
-- 0005_dashboard.sql — דשבורד המאסטר (חלק ב')
-- 10 טבלאות חדשות + שדות תבנית המשימה + חיפוש בעברית.
-- לא נוגע ב: skills, skill_folders, skill_folder_links, agents,
--             agent_skills, agent_teams, agent_niches, niches.
-- =====================================================================

-- ---------------------------------------------------------------------
-- חיפוש בעברית
-- unaccent לבדה אינה מסירה ניקוד עברי (נבדק: שָׁלוֹם נשאר באורך 7).
-- he_normalize מסירה ניקוד וטעמים (U+0591..U+05C7) וגם סימנים לטיניים.
-- ---------------------------------------------------------------------
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.he_normalize(t text) returns text
language sql immutable parallel safe strict as $fn$
  select regexp_replace(
           extensions.unaccent('extensions.unaccent', t),
           '[֑-ׇ]', '', 'g')
$fn$;

-- ---------------------------------------------------------------------
-- רכיבים 1-2 · סטטוס תפעולי ושלב נוכחי
-- ---------------------------------------------------------------------
create table if not exists public.niche_status (
  niche_id    uuid primary key references public.niches (id) on delete cascade,
  health      text not null default 'unknown'
              check (health in ('ok','warn','down','unknown')),
  checked_at  timestamptz null,
  done_text   text not null default '',
  doing_text  text not null default '',
  todo_text   text not null default '',
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- רכיב 3 · כפתור סנכרון תמונת מצב
-- ---------------------------------------------------------------------
create table if not exists public.niche_snapshots (
  id          uuid primary key default gen_random_uuid(),
  niche_id    uuid not null references public.niches (id) on delete cascade,
  summary     text not null default '',
  docs_count  int  not null default 0,
  notes_count int  not null default 0,
  tasks_done  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists niche_snapshots_niche_idx
  on public.niche_snapshots (niche_id, created_at desc);

-- ---------------------------------------------------------------------
-- רכיב 4 · קישורים ישירים למערכות חיות
-- ---------------------------------------------------------------------
create table if not exists public.niche_links (
  id         uuid primary key default gen_random_uuid(),
  niche_id   uuid not null references public.niches (id) on delete cascade,
  label      text not null,
  url        text not null,
  kind       text not null default 'app',
             -- app | db | admin | docs | external
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists niche_links_niche_idx on public.niche_links (niche_id, sort);

-- ---------------------------------------------------------------------
-- רכיבים 5+7 · מאגר מסמכים ואזור גרירה
-- ---------------------------------------------------------------------
create table if not exists public.niche_documents (
  id          uuid primary key default gen_random_uuid(),
  niche_id    uuid not null references public.niches (id) on delete cascade,
  name        text not null,
  file_path   text not null,
  kind        text not null default '',
              -- pdf | docx | xlsx | image | text | other
  size_bytes  bigint not null default 0,
  note        text not null default '',
  excerpt     text not null default '',   -- תקציר טקסט לחיפוש ולזיכרון הנישה
  created_at  timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', public.he_normalize(coalesce(name, ''))), 'A') ||
    setweight(to_tsvector('simple', public.he_normalize(coalesce(note, ''))), 'B') ||
    setweight(to_tsvector('simple', public.he_normalize(coalesce(excerpt, ''))), 'C')
  ) stored
);
create index if not exists niche_documents_niche_idx
  on public.niche_documents (niche_id, created_at desc);
create index if not exists niche_documents_search_idx
  on public.niche_documents using gin (search_vector);
create index if not exists niche_documents_name_trgm_idx
  on public.niche_documents using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- רכיבים 8+9 · הזנה ידנית, קלט קולי, והחלטות
-- ---------------------------------------------------------------------
create table if not exists public.niche_notes (
  id         uuid primary key default gen_random_uuid(),
  niche_id   uuid not null references public.niches (id) on delete cascade,
  kind       text not null default 'note'
             check (kind in ('note','decision','voice')),
  body       text not null default '',
  source     text not null default 'app',   -- app | voice | import
  created_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('simple', public.he_normalize(coalesce(body, '')))
  ) stored
);
create index if not exists niche_notes_niche_idx
  on public.niche_notes (niche_id, created_at desc);
create index if not exists niche_notes_search_idx
  on public.niche_notes using gin (search_vector);

-- ---------------------------------------------------------------------
-- רכיב 10 · כפתורי פעולה מהירה — נתונים ולא קוד,
-- כדי שתבנית החדר תישאר אחת לכל הנישות.
-- ---------------------------------------------------------------------
create table if not exists public.niche_quick_actions (
  id          uuid primary key default gen_random_uuid(),
  niche_id    uuid not null references public.niches (id) on delete cascade,
  label       text not null,
  action_kind text not null default 'link'
              check (action_kind in ('link','prompt','package','skill')),
  target      text not null default '',  -- url / טקסט פרומפט / מזהה חבילה או סקיל
  icon        text not null default '',
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists niche_quick_actions_niche_idx
  on public.niche_quick_actions (niche_id, sort);

-- ---------------------------------------------------------------------
-- מי עובד, מי עושה, מי פועל
-- ---------------------------------------------------------------------
create table if not exists public.niche_performers (
  id         uuid primary key default gen_random_uuid(),
  niche_id   uuid not null references public.niches (id) on delete cascade,
  kind       text not null
             check (kind in ('agent','claude-code','script','person','service')),
  agent_id   uuid null references public.agents (id) on delete set null,
  label      text not null default '',
  role_text  text not null default '',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists niche_performers_niche_idx
  on public.niche_performers (niche_id, is_active);

-- ---------------------------------------------------------------------
-- חבילות סקילים — שרשרת עם שלבים וחלופות
-- ---------------------------------------------------------------------
create table if not exists public.skill_packages (
  id          uuid primary key default gen_random_uuid(),
  name_he     text not null,
  description text not null default '',
  niche_id    uuid null references public.niches (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists skill_packages_niche_idx on public.skill_packages (niche_id);

create table if not exists public.skill_package_items (
  id             uuid primary key default gen_random_uuid(),
  package_id     uuid not null references public.skill_packages (id) on delete cascade,
  skill_id       text not null references public.skills (id) on delete cascade,
  stage          int  not null default 1,
  sort           int  not null default 0,
  is_alternative boolean not null default false,
  note           text not null default ''
);
create index if not exists skill_package_items_pkg_idx
  on public.skill_package_items (package_id, stage, sort);

-- ---------------------------------------------------------------------
-- פנקס ההרצות
-- ---------------------------------------------------------------------
create table if not exists public.runs (
  id            uuid primary key default gen_random_uuid(),
  niche_id      uuid null references public.niches (id) on delete set null,
  package_id    uuid null references public.skill_packages (id) on delete set null,
  skill_id      text null references public.skills (id) on delete set null,
  title         text not null default '',
  performer     text not null default '',
                -- agent | claude-code | script | manual
  environment   text not null default ''
                check (environment in ('','supabase','claude-code','in-app','cloud')),
  status        text not null default 'pending'
                check (status in ('pending','awaiting_approval','running','done','failed','cancelled')),
  estimate_text text not null default '',
  budget_cap    numeric(12,2) null,
  cost          numeric(12,4) null,
  output_text   text not null default '',
  output_path   text not null default '',
  channel       text not null default '',
                -- ChatGPT | Claude Desktop | Claude Code | app
  error_text    text not null default '',
  started_at    timestamptz null,
  finished_at   timestamptz null,
  created_at    timestamptz not null default now()
);
create index if not exists runs_niche_idx  on public.runs (niche_id, created_at desc);
create index if not exists runs_status_idx on public.runs (status) where status in ('awaiting_approval','running');

-- ---------------------------------------------------------------------
-- רכיב 6 · תבנית המשימה — 5 השדות שחסרו
-- ---------------------------------------------------------------------
alter table public.tasks add column if not exists performer      text    not null default '';
alter table public.tasks add column if not exists prerequisites  text    not null default '';
alter table public.tasks add column if not exists estimate_text  text    not null default '';
alter table public.tasks add column if not exists budget_cap     numeric(12,2) null;
alter table public.tasks add column if not exists deliverable    text    not null default '';
alter table public.tasks add column if not exists needs_approval boolean not null default false;

-- ---------------------------------------------------------------------
-- רכיב 13 · ערוץ המקור ביומן (ChatGPT / Claude Desktop / Claude Code)
-- ---------------------------------------------------------------------
alter table public.activity_log add column if not exists channel text not null default '';

-- ---------------------------------------------------------------------
-- הרשאות — אותה תבנית בדיוק של 14 הטבלאות הקיימות
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'niche_status','niche_snapshots','niche_links','niche_documents',
    'niche_notes','niche_quick_actions','niche_performers',
    'skill_packages','skill_package_items','runs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all using ((select public.is_owner())) with check ((select public.is_owner()))', t);
  end loop;
end $$;
