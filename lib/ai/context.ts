import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { Agent, Message } from "@/lib/types";

const BASE_INSTRUCTIONS =
  "Reply in the language the user writes in (Hebrew by default). Use clear structure when it helps: short headings, lists, and short paragraphs.";

export function buildSystem(agent: Agent) {
  return `${agent.system_prompt.trim()}\n\n${BASE_INSTRUCTIONS}`;
}

/**
 * Thread isolation: the ONLY conversational context sent to the model is the
 * message array of the current session. Nothing from other threads, agents or
 * outputs is ever passed in here.
 */
export function buildMessages(threadMessages: Message[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of threadMessages) {
    const text =
      m.content.trim() || (m.imageUrl ? "[תמונה שנוצרה בשיחה]" : "");
    if (!text) continue;
    const last = out[out.length - 1];
    // Consecutive same-role messages (e.g. a user retry after a failed answer) are merged
    // so the conversation keeps strict user/assistant alternation.
    if (last && last.role === m.role && typeof last.content === "string") {
      last.content = `${last.content}\n\n${text}`;
    } else {
      out.push({ role: m.role, content: text });
    }
  }
  // The API requires the conversation to start with a user turn.
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}
