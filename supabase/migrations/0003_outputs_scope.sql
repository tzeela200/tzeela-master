-- =====================================================================
-- צאלה — Migration 0003: outputs know their thread, niche and project
-- Run once in Supabase Dashboard → SQL Editor, after 0002. Additive, safe to re-run.
-- =====================================================================

alter table public.agent_outputs add column if not exists session_id uuid null references public.sessions (id) on delete set null;
alter table public.agent_outputs add column if not exists niche_id   uuid null references public.niches (id)   on delete set null;
alter table public.agent_outputs add column if not exists project_id uuid null references public.projects (id) on delete set null;

create index if not exists agent_outputs_niche_idx   on public.agent_outputs (niche_id, created_at desc);
create index if not exists agent_outputs_project_idx on public.agent_outputs (project_id, created_at desc);

-- Existing outputs inherit the niche/project of their thread when it has one (no-op today).
update public.agent_outputs o
set niche_id = s.niche_id, project_id = s.project_id
from public.sessions s
where o.session_id = s.id and o.niche_id is null and s.niche_id is not null;
