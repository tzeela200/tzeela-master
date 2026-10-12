"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Agent } from "@/lib/types";
import { AgentIcon } from "./AgentIcon";

// Bottom sheet on mobile, centered dialog on desktop.
export function AgentPicker({
  open,
  title,
  agents,
  intent,
  onClose,
}: {
  open: boolean;
  title: string;
  agents: Agent[];
  intent: "voice" | "upload";
  onClose: () => void;
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
      aria-labelledby="picker-title"
      className="mx-auto mb-0 mt-auto max-h-[80dvh] w-full max-w-lg rounded-t-dialog bg-surface p-0 text-ink shadow-soft backdrop:bg-black/30 md:m-auto md:rounded-dialog"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 id="picker-title" className="text-[18px]">
          {title}
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
      <ul className="max-h-[60dvh] overflow-y-auto p-2">
        {agents.map((a) => (
          <li key={a.id}>
            <Link
              href={`/agents/${a.id}?intent=${intent}`}
              className="flex min-h-12 items-center gap-3 rounded-button px-3 py-2 hover:bg-primary-hover"
            >
              <AgentIcon name={a.icon} className="size-5 text-primary" />
              <span className="font-medium">{a.name}</span>
              <span className="ms-auto text-[13px] text-secondary">{a.category}</span>
            </Link>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
