import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message, Session } from "./types";

export type SessionSummary = Pick<Session, "id" | "title" | "updated_at">;

export function newMessage(role: Message["role"], content: string): Message {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() };
}

// Fallback title until an AI-generated one exists (Phase 4).
export function titleFrom(text: string) {
  const line = text.trim().split("\n")[0].trim();
  return line.length > 40 ? `${line.slice(0, 40).trim()}…` : line;
}

export async function createSession(
  supabase: SupabaseClient,
  agentId: string,
  messages: Message[],
  title: string,
) {
  return supabase
    .from("sessions")
    .insert({ agent_id: agentId, messages, title })
    .select("id, title, updated_at")
    .single<SessionSummary>();
}

export async function saveMessages(
  supabase: SupabaseClient,
  sessionId: string,
  agentId: string,
  messages: Message[],
) {
  // agent_id in the filter: a session can never be written through another agent's workspace.
  return supabase
    .from("sessions")
    .update({ messages })
    .eq("id", sessionId)
    .eq("agent_id", agentId)
    .select("id, title, updated_at")
    .single<SessionSummary>();
}

export async function renameSession(
  supabase: SupabaseClient,
  sessionId: string,
  agentId: string,
  title: string,
) {
  return supabase
    .from("sessions")
    .update({ title })
    .eq("id", sessionId)
    .eq("agent_id", agentId)
    .select("id, title, updated_at")
    .single<SessionSummary>();
}
