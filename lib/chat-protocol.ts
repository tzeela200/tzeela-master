import type { Attachment, Message } from "./types";

// Newline-delimited JSON events streamed from POST /api/chat.
export type ChatEvent =
  | { t: "session"; id: string; title: string | null }
  | { t: "delta"; text: string }
  | { t: "done"; message: Message; title?: string | null }
  | { t: "error"; kind: "text" | "image" };

export type ChatRequest = {
  agentId: string;
  sessionId: string | null;
  message: string;
  /** Re-run the answer for the last saved user message instead of adding a new one. */
  retry?: boolean;
  attachment?: Attachment | null;
  /** New threads only: the niche / project the thread belongs to. */
  nicheId?: string | null;
  projectId?: string | null;
};

/** Bucket for generated images; the message stores the object path, shown via signed URL. */
export const GENERATED_BUCKET = "uploads";
