"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Pencil, ListTree, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Agent, Attachment, Message } from "@/lib/types";
import { takePendingFile } from "@/lib/pending-file";
import { newMessage, renameSession, type SessionSummary } from "@/lib/sessions";
import type { ChatEvent, ChatRequest } from "@/lib/chat-protocol";
import { AgentIcon } from "../AgentIcon";
import { FavoriteButton } from "../FavoriteButton";
import { useToast } from "../Toast";
import { ThreadDrawer, ThreadPanel } from "./ThreadSelector";
import { MessageList, type Pending } from "./MessageList";
import { Composer } from "./Composer";

type Props = {
  agent: Agent;
  sessions: SessionSummary[];
  /** null = a fresh thread that is created on the server with its first message */
  session: { id: string; title: string | null; messages: Message[] } | null;
  /** Master Agent only: number of saved outputs in its category */
  masterCount?: number | null;
};

const ERR_TEXT = "לא הצלחנו לקבל תשובה.";
const ERR_IMAGE = "לא הצלחנו ליצור את התמונה.";
const ERR_OFFLINE = "אין כרגע חיבור לאינטרנט.";

// Each thread mounts its own Workspace instance (keyed by session id in the page),
// so no message state can carry over between threads.
export function Workspace({ agent, sessions: initialSessions, session, masterCount = null }: Props) {
  const toast = useToast();
  const [sessions, setSessions] = useState(initialSessions);
  const [sessionId, setSessionId] = useState<string | null>(session?.id ?? null);
  const [title, setTitle] = useState<string | null>(session?.title ?? null);
  const [messages, setMessages] = useState<Message[]>(session?.messages ?? []);
  const [pending, setPending] = useState<Pending>(null);
  const [failure, setFailure] = useState<{ message: string; stopped?: boolean } | null>(() =>
    // A saved user message without an answer (e.g. failure before a refresh) can be retried.
    session?.messages.at(-1)?.role === "user"
      ? { message: agent.is_image_generator ? ERR_IMAGE : ERR_TEXT }
      : null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const intent = useSearchParams().get("intent");
  const [initialFile, setInitialFile] = useState<File | null>(null);

  // "העלאת קובץ" from the dashboard: the file picked there is attached here.
  // Consumed once — the guard survives React's double-invoked effects in development.
  const fileTaken = useRef(false);
  useEffect(() => {
    if (intent !== "upload" || fileTaken.current) return;
    fileTaken.current = true;
    const f = takePendingFile(agent.id);
    if (f) setInitialFile(f);
  }, [intent, agent.id]);
  const sessionIdRef = useRef<string | null>(sessionId);

  const generating = pending !== null;

  function upsertSummary(id: string, t: string | null) {
    setSessions((list) => [
      { id, title: t, updated_at: new Date().toISOString() },
      ...list.filter((x) => x.id !== id),
    ]);
  }

  /** Runs one request against /api/chat. Resolves false if the request was rejected up front. */
  async function run(req: Omit<ChatRequest, "agentId" | "sessionId">, onAccepted?: () => void) {
    if (!navigator.onLine) {
      setFailure({ message: ERR_OFFLINE });
      return false;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setFailure(null);
    setPending({ text: "" });

    let res: Response;
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...req, agentId: agent.id, sessionId: sessionIdRef.current }),
        signal: controller.signal,
      });
    } catch {
      setPending(null);
      if (!controller.signal.aborted) toast(navigator.onLine ? ERR_TEXT : ERR_OFFLINE, "error");
      return false;
    }
    if (!res.ok || !res.body) {
      setPending(null);
      toast(ERR_TEXT, "error");
      return false;
    }
    onAccepted?.();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let completed = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as ChatEvent;
          if (ev.t === "session") {
            if (!sessionIdRef.current) {
              sessionIdRef.current = ev.id;
              setSessionId(ev.id);
              setTitle(ev.title);
              // Keep the URL in sync without remounting this thread.
              window.history.replaceState(null, "", `/agents/${agent.id}?session=${ev.id}`);
              upsertSummary(ev.id, ev.title);
            }
          } else if (ev.t === "delta") {
            text += ev.text;
            setPending({ text });
          } else if (ev.t === "done") {
            completed = true;
            setMessages((list) => [...list, ev.message]);
            if (ev.title) setTitle(ev.title);
            upsertSummary(sessionIdRef.current!, ev.title ?? title);
          } else if (ev.t === "error") {
            setFailure({ message: ev.kind === "image" ? ERR_IMAGE : ERR_TEXT });
          }
        }
      }
    } catch {
      if (controller.signal.aborted) {
        setFailure({ message: "התשובה נעצרה.", stopped: true });
      } else {
        setFailure({ message: agent.is_image_generator ? ERR_IMAGE : ERR_TEXT });
      }
    } finally {
      abortRef.current = null;
      setPending(null);
      if (!completed && !controller.signal.aborted) {
        setFailure((f) => f ?? { message: agent.is_image_generator ? ERR_IMAGE : ERR_TEXT });
      }
    }
    return true;
  }

  async function send(text: string, attachment: Attachment | null): Promise<boolean> {
    const optimistic = newMessage("user", text);
    if (attachment) optimistic.attachment = attachment;
    setMessages((list) => [...list, optimistic]);
    const accepted = await run({ message: text, attachment });
    if (!accepted) setMessages((list) => list.filter((m) => m.id !== optimistic.id));
    return accepted;
  }

  function retry() {
    // Regenerating a completed answer replaces it; a missing answer is simply requested again.
    if (messages.at(-1)?.role === "assistant") {
      const prev = messages;
      setMessages(prev.slice(0, -1));
      run({ message: "", retry: true }).then((ok) => {
        if (!ok) setMessages(prev);
      });
    } else {
      run({ message: "", retry: true });
    }
  }

  async function saveOutput(messageId: string): Promise<boolean> {
    if (!sessionIdRef.current) return false;
    try {
      const res = await fetch("/api/outputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, sessionId: sessionIdRef.current, messageId }),
      });
      const data = (await res.json()) as { ok?: boolean; outputId?: string };
      if (!res.ok || !data.outputId) throw new Error();
      setMessages((list) => list.map((m) => (m.id === messageId ? { ...m, outputId: data.outputId } : m)));
      toast("נשמר בתוצרים");
      return true;
    } catch {
      toast("התוצר לא נשמר.", "error");
      return false;
    }
  }

  function stop() {
    abortRef.current?.abort();
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
    upsertSummary(res.data.id, res.data.title);
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
            <MessageList
              messages={messages}
              pending={pending}
              isImageAgent={agent.is_image_generator}
              failure={failure}
              busy={generating}
              onRetry={retry}
              onSave={saveOutput}
              emptyNote={
                agent.is_master
                  ? masterCount
                    ? `סוכן־על: עונה על בסיס ${masterCount === 1 ? "תוצר שמור אחד" : `${masterCount} תוצרים שמורים`} בקטגוריה "${agent.category}".`
                    : `סוכן־על: עדיין אין תוצרים שמורים בקטגוריה "${agent.category}".`
                  : undefined
              }
            />
          </div>

          <Composer
            onSend={send}
            onStop={stop}
            generating={generating}
            allowFiles={!agent.is_image_generator}
            initialFile={initialFile}
            voiceReady={intent === "voice"}
          />
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
