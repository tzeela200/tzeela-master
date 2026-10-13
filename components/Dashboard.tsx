"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Mic, Paperclip, Search, Settings, Bot, MessageSquare, Archive } from "lucide-react";
import { matchesSearch } from "@/lib/agents";
import { AgentGrid, type AgentWithCount } from "./AgentCard";
import { AgentPicker } from "./AgentPicker";
import { EmptyState } from "./EmptyState";
import { DropOverlay } from "./DropOverlay";
import { useToast } from "./Toast";
import { useFileDrop } from "@/lib/useFileDrop";
import { droppedFileProblem } from "@/lib/files";

export type RecentItem = {
  kind: "thread" | "output";
  id: string;
  title: string;
  agentName: string;
  href: string;
  date: string;
};

const MAX_FAVORITES = 5;

export function Dashboard({
  greeting,
  agents,
  recent,
  zones,
}: {
  greeting: string;
  agents: AgentWithCount[];
  recent: RecentItem[];
  /** Niche zones + "your recent actions" (rendered on the server) */
  zones?: React.ReactNode;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState<"voice" | "upload" | null>(null);
  // A file dropped anywhere on the page: same as "העלאת קובץ", then choose the agent.
  const [dropped, setDropped] = useState<File | null>(null);
  const { dragging, dropProps } = useFileDrop(
    (f) => {
      const problem = droppedFileProblem(f);
      if (problem) return toast(problem, "error");
      setDropped(f);
      setPicker("upload");
    },
    { disabled: agents.length === 0 },
  );

  const filtered = useMemo(() => agents.filter((a) => matchesSearch(a, query)), [agents, query]);
  const favorites = useMemo(
    () => agents.filter((a) => a.is_favorite).slice(0, MAX_FAVORITES),
    [agents],
  );
  const searching = query.trim().length > 0;

  return (
    <main className="relative mx-auto min-h-dvh max-w-6xl px-4 py-6 md:px-8 md:py-10" {...dropProps}>
      {dragging && <DropOverlay label="שחררי כאן, ואז בחרי לאיזה סוכן לצרף" />}
      {/* Header */}
      <header className="mb-6 flex items-center gap-3">
        <h1 className="flex-1">{greeting}</h1>
        <Link
          href="/settings"
          aria-label="הגדרות"
          className="flex size-11 items-center justify-center rounded-button text-secondary hover:bg-primary-hover md:hidden"
        >
          <Settings className="size-6" aria-hidden />
        </Link>
      </header>

      <div className="relative mb-6">
        <label htmlFor="agent-search" className="sr-only">
          חיפוש סוכנים
        </label>
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-secondary"
          aria-hidden
        />
        <input
          id="agent-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם, תיאור או קטגוריה"
          className="h-12 w-full rounded-input border border-border bg-surface ps-11 pe-3 outline-none transition-colors duration-150 focus:border-primary"
        />
      </div>

      {/* Quick actions */}
      {!searching && (
        <div className="mb-8 grid grid-cols-3 gap-3">
          <QuickAction href="/agents/new" icon={Plus} label="סוכן חדש" primary />
          <QuickAction
            icon={Mic}
            label="שיחה קולית"
            onClick={() => setPicker("voice")}
            disabled={agents.length === 0}
          />
          <QuickAction
            icon={Paperclip}
            label="העלאת קובץ"
            onClick={() => setPicker("upload")}
            disabled={agents.length === 0}
          />
        </div>
      )}

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          message="עוד אין כאן סוכנים."
          actionLabel="יצירת סוכן ראשון"
          actionHref="/agents/new"
        />
      ) : searching ? (
        <section aria-labelledby="results-title">
          <h2 id="results-title" className="mb-4 text-[18px]">
            תוצאות חיפוש
          </h2>
          <p className="sr-only" role="status">
            {filtered.length ? `נמצאו ${filtered.length} סוכנים` : ""}
          </p>
          {filtered.length ? (
            <AgentGrid agents={filtered} />
          ) : (
            <p role="status" className="rounded-card bg-surface p-6 text-center text-secondary">
              לא נמצאו סוכנים שמתאימים לחיפוש.
            </p>
          )}
        </section>
      ) : (
        <>
          {zones}
          {favorites.length > 0 && (
            <section id="favorites" aria-labelledby="fav-title" className="mb-10 scroll-mt-6">
              <h2 id="fav-title" className="mb-4 text-[18px] md:text-[22px]">
                מועדפים
              </h2>
              <AgentGrid agents={favorites} />
            </section>
          )}

          <section id="all-agents" aria-labelledby="all-title" className="mb-10 scroll-mt-6">
            <h2 id="all-title" className="mb-4 text-[18px] md:text-[22px]">
              כל הסוכנים
            </h2>
            <AgentGrid agents={agents} />
          </section>

          {recent.length > 0 && (
            <section aria-labelledby="recent-title">
              <h2 id="recent-title" className="mb-4 text-[18px] md:text-[22px]">
                עבודה אחרונה
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface shadow-soft">
                {recent.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link
                      href={r.href}
                      className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-primary-hover"
                    >
                      {r.kind === "thread" ? (
                        <MessageSquare className="size-5 shrink-0 text-primary" aria-hidden />
                      ) : (
                        <Archive className="size-5 shrink-0 text-primary" aria-hidden />
                      )}
                      <span className="sr-only">{r.kind === "thread" ? "שיחה:" : "תוצר:"}</span>
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      <span className="shrink-0 text-[13px] text-secondary">{r.agentName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <AgentPicker
        open={picker !== null}
        intent={picker ?? "voice"}
        title={
          picker === "upload"
            ? dropped
              ? `לאיזה סוכן לצרף את "${dropped.name}"?`
              : "לאיזה סוכן לצרף את הקובץ?"
            : "עם איזה סוכן לדבר?"
        }
        agents={agents}
        file={dropped}
        onClose={() => {
          setPicker(null);
          setDropped(null);
        }}
      />
    </main>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  onClick,
  primary,
  disabled,
}: {
  icon: typeof Plus;
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const cls = `flex min-h-20 flex-col items-center justify-center gap-2 rounded-card px-2 py-3 text-[15px] font-medium shadow-soft transition-colors duration-150 disabled:opacity-50 ${
    primary ? "bg-primary text-white" : "bg-surface text-ink hover:bg-primary-hover"
  }`;
  const content = (
    <>
      <Icon className="size-6" aria-hidden />
      {label}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {content}
    </button>
  );
}
