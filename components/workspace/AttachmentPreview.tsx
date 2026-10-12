"use client";

import { FileText, FileSpreadsheet, Image as ImageIcon, X, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { formatBytes, kindOf } from "@/lib/files";
import type { AttachmentKind } from "@/lib/types";
import type { AttachmentState } from "./useAttachment";

export function fileIcon(kind: AttachmentKind | null) {
  if (kind === "image") return ImageIcon;
  if (kind === "csv" || kind === "xlsx") return FileSpreadsheet;
  return FileText;
}

export function AttachmentPreview({
  state,
  onRemove,
  onReplace,
}: {
  state: AttachmentState;
  onRemove: () => void;
  onReplace: () => void;
}) {
  const Icon = fileIcon(kindOf(state.name));
  const isError = state.status === "error";

  return (
    <div
      className={`mx-auto mb-2 flex max-w-3xl items-center gap-3 rounded-input border px-3 py-2 ${
        isError ? "border-error bg-error/5" : "border-border bg-bg"
      }`}
      role={isError ? "alert" : undefined}
    >
      {state.status === "ready" && state.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img src={state.previewUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
      ) : (
        <Icon className={`size-6 shrink-0 ${isError ? "text-error" : "text-primary"}`} aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium" dir="auto">
          {state.name}
        </p>
        <p className={`text-[13px] ${isError ? "text-error" : "text-secondary"}`} aria-live="polite">
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
      {isError && (
        <button
          type="button"
          onClick={onReplace}
          className="flex h-11 items-center gap-1 rounded-button px-3 text-[14px] font-medium text-primary hover:bg-primary-hover"
        >
          <RefreshCw className="size-4" aria-hidden />
          החלפת קובץ
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="הסרת הקובץ"
        className="flex size-11 shrink-0 items-center justify-center rounded-button text-secondary hover:bg-primary-hover"
      >
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}
