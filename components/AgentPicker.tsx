"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { Agent } from "@/lib/types";
import { ACCEPT } from "@/lib/files";
import { setPendingFile } from "@/lib/pending-file";
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
  const router = useRouter();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Image agents work from text only, so they are not offered for file upload.
  const list = intent === "upload" ? agents.filter((a) => !a.is_image_generator) : agents;
  const rowCls = "flex min-h-12 cursor-pointer items-center gap-3 rounded-button px-3 py-2 hover:bg-primary-hover";

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
        {list.map((a) => {
          const content = (
            <>
              <AgentIcon name={a.icon} className="size-5 text-primary" />
              <span className="font-medium">{a.name}</span>
              <span className="ms-auto text-[13px] text-secondary">{a.category}</span>
            </>
          );
          return (
            <li key={a.id}>
              {intent === "upload" ? (
                // Choosing the agent opens the file dialog directly (same user gesture).
                <label className={`${rowCls} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary`}>
                  <input
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setPendingFile(a.id, f);
                      onClose();
                      router.push(`/agents/${a.id}?new=${Date.now()}&intent=upload`);
                    }}
                  />
                  {content}
                </label>
              ) : (
                <Link href={`/agents/${a.id}?new=${Date.now()}&intent=voice`} className={rowCls}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
