import { createClient } from "@/lib/supabase/server";
import type { Agent } from "@/lib/types";
import { Dashboard, type RecentItem } from "@/components/Dashboard";
import type { AgentWithCount } from "@/components/AgentCard";
import { NicheZones, type NicheZone, type UserActivity } from "@/components/niches/NicheZones";
import { MAX_PINNED } from "@/lib/niches";

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

  const [{ zones, activity }, agentsRes, sessionsRes, outputsRes] = await Promise.all([
    loadZones(supabase),
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

  return (
    <Dashboard
      greeting={greetingFor(new Date())}
      agents={agents}
      recent={recent}
      zones={<NicheZones zones={zones} activity={activity} />}
    />
  );
}

const OPEN = ["open", "queued", "running", "waiting", "failed"];

/** Pinned niches (incl. their sub-niches' work) and the user's own recent actions. */
async function loadZones(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: niches }, { data: mine }] = await Promise.all([
    supabase.from("niches").select("id, name, parent_id, pinned").eq("archived", false),
    supabase
      .from("activity_log")
      .select("id, title, created_at")
      .eq("actor", "user")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const activity: UserActivity[] = (mine ?? []).map((a) => ({ id: a.id, title: a.title, date: a.created_at }));
  const pinned = (niches ?? []).filter((n) => n.pinned).slice(0, MAX_PINNED);
  if (!pinned.length) return { zones: [] as NicheZone[], activity };

  const scopeOf = (id: string) => [id, ...(niches ?? []).filter((n) => n.parent_id === id).map((n) => n.id)];
  const allIds = pinned.flatMap((n) => scopeOf(n.id));
  const [{ data: tasks }, { data: projects }, { data: threads }, { data: recent }] = await Promise.all([
    supabase.from("tasks").select("id, title, status, niche_id, updated_at").in("niche_id", allIds).in("status", OPEN).order("updated_at", { ascending: false }),
    supabase.from("projects").select("niche_id").in("niche_id", allIds).neq("status", "archived"),
    supabase.from("sessions").select("niche_id").in("niche_id", allIds),
    supabase.from("activity_log").select("id, title, niche_id, created_at").in("niche_id", allIds).order("created_at", { ascending: false }).limit(40),
  ]);

  const zones: NicheZone[] = pinned.map((n) => {
    const ids = new Set(scopeOf(n.id));
    const inScope = <T extends { niche_id: string | null }>(rows: T[] | null) => (rows ?? []).filter((r) => r.niche_id && ids.has(r.niche_id));
    const open = inScope(tasks);
    return {
      id: n.id,
      name: n.name,
      projects: inScope(projects).length,
      threads: inScope(threads).length,
      openTaskCount: open.length,
      // failed first, then most recent
      openTasks: [...open].sort((a, b) => Number(b.status === "failed") - Number(a.status === "failed")).slice(0, 3),
      recent: inScope(recent).slice(0, 3).map((r) => ({ id: r.id, title: r.title, date: r.created_at })),
    };
  });
  return { zones, activity };
}
