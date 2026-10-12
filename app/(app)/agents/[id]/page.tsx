import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Agent, Session } from "@/lib/types";
import type { SessionSummary } from "@/lib/sessions";
import { Workspace } from "@/components/workspace/Workspace";

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string; new?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const [{ data: agent }, { data: sessions }] = await Promise.all([
    supabase.from("agents").select("*").eq("id", id).maybeSingle<Agent>(),
    supabase
      .from("sessions")
      .select("id, title, updated_at")
      .eq("agent_id", id)
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);
  if (!agent) notFound();

  // Which thread: explicit ?session=, a fresh one (?new=1), or the most recent.
  const targetId = sp.session ?? (sp.new ? null : (sessions?.[0]?.id ?? null));
  let session: Pick<Session, "id" | "title" | "messages"> | null = null;
  if (targetId) {
    const { data } = await supabase
      .from("sessions")
      .select("id, title, messages")
      .eq("id", targetId)
      .eq("agent_id", agent.id) // a thread is only ever opened inside its own agent
      .maybeSingle<Pick<Session, "id" | "title" | "messages">>();
    session = data;
  }

  return (
    <Workspace
      key={session?.id ?? `new-${sp.new ?? "default"}`}
      agent={agent}
      sessions={(sessions ?? []) as SessionSummary[]}
      session={session}
    />
  );
}
