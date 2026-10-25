import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * רכיב 3 — נעילת צילום מצב.
 * סופר מה נוסף בנישה מאז הצילום הקודם, שומר שורה ב-niche_snapshots
 * וכותב שורת יומן. לא משנה ולא מוחק שום נתון קיים.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: niche } = await supabase.from("niches").select("id, name").eq("id", id).maybeSingle();
  if (!niche) return NextResponse.json({ error: "הנישה לא נמצאה" }, { status: 404 });

  const { data: prev } = await supabase
    .from("niche_snapshots")
    .select("created_at")
    .eq("niche_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const since = prev?.created_at ?? null;
  const countSince = async (table: string, column = "created_at") => {
    let qb = supabase.from(table).select("id", { count: "exact", head: true }).eq("niche_id", id);
    if (since) qb = qb.gt(column, since);
    const { count } = await qb;
    return count ?? 0;
  };

  const [docs, notes, tasksDone] = await Promise.all([
    countSince("niche_documents"),
    countSince("niche_notes"),
    (async () => {
      let qb = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("niche_id", id).eq("status", "done");
      if (since) qb = qb.gt("updated_at", since);
      const { count } = await qb;
      return count ?? 0;
    })(),
  ]);

  const parts: string[] = [];
  if (docs) parts.push(`${docs} מסמכים`);
  if (notes) parts.push(`${notes} הערות`);
  if (tasksDone) parts.push(`${tasksDone} משימות שנסגרו`);
  const summary = parts.length
    ? `נקלטו ${parts.join(" · ")}`
    : since
      ? "אין שינוי מאז הסנכרון הקודם"
      : "צילום מצב ראשון";

  const { error: snapErr } = await supabase.from("niche_snapshots").insert({
    niche_id: id,
    summary,
    docs_count: docs,
    notes_count: notes,
    tasks_done: tasksDone,
  });
  if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 });

  await supabase.from("activity_log").insert({
    niche_id: id,
    actor: "user",
    action: "sync_snapshot",
    entity_type: "niche",
    entity_id: id,
    title: `עדכון תמונת מצב — ${summary}`,
    channel: "app",
  });

  return NextResponse.json({ summary, docs, notes, tasksDone });
}
