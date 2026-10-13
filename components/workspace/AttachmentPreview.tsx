"use client";

import { FileText, FileSpreadsheet, Image as ImageIcon, X, Loader2, AlertCircle } from "lucide-react";
import { formatBytes, kindOf } from "@/lib/files";
import type { AttachmentKind } from "@/lib/types";
import type { AttachmentState } from "./useAttachment";

export function fileIcon(kind: AttachmentKind | null) {
  if (kind === "image") return ImageIcon;
  if (kind === "csv" || kind === "xlsx") return FileSpreadsheet;
  return FileText;
}

/** The files waiting to be sent with the next message. */
export function AttachmentList({
  items,
  onRemove,
  onClear,
}: {
  items: AttachmentState[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (!items.length) return null;
  const ready = items.filter((x) => x.status === "ready").length;
  const busy = items.filter((x) => x.status === "processing").length;
  const failed = items.length - ready - busy;

  return (
    <div className="mx-auto mb-2 max-w-3xl">
      {items.length > 1 && (
        <div className="mb-1 flex items-center gap-2 text-[13px] text-secondary">
          <p className="flex-1" aria-live="polite">
            {items.length} קבצים · {ready} מוכנים
            {busy ? ` · ${busy} בעיבוד` : ""}
            {failed ? ` · ${failed} עם בעיה (לא יישלחו)` : ""}
          </p>
          <button type="button" onClick={onClear} className="flex h-9 items-center rounded-button px-2 text-primary hover:bg-primary-hover">
            הסרת הכל
          </button>
        </div>
      )}
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {items.map((state) => (
          <li key={state.id}>
            <AttachmentRow state={state} onRemove={() => onRemove(state.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AttachmentRow({ state, onRemove }: { state: AttachmentState; onRemove: () => void }) {
  const Icon = fileIcon(kindOf(state.name));
  const isError = state.status === "error";

  return (
    <div
      className={`flex items-center gap-3 rounded-input border px-3 py-1.5 ${
        isError ? "border-error bg-error/5" : "border-border bg-bg"
      }`}
      role={isError ? "alert" : undefined}
    >
      {state.status === "ready" && state.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img src={state.previewUrl} alt="" className="size-9 shrink-0 rounded-md object-cover" />
      ) : (
        <Icon className={`size-5 shrink-0 ${isError ? "text-error" : "text-primary"}`} aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium" dir="auto">
          {state.name}
        </p>
        <p className={`text-[13px] ${isError ? "text-error" : "text-secondary"}`}>
          {state.status === "processing" && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              מעבדת את הקובץ…
            </span>
          )}
          {state.status === "ready" && `${formatBytes(state.size)} · מוכן לשליחה`}
          {state.status === "error" && (
            <span className="inline-flex items-center gap-1">
              <AlertCircle className="size-3.5" aria-hidden />
              {state.message}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`הסרת ${state.name}`}
        className="flex size-10 shrink-0 items-center justify-center rounded-button text-secondary hover:bg-primary-hover"
      >
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}
