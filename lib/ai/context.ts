import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachmentsOf, type Agent, type Attachment, type Message } from "@/lib/types";
import { ATTACH_BUCKET } from "@/lib/files";

type Block = Anthropic.Beta.BetaContentBlockParam;

const BASE_INSTRUCTIONS =
  "Reply in the language the user writes in (Hebrew by default). Use clear structure when it helps: short headings, lists, and short paragraphs.";

export function buildSystem(agent: Agent) {
  return `${agent.system_prompt.trim()}\n\n${BASE_INSTRUCTIONS}`;
}

async function attachmentBlocks(supabase: SupabaseClient, a: Attachment): Promise<Block[]> {
  const asText = (text: string): Block[] => [{ type: "text", text: `קובץ מצורף: ${a.name}\n<file>\n${text}\n</file>` }];
  if (a.text) return asText(a.text);
  if (a.textPath) {
    const { data, error } = await supabase.storage.from(ATTACH_BUCKET).download(a.textPath);
    if (error || !data) return [{ type: "text", text: `[הקובץ ${a.name} אינו זמין יותר]` }];
    return asText(await data.text());
  }
  if (!a.path) return [];
  const { data, error } = await supabase.storage.from(ATTACH_BUCKET).download(a.path);
  if (error || !data) return [{ type: "text", text: `[הקובץ ${a.name} אינו זמין יותר]` }];
  const b64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  if (a.kind === "image") {
    const media = data.type === "image/png" ? "image/png" : "image/jpeg";
    return [{ type: "image", source: { type: "base64", media_type: media, data: b64 } }];
  }
  if (a.kind === "pdf") {
    return [
      { type: "document", title: a.name, source: { type: "base64", media_type: "application/pdf", data: b64 } },
    ];
  }
  return [];
}

/**
 * Thread isolation: the ONLY conversational context sent to the model is the
 * message array of the current session (including its own attachments).
 * Nothing from other threads, agents or outputs is ever passed in here.
 */
export async function buildMessages(
  supabase: SupabaseClient,
  threadMessages: Message[],
): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const out: { role: "user" | "assistant"; content: Block[] }[] = [];
  for (const m of threadMessages) {
    const blocks: Block[] = [];
    if (m.role === "user")
      for (const a of attachmentsOf(m)) blocks.push(...(await attachmentBlocks(supabase, a)));
    const text = m.content.trim() || (m.imageUrl ? "[תמונה שנוצרה בשיחה]" : "");
    if (text) blocks.push({ type: "text", text });
    if (!blocks.length) continue;

    const last = out[out.length - 1];
    // Consecutive same-role messages (e.g. after a failed answer) are merged
    // so the conversation keeps strict user/assistant alternation.
    if (last && last.role === m.role) last.content.push(...blocks);
    else out.push({ role: m.role, content: blocks });
  }
  // The API requires the conversation to start with a user turn.
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}
