"use client";

import { useId, useState } from "react";
import { FileText, Image as ImageIcon, Copy, Check, Download, Share2, Trash2, Eye } from "lucide-react";
import { STATUS_LABELS, type OutputStatus } from "@/lib/types";
import type { OutputRow } from "./OutputsArchive";
import { downloadOutput, outputText, shareOutput } from "./outputFile";
import { useToast } from "../Toast";

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric" });

// Status is conveyed by text + icon-free label, never by color alone.
const STATUS_STYLE: Record<OutputStatus, string> = {
  pending: "border-accent/60 bg-accent/10 text-ink",
  review: "border-secondary/40 bg-bg text-ink",
  done: "border-success/50 bg-success/10 text-ink",
};

export function OutputCard({
  output,
  onOpen,
  onStatus,
  onDelete,
}: {
  output: OutputRow;
  onOpen: () => void;
  onStatus: (s: OutputStatus) => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const statusId = useId();
  const [copied, setCopied] = useState(false);
  const isImage = output.output_type === "image";
  const Icon = isImage ? ImageIcon : FileText;

  async function copy() {
    try {
      if (isImage) {
        await shareOutput(output);
        return;
      }
      await navigator.clipboard.writeText(await outputText(output));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("ההעתקה לא הצליחה.", "error");
    }
  }

  async function share() {
    try {
      const r = await shareOutput(output);
      if (r === "copied") toast("הטקסט הועתק");
    } catch {
      // share sheet dismissed
    }
  }

  async function download() {
    try {
      await downloadOutput(output);
    } catch {
      toast("ההורדה לא הצליחה.", "error");
    }
  }

  const btn =
    "flex size-11 items-center justify-center rounded-button text-secondary transition-colors duration-150 hover:bg-primary-hover hover:text-primary";

  return (
    <article className="rounded-card bg-surface p-4 shadow-soft md:p-5" aria-labelledby={`${statusId}-t`}>
      <div className="mb-2 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-button bg-primary-hover text-primary">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={`${statusId}-t`} className="line-clamp-3 text-[16px] font-medium leading-relaxed">
            <button type="button" onClick={onOpen} className="text-start hover:underline">
              {output.summary_text}
            </button>
          </h2>
          <p className="mt-1 text-[13px] text-secondary">
            {output.agentName} · {output.category} · {dateFmt.format(new Date(output.created_at))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor={statusId} className="sr-only">
            סטטוס
          </label>
          <select
            id={statusId}
            value={output.status}
            onChange={(e) => onStatus(e.target.value as OutputStatus)}
            className={`h-11 rounded-button border px-3 text-[14px] font-medium outline-none focus-visible:outline-2 focus-visible:outline-primary ${STATUS_STYLE[output.status]}`}
          >
            {(Object.keys(STATUS_LABELS) as OutputStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center" role="group" aria-label="פעולות על התוצר">
          <button type="button" onClick={onOpen} className={btn} aria-label="פתח">
            <Eye className="size-5" aria-hidden />
          </button>
          {!isImage && (
            <button type="button" onClick={copy} className={btn} aria-label={copied ? "הועתק" : "העתק"}>
              {copied ? <Check className="size-5 text-success" aria-hidden /> : <Copy className="size-5" aria-hidden />}
            </button>
          )}
          <button type="button" onClick={download} className={btn} aria-label="הורד">
            <Download className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={share} className={btn} aria-label="שתף">
            <Share2 className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={`${btn} hover:!bg-error/10 hover:!text-error`}
            aria-label="מחק"
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}
