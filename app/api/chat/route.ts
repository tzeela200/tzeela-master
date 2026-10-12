import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Agent, Attachment, Message, Session } from "@/lib/types";
import { MAX_TEXT_CHARS } from "@/lib/files";
import { GENERATED_BUCKET, type ChatEvent, type ChatRequest } from "@/lib/chat-protocol";
import { anthropic } from "@/lib/ai/anthropic";
import { buildMessages, buildSystem } from "@/lib/ai/context";
import { masterContext, masterOutputs } from "@/lib/ai/master";
import { buildImagePrompt, generateImage } from "@/lib/ai/image";
import { generateTitle } from "@/lib/ai/title";
import { MODELS } from "@/lib/ai/models";
import { newMessage, titleFrom } from "@/lib/sessions";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_MESSAGE_CHARS = 100_000;

/** Accepts only well-formed attachments: storage paths inside attachments/, text within the cap. */
function validAttachment(a: unknown): Attachment | null {
  if (!a || typeof a !== "object") return null;
  const { name, kind, path, text } = a as Record<string, unknown>;
  const kinds = ["txt", "csv", "pdf", "docx", "xlsx", "image"];
  if (typeof name !== "string" || !name || typeof kind !== "string" || !kinds.includes(kind)) return null;
  if (path !== undefined && (typeof path !== "string" || !path.startsWith("attachments/"))) return null;
  if (text !== undefined && (typeof text !== "string" || text.length > MAX_TEXT_CHARS)) return null;
  if (!path && !text) return null;
  return {
    name: name.slice(0, 200),
    kind: kind as Attachment["kind"],
    ...(typeof path === "string" ? { path } : {}),
    ...(typeof text === "string" ? { text } : {}),
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const text = typeof body.message === "string" ? body.message.trim() : "";
  const attachment = validAttachment(body.attachment);
  if (body.attachment && !attachment) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!body.agentId || (!body.retry && !text && !attachment) || text.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (body.retry && !body.sessionId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // 1. Agent exists (RLS: owner only)
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", body.agentId)
    .maybeSingle<Agent>();
  if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // 2. Session exists AND belongs to this agent — or create a fresh one
  let session: Pick<Session, "id" | "title" | "messages">;
  if (body.sessionId) {
    const { data } = await supabase
      .from("sessions")
      .select("id, title, messages")
      .eq("id", body.sessionId)
      .eq("agent_id", agent.id)
      .maybeSingle<Pick<Session, "id" | "title" | "messages">>();
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    session = data;
  } else {
    const { data, error } = await supabase
      .from("sessions")
      .insert({ agent_id: agent.id, title: titleFrom(text || attachment?.name || ""), messages: [] })
      .select("id, title, messages")
      .single<Pick<Session, "id" | "title" | "messages">>();
    if (error || !data) return NextResponse.json({ error: "save_failed" }, { status: 500 });
    session = data;
  }

  // 3. Save the user message first (kept even if the AI call fails)
  let history = session.messages;
  if (body.retry) {
    // Regenerate: drop a trailing answer in memory only. The DB keeps the old answer
    // until a new one completes successfully.
    if (history[history.length - 1]?.role === "assistant") history = history.slice(0, -1);
    if (history[history.length - 1]?.role !== "user") {
      return NextResponse.json({ error: "nothing_to_retry" }, { status: 400 });
    }
  } else {
    const userMsg = newMessage("user", text);
    if (attachment) userMsg.attachment = attachment;
    history = [...history, userMsg];
    const { error } = await supabase
      .from("sessions")
      .update({ messages: history })
      .eq("id", session.id)
      .eq("agent_id", agent.id);
    if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const signal = req.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // client went away
        }
      };

      emit({ t: "session", id: session.id, title: session.title });

      // Persist a completed assistant message (never a partial one).
      const finish = async (assistant: Message) => {
        const messages = [...history, assistant];
        // Auto-title only while the thread still has its fallback title (never overwrite a rename).
        let title: string | null | undefined;
        const first = messages.find((m) => m.role === "user");
        const firstText = first?.content || first?.attachment?.name || "";
        if (session.title === titleFrom(firstText)) {
          title = await generateTitle(
            first?.attachment ? `${firstText}
(קובץ מצורף: ${first.attachment.name})` : firstText,
          );
        }
        const update: { messages: Message[]; title?: string } = { messages };
        if (title) update.title = title;
        const { error } = await supabase
          .from("sessions")
          .update(update)
          .eq("id", session.id)
          .eq("agent_id", agent.id);
        if (error) throw error;
        emit({ t: "done", message: assistant, title: title ?? undefined });
      };

      try {
        if (agent.is_image_generator) {
          // ---- Image route ----
          const png = await generateImage(buildImagePrompt(agent, history), signal);
          const assistant = newMessage("assistant", "");
          const path = `generated/${session.id}/${assistant.id}.png`;
          const { error } = await supabase.storage
            .from(GENERATED_BUCKET)
            .upload(path, png, { contentType: "image/png" });
          if (error) throw error;
          assistant.imageUrl = path;
          await finish(assistant);
        } else {
          // ---- Text route (streaming) ----
          const messages = await buildMessages(supabase, history);
          // Master Agent: adds summaries of saved outputs in its category — never other threads.
          const system = agent.is_master
            ? [buildSystem(agent), masterContext(agent, await masterOutputs(supabase, agent))].join("\n\n")
            : buildSystem(agent);
          const s = anthropic().beta.messages.stream(
            {
              model: MODELS.text,
              max_tokens: 64000,
              system,
              messages,
              output_config: { effort: "medium" },
              // Automatic prompt caching: the growing thread prefix (incl. attached files) is re-read cheaply.
              cache_control: { type: "ephemeral" },
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
            },
            { signal },
          );
          s.on("text", (delta) => emit({ t: "delta", text: delta }));
          const final = await s.finalMessage();
          if (final.stop_reason === "refusal") throw new Error("refusal");
          const answer = final.content
            .flatMap((b) => (b.type === "text" ? [b.text] : []))
            .join("")
            .trim();
          if (!answer) throw new Error("empty answer");
          await finish(newMessage("assistant", answer));
        }
      } catch (err) {
        if (!signal.aborted) {
          console.error("[chat]", agent.is_image_generator ? "image" : "text", err);
          emit({ t: "error", kind: agent.is_image_generator ? "image" : "text" });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
