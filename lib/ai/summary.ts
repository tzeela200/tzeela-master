import "server-only";
import { anthropic } from "./anthropic";
import { MODELS } from "./models";

/**
 * Short Hebrew summary of a saved output. It is what the archive shows and what a
 * Master Agent later reads, so it keeps concrete facts (names, numbers, decisions).
 */
export async function summarizeOutput(answer: string, question: string): Promise<string | null> {
  try {
    const res = await anthropic().messages.create({
      model: MODELS.fast,
      max_tokens: 400,
      thinking: { type: "disabled" },
      system:
        "Summarize the assistant answer below in Hebrew, 1-3 sentences, at most 300 characters. Keep the concrete facts: names, numbers, dates, decisions, conclusions. Output the summary only.",
      messages: [
        {
          role: "user",
          content: `<question>\n${question.slice(0, 4000)}\n</question>\n<answer>\n${answer.slice(0, 60000)}\n</answer>`,
        },
      ],
    });
    if (res.stop_reason === "refusal") return null;
    const text = res.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim();
    return text ? text.slice(0, 600) : null;
  } catch {
    return null;
  }
}
