import type { SupabaseClient } from "@supabase/supabase-js";

export type Niche = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string;
  color: string | null;
  icon: string | null;
  pinned: boolean;
  sort: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectStatus = "active" | "paused" | "done" | "archived";

export type Project = {
  id: string;
  niche_id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "פעיל",
  paused: "מושהה",
  done: "הושלם",
  archived: "בארכיון",
};

/** Niche + project scope of a thread or output. */
export type Scope = { nicheId: string | null; projectId: string | null };

export const MAX_PINNED = 4;

export async function listNiches(supabase: SupabaseClient, { includeArchived = false } = {}) {
  let q = supabase.from("niches").select("*").order("sort").order("created_at");
  if (!includeArchived) q = q.eq("archived", false);
  const { data } = await q;
  return (data ?? []) as Niche[];
}

export async function listProjects(supabase: SupabaseClient, nicheIds?: string[]) {
  let q = supabase.from("projects").select("*").neq("status", "archived").order("created_at", { ascending: false });
  if (nicheIds) q = q.in("niche_id", nicheIds);
  const { data } = await q;
  return (data ?? []) as Project[];
}

/** "AllDent › גיוס" — the niche path for chips and pickers. */
export function nichePath(niche: Niche, all: Niche[]): string {
  const parent = niche.parent_id ? all.find((n) => n.id === niche.parent_id) : null;
  return parent ? `${parent.name} › ${niche.name}` : niche.name;
}

/** Top-level niches with their sub-niches, in display order. */
export function nicheTree(all: Niche[]) {
  const roots = all.filter((n) => !n.parent_id || !all.some((p) => p.id === n.parent_id));
  return roots.map((root) => ({ niche: root, children: all.filter((n) => n.parent_id === root.id) }));
}

/** Records something the user (or an agent) did, for "הפעולות האחרונות". Never throws. */
export async function logActivity(
  supabase: SupabaseClient,
  entry: {
    actor?: "user" | "agent" | "system";
    action: string;
    entity_type: string;
    entity_id?: string | null;
    title: string;
    niche_id?: string | null;
    project_id?: string | null;
    agent_id?: string | null;
  },
) {
  try {
    await supabase.from("activity_log").insert({ actor: "user", ...entry });
  } catch {
    // activity is best-effort
  }
}
