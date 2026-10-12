"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, ListTree, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Agent, Message } from "@/lib/types";
import {
  createSession,
  newMessage,
  renameSession,
  saveMessages,
  titleFrom,
  type SessionSummary,
} from "@/lib/sessions";
import { AgentIcon } from "../AgentIcon";
import { FavoriteButton } from "../FavoriteButton";
import { useToast } from "../Toast";
import { ThreadDrawer, ThreadPanel } from "./ThreadSelector";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

type Props = {
  agent: Agent;
  sessions: SessionSummary[];
  /** null = a fresh thread that is created in the DB on its first message */
  session: { id: string; title: string | null; messages: Message[] } | null;
};

// Each thread mounts its own Workspace instance (keyed by session id in the page),
// so no message state can carry over between threads.
export function Workspace({ agent, sessions: initialSessions, session }: Props) {
  const toast = useToast();
  const [sessions, setSessions] = useState(initialSessions);
  const [sessionId, setSessionId] = useState<string | null>(session?.id ?? null);
  const [title, setTitle] = useState<string | null>(session?.title ?? null);
  const [messages, setMessages] = useState<Message[]>(session?.messages ?? []);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  function upsertSummary(s: SessionSummary) {
    setSessions((list) => [s, ...list.filter((x) => x.id !== s.id)]);
  }

  async function send(text: string): Promise<boolean> {
    if (!navigator.onLine) {
      toast("אין כרגע חיבור לאינטרנט.", "error");
      return false;
    }
    const userMsg = newMessage("user", text);
    const next = [...messages, userMsg];
    setBusy(true);
    setMessages(next);

    const supabase = createClient();
    const res = sessionId
      ? await saveMessages(supabase, sessionId, agent.id, next)
      : await createSession(supabase, agent.id, next, titleFrom(text));
    setBusy(false);

    if (res.error || !res.data) {
      setMessages(messages);
      toast("ההודעה לא נשמרה. אפשר לנסות שוב.", "error");
      return false;
    }
    if (!sessionId) {
      setSessionId(res.data.id);
      setTitle(res.data.title);
      // Keep the URL in sync without remounting this thread.
      window.history.replaceState(null, "", `/agents/${agent.id}?session=${res.data.id}`);
    }
    upsertSummary(res.data);
    return true;
  }

  async function saveTitle(value: string) {
    setEditingTitle(false);
    const clean = value.trim();
    if (!sessionId || !clean || clean === title) return;
    const prev = title;
    setTitle(clean);
    const res = await renameSession(createClient(), sessionId, agent.id, clean);
    if (res.error || !res.data) {
      setTitle(prev);
      toast("השם לא נשמר.", "error");
      return;
    }
    upsertSummary(res.data);
  }

  const threadLabel = title || "נושא חדש";

  return (
    <div className="flex h-dvh flex-col" data-workspace>
      {/* Header */}
      <header className="flex shrink-0 items-center gap-1 border-b border-border bg-surface px-2 py-2 md:px-4">
        <Link
          href="/"
          aria-label="חזרה"
          className="flex size-11 shrink-0 items-center justify-center rounded-button hover:bg-primary-hover"
        >
          <ArrowRight className="size-6" aria-hidden />
        </Link>
        <AgentIcon name={agent.icon} className="size-5 shrink-0 text-primary" />
        <h1 className="min-w-0 flex-1 truncate px-2 text-[18px] md:text-[20px]">{agent.name}</h1>
        <FavoriteButton agentId={agent.id} agentName={agent.name} initial={agent.is_favorite} />
        <Link
          href={`/agents/${agent.id}/edit`}
          aria-label="עריכת הסוכן"
          className="flex size-11 shrink-0 items-center justify-center rounded-button hover:bg-primary-hover"
        >
          <Pencil className="size-5" aria-hidden />
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        <ThreadPanel agentId={agent.id} sessions={sessions} currentId={sessionId} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Thread bar */}
          <div className="flex shrink-0 items-center gap-1 border-b border-border bg-surface/60 px-2 py-1 md:px-4">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="נושאים"
              className="flex size-11 shrink-0 items-center justify-center rounded-button hover:bg-primary-hover lg:hidden"
            >
              <ListTree className="size-5" aria-hidden />
            </button>
            {editingTitle ? (
              <form
                className="flex flex-1 items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveTitle(new FormData(e.currentTarget).get("title") as string);
                }}
              >
                <label htmlFor="thread-title" className="sr-only">
                  שם הנושא
                </label>
                <input
                  id="thread-title"
                  name="title"
                  defaultValue={title ?? ""}
                  autoFocus
                  maxLength={80}
                  onBlur={(e) => saveTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setEditingTitle(false)}
                  className="h-10 flex-1 rounded-input border border-primary bg-surface px-3 outline-none"
                />
                <button
                  type="submit"
                  aria-label="שמירת שם"
                  className="flex size-11 items-center justify-center rounded-button hover:bg-primary-hover"
                >
                  <Check className="size-5" aria-hidden />
                </button>
              </form>
            ) : (
              <>
                <h2 className="min-w-0 flex-1 truncate px-1 text-[15px] font-medium text-secondary">
                  {threadLabel}
                </h2>
                {sessionId && (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    aria-label="שינוי שם הנושא"
                    className="flex size-11 shrink-0 items-center justify-center rounded-button text-secondary hover:bg-primary-hover"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <MessageList messages={messages} />
          </div>

          <Composer onSend={send} disabled={busy} />
        </div>
      </div>

      <ThreadDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        agentId={agent.id}
        sessions={sessions}
        currentId={sessionId}
      />
    </div>
  );
}
