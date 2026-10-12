// Server-only model configuration. Never shown in the UI.
// Override per environment without code changes.
export const MODELS = {
  text: process.env.AI_TEXT_MODEL || "claude-sonnet-5-5",
  fast: process.env.AI_FAST_MODEL || "claude-haiku-5-5",
  image: process.env.AI_IMAGE_MODEL || "gpt-image-1",
} as const;
