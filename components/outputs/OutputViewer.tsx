"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { OutputRow } from "./OutputsArchive";
import { outputBlob, outputText } from "./outputFile";
import { Markdown } from "../Markdown";

/** "פתח": full content of a saved output (markdown answer or image). */
export function OutputViewer({ output, onClose }: { output: OutputRow | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (output && !el.open) el.showModal();
    if (!output && el.open) el.close();
  }, [output]);

  useEffect(() => {
    setText(null);
    setImageUrl(null);
    setFailed(false);
    if (!output) return;
    let alive = true;
    let objectUrl: string | null = null;
    (async () => {
      try {
        if (output.output_type === "image") {
          objectUrl = URL.createObjectURL(await outputBlob(output));
          if (alive) setImageUrl(objectUrl);
        } else {
          const t = await outputText(output);
          if (alive) setText(t);
        }
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [output]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="viewer-title"
      className="m-auto max-h-[90dvh] w-[calc(100%-24px)] max-w-3xl overflow-hidden rounded-dialog bg-surface p-0 text-ink shadow-soft backdrop:bg-black/30"
    >
      {output && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id="viewer-title" className="line-clamp-2 text-[17px]">
                {output.summary_text}
              </h2>
              <p className="text-[13px] text-secondary">
                {output.agentName} · {output.category}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              autoFocus
              aria-label="סגירה"
              className="flex size-11 shrink-0 items-center justify-center rounded-button hover:bg-primary-hover"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">
            {failed ? (
              <p role="alert" className="text-error">
                לא הצלחנו לפתוח את התוצר.
              </p>
            ) : imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- private blob
              <img src={imageUrl} alt={output.summary_text} className="mx-auto max-h-[70dvh] rounded-card" />
            ) : text !== null ? (
              <div className="markdown">
                <Markdown text={text} />
              </div>
            ) : (
              <div className="space-y-2" aria-label="טוען">
                <div className="h-4 w-3/4 animate-pulse rounded bg-border" />
                <div className="h-4 w-full animate-pulse rounded bg-border" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-border" />
              </div>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
