"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Square, Paperclip } from "lucide-react";
import type { Attachment } from "@/lib/types";
import { ACCEPT } from "@/lib/files";
import { useToast } from "../Toast";
import { useAttachment } from "./useAttachment";
import { AttachmentPreview } from "./AttachmentPreview";
import { VoiceButton } from "./VoiceButton";

export function Composer({
  onSend,
  onStop,
  generating,
  allowFiles,
  initialFile,
  voiceReady,
}: {
  onSend: (text: string, attachment: Attachment | null) => Promise<boolean>;
  onStop: () => void;
  /** An answer is being produced — the send button becomes "stop". */
  generating: boolean;
  /** Image agents work from text prompts only. */
  allowFiles: boolean;
  /** File chosen on the dashboard before opening this workspace. */
  initialFile?: File | null;
  /** Opened via "שיחה קולית": focus and highlight the microphone. */
  voiceReady?: boolean;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);
  const { state: file, attach, clear } = useAttachment();

  // Auto-grow up to ~8 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    // Scrollbar only once the field reaches its max height
    el.style.overflowY = el.scrollHeight > 200 ? "auto" : "hidden";
  }, [text]);

  useEffect(() => {
    if (initialFile) attach(initialFile);
  }, [initialFile, attach]);

  useEffect(() => {
    if (voiceReady) micRef.current?.focus();
  }, [voiceReady]);

  const fileReady = file?.status === "ready";
  const fileBusy = file?.status === "processing";
  const canSend = !generating && !fileBusy && (text.trim().length > 0 || fileReady);

  async function submit() {
    if (!canSend) return;
    const ok = await onSend(text.trim(), fileReady ? file.attachment : null);
    if (ok) {
      setText("");
      clear();
    }
    ref.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Desktop: Enter sends, Shift+Enter is a new line. Touch keyboards keep Enter as a new line.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (e.key === "Enter" && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const iconBtn =
    "flex size-12 shrink-0 items-center justify-center rounded-button text-secondary transition-colors duration-150 hover:bg-primary-hover hover:text-primary disabled:opacity-50";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-border bg-surface px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
    >
      {file && (
        <AttachmentPreview state={file} onRemove={clear} onReplace={() => fileRef.current?.click()} />
      )}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) attach(f);
          e.target.value = "";
        }}
      />
      <div className="mx-auto flex max-w-3xl items-end gap-1">
        {allowFiles && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={generating}
            aria-label="צירוף קובץ"
            className={iconBtn}
          >
            <Paperclip className="size-5" aria-hidden />
          </button>
        )}
        <VoiceButton
          ref={micRef}
          disabled={generating}
          highlight={voiceReady}
          onText={(t) => setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${t}` : t))}
          onMessage={(m, kind) => toast(m, kind)}
        />
        <label htmlFor="composer" className="sr-only">
          הודעה
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="מה רוצים לעשות?"
          dir="auto"
          className="max-h-[200px] min-h-12 min-w-0 flex-1 resize-none rounded-input border border-border bg-bg px-3 py-3 leading-normal outline-none transition-colors duration-150 focus:border-primary"
        />
        {generating ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="עצור"
            className="flex size-12 shrink-0 items-center justify-center rounded-button border border-primary text-primary"
          >
            <Square className="size-4 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="שלח"
            className="flex size-12 shrink-0 items-center justify-center rounded-button bg-primary text-white transition-opacity duration-150 disabled:opacity-50"
          >
            <SendHorizontal className="size-5 -scale-x-100" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}
