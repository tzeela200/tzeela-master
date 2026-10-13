import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Agent, Session } from "@/lib/types";
import type { SessionSummary } from "@/lib/sessions";
import { listNiches, listProjects, type Scope } from "@/lib/niches";
import { Workspace } from "@/components/workspace/Workspace";

type OpenSession = Pick<Session, "id" | "title" | "messages" | "niche_id" | "project_id">;

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string; new?: string; niche?: string; project?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const [{ data: agent }, { data: sessions }, niches, projects] = await Promise.all([
    supabase.from("agents").select("*").eq("id", id).maybeSingle<Agent>(),
    supabase
      .from("sessions")
      .select("id, title, updated_at")
      .eq("agent_id", id)
      .order("updated_at", { ascending: false })
      .limit(50),
    listNiches(supabase),
    listProjects(supabase),
  ]);
  if (!agent) notFound();

  // Which thread: explicit ?session=, a fresh one (?new=1), or the most recent.
  const targetId = sp.session ?? (sp.new ? null : (sessions?.[0]?.id ?? null));
  let session: OpenSession | null = null;
  if (targetId) {
    const { data } = await supabase
      .from("sessions")
      .select("id, title, messages, niche_id, project_id")
      .eq("id", targetId)
      .eq("agent_id", agent.id) // a thread is only ever opened inside its own agent
      .maybeSingle<OpenSession>();
    session = data;
  }

  // Scope: the saved thread's, or the one a new thread was opened with (?niche=&project=).
  const fromUrlProject = projects.find((p) => p.id === sp.project);
  const scope: Scope = session
    ? { nicheId: session.niche_id ?? null, projectId: session.project_id ?? null }
    : {
        nicheId: fromUrlProject?.niche_id ?? (niches.some((n) => n.id === sp.niche) ? sp.niche! : null),
        projectId: fromUrlProject?.id ?? null,
      };

  // Master Agent: how many saved outputs in its category it can draw on (shown in the empty state).
  let masterCount: number | null = null;
  if (agent.is_master) {
    const { count } = await supabase
      .from("agent_outputs")
      .select("id", { count: "exact", head: true })
      .ilike("category", agent.category.trim());
    masterCount = count ?? 0;
  }

  return (
    <Workspace
      masterCount={masterCount}
      key={session?.id ?? `new-${sp.new ?? "default"}`}
      agent={agent}
      sessions={(sessions ?? []) as SessionSummary[]}
      session={session}
      scope={scope}
      niches={niches}
      projects={projects}
    />
  );
}
