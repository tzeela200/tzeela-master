import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OUTPUTS_BUCKET, type Agent, type AgentOutput, type Message, type Session } from "@/lib/types";
import { GENERATED_BUCKET } from "@/lib/chat-protocol";
import { summarizeOutput } from "@/lib/ai/summary";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * "שמור כתוצר": summary → category → output type → file in private storage → agent_outputs row.
 * The full answer is kept as a file so the archive can open / copy / download it later.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { agentId, sessionId, messageId } = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!agentId || !sessionId || !messageId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const [{ data: agent }, { data: session }] = await Promise.all([
    supabase.from("agents").select("*").eq("id", agentId).maybeSingle<Agent>(),
    supabase
      .from("sessions")
      .select("id, messages")
      .eq("id", sessionId)
      .eq("agent_id", agentId)
      .maybeSingle<Pick<Session, "id" | "messages">>(),
  ]);
  if (!agent || !session) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const idx = session.messages.findIndex((m) => m.id === messageId && m.role === "assistant");
  if (idx === -1) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const message = session.messages[idx];
  if (message.outputId) return NextResponse.json({ ok: true, outputId: message.outputId, already: true });

  const question =
    [...session.messages.slice(0, idx)].reverse().find((m: Message) => m.role === "user")?.content ?? "";

  const outputId = crypto.randomUUID();
  let outputType: AgentOutput["output_type"];
  let summary: string;
  let filePath: string;

  if (message.imageUrl) {
    outputType = "image";
    summary = `תמונה: ${question || "ללא תיאור"}`.slice(0, 300);
    const { data: img, error } = await supabase.storage.from(GENERATED_BUCKET).download(message.imageUrl);
    if (error || !img) return NextResponse.json({ error: "save_failed" }, { status: 500 });
    filePath = `${agentId}/${outputId}.png`;
    const up = await supabase.storage.from(OUTPUTS_BUCKET).upload(filePath, img, { contentType: "image/png" });
    if (up.error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  } else {
    outputType = "text";
    summary =
      (await summarizeOutput(message.content, question)) ??
      message.content.replace(/\s+/g, " ").trim().slice(0, 280);
    filePath = `${agentId}/${outputId}.md`;
    const up = await supabase.storage
      .from(OUTPUTS_BUCKET)
      .upload(filePath, new Blob([message.content], { type: "text/markdown;charset=utf-8" }), {
        contentType: "text/markdown;charset=utf-8",
      });
    if (up.error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  const { error: insErr } = await supabase.from("agent_outputs").insert({
    id: outputId,
    agent_id: agentId,
    category: agent.category,
    output_type: outputType,
    summary_text: summary,
    file_url: filePath,
    status: "pending",
  });
  if (insErr) {
    await supabase.storage.from(OUTPUTS_BUCKET).remove([filePath]);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  // Mark the message as saved so it can't be archived twice.
  const messages = session.messages.map((m, i) => (i === idx ? { ...m, outputId } : m));
  await supabase.from("sessions").update({ messages }).eq("id", sessionId).eq("agent_id", agentId);

  return NextResponse.json({ ok: true, outputId });
}
