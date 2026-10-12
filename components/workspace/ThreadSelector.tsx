"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MessageSquare, X } from "lucide-react";
import type { SessionSummary } from "@/lib/sessions";

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" });

function ThreadList({
  agentId,
  sessions,
  currentId,
  onNavigate,
}: {
  agentId: string;
  sessions: SessionSummary[];
  currentId: string | null;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <>
      {/* Unique ?new= value per click so every new thread mounts a fresh, empty workspace. */}
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          router.push(`/agents/${agentId}?new=${Date.now()}`);
        }}
        className="mb-3 flex h-12 w-full items-center justify-center gap-2 rounded-button border border-primary text-[15px] font-medium text-primary hover:bg-primary-hover"
      >
        <Plus className="size-5" aria-hidden />
        נושא חדש
      </button>
      {sessions.length > 0 && (
        <ul className="space-y-1" aria-label="נושאים קודמים">
          {sessions.map((s) => {
            const current = s.id === currentId;
            return (
              <li key={s.id}>
                <Link
                  href={`/agents/${agentId}?session=${s.id}`}
                  onClick={onNavigate}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-2 rounded-button px-3 py-2 text-[15px] hover:bg-primary-hover ${
                    current ? "bg-primary-hover font-medium text-primary" : ""
                  }`}
                >
                  <MessageSquare className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{s.title || "נושא ללא כותרת"}</span>
                  <span className="shrink-0 text-[13px] text-secondary">
                    {dateFmt.format(new Date(s.updated_at))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** Narrow side panel, desktop only. */
export function ThreadPanel(props: {
  agentId: string;
  sessions: SessionSummary[];
  currentId: string | null;
}) {
  return (
    <nav
      aria-label="נושאים"
      className="hidden w-64 shrink-0 overflow-y-auto border-e border-border bg-surface p-3 lg:block"
    >
      <ThreadList {...props} />
    </nav>
  );
}

/** Drawer, mobile/tablet. */
export function ThreadDrawer({
  open,
  onClose,
  ...props
}: {
  open: boolean;
  onClose: () => void;
  agentId: string;
  sessions: SessionSummary[];
  currentId: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="threads-title"
      className="mx-auto mb-0 mt-auto max-h-[80dvh] w-full max-w-lg rounded-t-dialog bg-surface p-0 text-ink shadow-soft backdrop:bg-black/30 md:m-auto md:rounded-dialog"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 id="threads-title" className="text-[18px]">
          נושאים
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירה"
          className="flex size-11 items-center justify-center rounded-button hover:bg-primary-hover"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="max-h-[65dvh] overflow-y-auto p-3">
        <ThreadList {...props} onNavigate={onClose} />
      </div>
    </dialog>
  );
}
