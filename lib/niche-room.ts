import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** חדר הנישה — 13 הרכיבים, בארבע קבוצות. */

export type NicheHealth = "ok" | "warn" | "down" | "unknown";

export type RoomStatus = {
  health: NicheHealth;
  checkedAt: string | null;
  done: string;
  doing: string;
  todo: string;
  updatedAt: string | null;
};

export type RoomLink = {
  id: string;
  label: string;
  url: string;
  kind: "app" | "db" | "admin" | "docs" | "external" | string;
};

export type RoomDocument = {
  id: string;
  name: string;
  filePath: string;
  kind: string;
  sizeBytes: number;
  note: string;
  createdAt: string;
};

export type RoomNote = {
  id: string;
  kind: "note" | "decision" | "voice" | string;
  body: string;
  source: string;
  createdAt: string;
};

export type RoomQuickAction = {
  id: string;
  label: string;
  actionKind: "link" | "prompt" | "package" | "skill" | string;
  target: string;
  icon: string;
};

export type RoomPerformer = {
  id: string;
  kind: "agent" | "claude-code" | "script" | "person" | "service" | string;
  label: string;
  roleText: string;
  isActive: boolean;
};

export type RoomTask = {
  id: string;
  title: string;
  status: string;
  performer: string;
  prerequisites: string;
  estimateText: string;
  deliverable: string;
  needsApproval: boolean;
  updatedAt: string;
};

export type RoomRun = {
  id: string;
  title: string;
  status: string;
  environment: string;
  performer: string;
  channel: string;
  cost: number | null;
  createdAt: string;
};

export type RoomOutput = {
  id: string;
  summary: string;
  status: string;
  agentName: string;
  createdAt: string;
};

export type RoomActivity = {
  id: string;
  title: string;
  actor: string;
  channel: string;
  createdAt: string;
};

export type NicheRoomData = {
  status: RoomStatus;
  links: RoomLink[];
  documents: RoomDocument[];
  notes: RoomNote[];
  quickActions: RoomQuickAction[];
  performers: RoomPerformer[];
  tasks: RoomTask[];
  runs: RoomRun[];
  outputs: RoomOutput[];
  activity: RoomActivity[];
  lastSnapshotAt: string | null;
};

const EMPTY_STATUS: RoomStatus = {
  health: "unknown",
  checkedAt: null,
  done: "",
  doing: "",
  todo: "",
  updatedAt: null,
};

const rel = (r: unknown) => (Array.isArray(r) ? r[0] : r) as { name?: string } | null;

/** כל מה שחדר נישה אחד צריך, בקריאה מקבילה אחת. */
export async function loadNicheRoom(
  supabase: SupabaseClient,
  scopeIds: string[],
): Promise<NicheRoomData> {
  const nicheId = scopeIds[0];

  const [status, links, documents, notes, actions, performers, tasks, runs, outputs, activity, snapshot] =
    await Promise.all([
      supabase.from("niche_status").select("*").eq("niche_id", nicheId).maybeSingle(),
      supabase.from("niche_links").select("*").in("niche_id", scopeIds).order("sort"),
      supabase
        .from("niche_documents")
        .select("id, name, file_path, kind, size_bytes, note, created_at")
        .in("niche_id", scopeIds)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("niche_notes")
        .select("id, kind, body, source, created_at")
        .in("niche_id", scopeIds)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("niche_quick_actions").select("*").in("niche_id", scopeIds).order("sort"),
      supabase
        .from("niche_performers")
        .select("id, kind, label, role_text, is_active")
        .in("niche_id", scopeIds)
        .order("kind")
        .order("label"),
      supabase
        .from("tasks")
        .select("id, title, status, performer, prerequisites, estimate_text, deliverable, needs_approval, updated_at")
        .in("niche_id", scopeIds)
        .not("status", "in", "(done,cancelled)")
        .order("updated_at", { ascending: false })
        .limit(50),
      supabase
        .from("runs")
        .select("id, title, status, environment, performer, channel, cost, created_at")
        .in("niche_id", scopeIds)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("agent_outputs")
        .select("id, summary_text, status, created_at, agents(name)")
        .in("niche_id", scopeIds)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("activity_log")
        .select("id, title, actor, channel, created_at")
        .in("niche_id", scopeIds)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("niche_snapshots")
        .select("created_at")
        .eq("niche_id", nicheId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return {
    status: status.data
      ? {
          health: (status.data.health ?? "unknown") as NicheHealth,
          checkedAt: status.data.checked_at,
          done: status.data.done_text ?? "",
          doing: status.data.doing_text ?? "",
          todo: status.data.todo_text ?? "",
          updatedAt: status.data.updated_at,
        }
      : EMPTY_STATUS,
    links: (links.data ?? []).map((l) => ({ id: l.id, label: l.label, url: l.url, kind: l.kind })),
    documents: (documents.data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      filePath: d.file_path,
      kind: d.kind,
      sizeBytes: d.size_bytes,
      note: d.note,
      createdAt: d.created_at,
    })),
    notes: (notes.data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      body: n.body,
      source: n.source,
      createdAt: n.created_at,
    })),
    quickActions: (actions.data ?? []).map((a) => ({
      id: a.id,
      label: a.label,
      actionKind: a.action_kind,
      target: a.target,
      icon: a.icon,
    })),
    performers: (performers.data ?? []).map((p) => ({
      id: p.id,
      kind: p.kind,
      label: p.label,
      roleText: p.role_text,
      isActive: p.is_active,
    })),
    tasks: (tasks.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      performer: t.performer ?? "",
      prerequisites: t.prerequisites ?? "",
      estimateText: t.estimate_text ?? "",
      deliverable: t.deliverable ?? "",
      needsApproval: Boolean(t.needs_approval),
      updatedAt: t.updated_at,
    })),
    runs: (runs.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      environment: r.environment,
      performer: r.performer,
      channel: r.channel,
      cost: r.cost,
      createdAt: r.created_at,
    })),
    outputs: (outputs.data ?? []).map((o) => ({
      id: o.id,
      summary: o.summary_text ?? "",
      status: o.status,
      agentName: rel(o.agents)?.name ?? "",
      createdAt: o.created_at,
    })),
    activity: (activity.data ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      actor: a.actor ?? "",
      channel: a.channel ?? "",
      createdAt: a.created_at,
    })),
    lastSnapshotAt: snapshot.data?.created_at ?? null,
  };
}
