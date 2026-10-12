import "server-only";
import { anthropic } from "./anthropic";
import { MODELS } from "./models";

/** Short Hebrew thread title from the first exchange. Returns null on any failure. */
export async function generateTitle(userText: string): Promise<string | null> {
  try {
    const res = await anthropic().messages.create({
      model: MODELS.fast,
      max_tokens: 60,
      thinking: { type: "disabled" },
      system:
        "Write a short title (2-6 words) for a conversation that starts with the user's message. Same language as the message. Output the title only, no quotes or punctuation at the end.",
      messages: [{ role: "user", content: userText.slice(0, 2000) }],
    });
    if (res.stop_reason === "refusal") return null;
    const text = res.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim()
      .replace(/^["'«]+|["'»]+$/g, "");
    return text ? text.slice(0, 80) : null;
  } catch {
    return null;
  }
}
