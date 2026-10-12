import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function anthropic() {
  if (!process.env.AI_API_KEY) throw new Error("AI_API_KEY is not configured");
  client ??= new Anthropic({ apiKey: process.env.AI_API_KEY });
  return client;
}
