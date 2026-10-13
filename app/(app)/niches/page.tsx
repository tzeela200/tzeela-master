import { createClient } from "@/lib/supabase/server";
import { listNiches } from "@/lib/niches";
import { NichesBoard, type NicheStats } from "@/components/niches/NichesBoard";

export default async function NichesPage() {
  const supabase = await createClient();
  const [niches, projectsRes, sessionsRes, tasksRes] = await Promise.all([
    listNiches(supabase),
    supabase.from("projects").select("niche_id").neq("status", "archived"),
    supabase.from("sessions").select("niche_id").not("niche_id", "is", null),
    supabase.from("tasks").select("niche_id").in("status", ["open", "queued", "running", "waiting", "failed"]),
  ]);

  const stats: Record<string, NicheStats> = {};
  const bump = (rows: { niche_id: string | null }[] | null, key: keyof NicheStats) => {
    for (const r of rows ?? []) {
      if (!r.niche_id) continue;
      stats[r.niche_id] ??= { projects: 0, threads: 0, openTasks: 0 };
      stats[r.niche_id][key]++;
    }
  };
  bump(projectsRes.data, "projects");
  bump(sessionsRes.data, "threads");
  bump(tasksRes.data, "openTasks");

  return <NichesBoard initial={niches} stats={stats} />;
}
