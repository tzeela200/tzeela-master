import { createClient } from "@/lib/supabase/server";
import type { Agent } from "@/lib/types";
import { Dashboard, type RecentItem } from "@/components/Dashboard";
import type { AgentWithCount } from "@/components/AgentCard";

function greetingFor(date: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(date),
  );
  if (hour >= 5 && hour < 12) return "בוקר טוב, צאלה";
  if (hour >= 12 && hour < 17) return "צהריים טובים, צאלה";
  if (hour >= 17 && hour < 22) return "ערב טוב, צאלה";
  return "לילה טוב, צאלה";
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [agentsRes, sessionsRes, outputsRes] = await Promise.all([
    supabase
      .from("agents")
      .select("*, sessions(count)")
      .order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select("id, title, agent_id, updated_at, agents(name)")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("agent_outputs")
      .select("id, summary_text, created_at, agents(name)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (agentsRes.error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <p role="alert" className="rounded-card bg-surface p-6 text-error shadow-soft">
          לא הצלחנו לטעון את הסוכנים. כדאי לרענן את העמוד.
        </p>
      </main>
    );
  }

  const agents: AgentWithCount[] = (agentsRes.data ?? []).map(
    ({ sessions, ...a }: Agent & { sessions: { count: number }[] }) => ({
      ...a,
      threadCount: sessions?.[0]?.count ?? 0,
    }),
  );

  const agentName = (rel: unknown) =>
    (Array.isArray(rel) ? rel[0]?.name : (rel as { name?: string } | null)?.name) ?? "";

  const recent: RecentItem[] = [
    ...(sessionsRes.data ?? []).map((s) => ({
      kind: "thread" as const,
      id: s.id,
      title: s.title || "נושא ללא כותרת",
      agentName: agentName(s.agents),
      href: `/agents/${s.agent_id}?session=${s.id}`,
      date: s.updated_at,
    })),
    ...(outputsRes.data ?? []).map((o) => ({
      kind: "output" as const,
      id: o.id,
      title: o.summary_text,
      agentName: agentName(o.agents),
      href: `/outputs?open=${o.id}`,
      date: o.created_at,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return <Dashboard greeting={greetingFor(new Date())} agents={agents} recent={recent} />;
}
