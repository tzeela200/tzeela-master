import "server-only";
import OpenAI from "openai";
import type { Agent, Message } from "@/lib/types";
import { MODELS } from "./models";

let client: OpenAI | null = null;

function openai() {
  if (!process.env.IMAGE_API_KEY) throw new Error("IMAGE_API_KEY is not configured");
  client ??= new OpenAI({ apiKey: process.env.IMAGE_API_KEY });
  return client;
}

/**
 * Builds the image prompt from the agent profile and the CURRENT thread only:
 * earlier requests in this thread let the user refine ("make it brighter").
 */
export function buildImagePrompt(agent: Agent, threadMessages: Message[]) {
  const requests = threadMessages
    .filter((m) => m.role === "user" && m.content.trim())
    .map((m) => m.content.trim());
  const current = requests.pop() ?? "";
  const earlier = requests.slice(-3);
  return [
    `Style and role: ${agent.system_prompt.trim()}`,
    earlier.length ? `Earlier requests in this conversation:\n- ${earlier.join("\n- ")}` : "",
    `Create this image now: ${current}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateImage(prompt: string, signal: AbortSignal): Promise<Buffer> {
  const res = await openai().images.generate(
    { model: MODELS.image, prompt, size: "1024x1024", n: 1 },
    { signal },
  );
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned");
  return Buffer.from(b64, "base64");
}
