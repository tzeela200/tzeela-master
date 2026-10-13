import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Agent } from "@/lib/types";
import { listNiches, type Niche, type Project } from "@/lib/niches";
import { NicheDetail, type NicheThread, type NicheOutput, type NicheTask, type NicheActivity } from "@/components/niches/NicheDetail";

const rel = (r: unknown) => (Array.isArray(r) ? r[0] : r) as { name?: string } | null;

export default async function NichePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const all = await listNiches(supabase, { includeArchived: true });
  const niche = all.find((n) => n.id === id);
  if (!niche) notFound();

  // A parent niche shows the work of its sub-niches too.
  const children = all.filter((n) => n.parent_id === id && !n.archived);
  const scopeIds = [id, ...children.map((c) => c.id)];

  const [projectsRes, sessionsRes, outputsRes, tasksRes, activityRes, agentsRes] = await Promise.all([
    supabase.from("projects").select("*").in("niche_id", scopeIds).order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select("id, title, agent_id, niche_id, project_id, updated_at, agents(name)")
      .in("niche_id", scopeIds)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("agent_outputs")
      .select("id, summary_text, output_type, status, project_id, created_at, agents(name)")
      .in("niche_id", scopeIds)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("tasks")
      .select("id, title, status, project_id, updated_at")
      .in("niche_id", scopeIds)
      .not("status", "in", "(done,cancelled)")
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("activity_log")
      .select("id, actor, title, created_at")
      .in("niche_id", scopeIds)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("agents").select("*").order("name"),
  ]);

  const threads: NicheThread[] = (sessionsRes.data ?? []).map((s) => ({
    id: s.id,
    title: s.title || "נושא ללא כותרת",
    agentId: s.agent_id,
    agentName: rel(s.agents)?.name ?? "",
    projectId: s.project_id,
    updatedAt: s.updated_at,
  }));
  // outputsRes fails (undefined column) until migration 0003 runs — the page still works.
  const outputs: NicheOutput[] = (outputsRes.error ? [] : (outputsRes.data ?? [])).map((o) => ({
    id: o.id,
    summary: o.summary_text,
    status: o.status,
    projectId: o.project_id,
    agentName: rel(o.agents)?.name ?? "",
    createdAt: o.created_at,
  }));

  return (
    <NicheDetail
      key={niche.id}
      niche={niche as Niche}
      niches={all.filter((n) => !n.archived)}
      subNiches={children}
      projects={(projectsRes.data ?? []) as Project[]}
      threads={threads}
      outputs={outputs}
      outputsReady={!outputsRes.error}
      tasks={(tasksRes.data ?? []) as NicheTask[]}
      activity={(activityRes.data ?? []) as NicheActivity[]}
      agents={(agentsRes.data ?? []) as Agent[]}
      projectFilter={sp.project ?? null}
    />
  );
}
