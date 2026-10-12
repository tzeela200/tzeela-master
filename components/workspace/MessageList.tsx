"use client";

import { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, Share2, RotateCcw, Download, MessageSquare, AlertCircle } from "lucide-react";
import type { AttachmentKind, Message } from "@/lib/types";
import { fileIcon } from "./AttachmentPreview";
import { createClient } from "@/lib/supabase/client";
import { GENERATED_BUCKET } from "@/lib/chat-protocol";

export type Pending = { text: string } | null;

type Props = {
  messages: Message[];
  pending: Pending;
  isImageAgent: boolean;
  /** Shown under the conversation when the last user message has no answer. */
  failure: { message: string; stopped?: boolean } | null;
  busy: boolean;
  onRetry: () => void;
};

export function MessageList({ messages, pending, isImageAgent, failure, busy, onRetry }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending?.text.length, failure]);

  if (messages.length === 0 && !pending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center text-secondary">
        <MessageSquare className="mb-3 size-8 text-primary" aria-hidden />
        <p>זה נושא חדש. אפשר להתחיל לכתוב.</p>
      </div>
    );
  }

  const lastAssistantIdx = messages.findLastIndex((m) => m.role === "assistant");

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <ol className="space-y-5" aria-label="שיחה">
        {messages.map((m, i) => (
          <MessageItem
            key={m.id}
            message={m}
            canRetry={!busy && i === lastAssistantIdx && i === messages.length - 1}
            onRetry={onRetry}
          />
        ))}
        {pending && (
          <li className="flex justify-end" aria-live="polite">
            {pending.text ? (
              <div className="markdown max-w-[92%] rounded-card bg-surface px-4 py-3 text-ink shadow-soft">
                <Markdown text={pending.text} />
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-card bg-surface px-4 py-3 text-secondary shadow-soft">
                <span className="thinking-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
                {isImageAgent ? "יוצרת תמונה..." : "חושב..."}
              </div>
            )}
          </li>
        )}
      </ol>

      {failure && !pending && (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-end gap-3 rounded-card border border-border bg-surface px-4 py-3"
        >
          <span className="flex items-center gap-2 text-[15px]">
            <AlertCircle className={`size-5 ${failure.stopped ? "text-secondary" : "text-error"}`} aria-hidden />
            {failure.message}
          </span>
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="flex h-11 items-center gap-2 rounded-button bg-primary px-4 text-[15px] font-medium text-white disabled:opacity-60"
          >
            <RotateCcw className="size-4" aria-hidden />
            נסה שוב
          </button>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div dir="auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

function MessageItem({
  message,
  canRetry,
  onRetry,
}: {
  message: Message;
  canRetry: boolean;
  onRetry: () => void;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <li className="flex flex-col items-start gap-1">
        <span className="sr-only">את:</span>
        {message.attachment && <AttachmentChip name={message.attachment.name} kind={message.attachment.kind} path={message.attachment.kind === "image" ? message.attachment.path : undefined} />}
        {message.content && (
          <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-card bg-primary px-4 py-3 leading-relaxed text-white">
            <span dir="auto">{message.content}</span>
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="flex flex-col items-end">
      <span className="sr-only">הסוכן:</span>
      {message.imageUrl ? (
        <GeneratedImage path={message.imageUrl} />
      ) : (
        <div className="markdown max-w-[92%] break-words rounded-card bg-surface px-4 py-3 text-ink shadow-soft">
          <Markdown text={message.content} />
        </div>
      )}
      <MessageActions message={message} canRetry={canRetry} onRetry={onRetry} />
    </li>
  );
}

function AttachmentChip({ name, kind, path }: { name: string; kind: AttachmentKind; path?: string }) {
  const Icon = fileIcon(kind);
  return (
    <div className="flex max-w-[85%] items-center gap-2 rounded-input border border-border bg-surface px-3 py-2">
      {path ? <AttachedImage path={path} /> : <Icon className="size-5 shrink-0 text-primary" aria-hidden />}
      <span className="sr-only">קובץ מצורף:</span>
      <span className="truncate text-[14px]" dir="auto">
        {name}
      </span>
    </div>
  );
}

function AttachedImage({ path }: { path: string }) {
  const { url } = useSignedUrl(path);
  // eslint-disable-next-line @next/next/no-img-element -- private signed URL
  return url ? <img src={url} alt="" className="size-12 shrink-0 rounded-md object-cover" /> : <span className="size-12 shrink-0 animate-pulse rounded-md bg-border" />;
}

function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    createClient()
      .storage.from(GENERATED_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) setFailed(true);
        else setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return { url, failed };
}

function GeneratedImage({ path }: { path: string }) {
  const { url, failed } = useSignedUrl(path);
  if (failed) {
    return <p className="rounded-card bg-surface px-4 py-3 text-secondary shadow-soft">לא הצלחנו להציג את התמונה.</p>;
  }
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- private signed URL, not optimizable
    <img
      src={url}
      alt="תמונה שנוצרה על ידי הסוכן"
      className="aspect-square w-full max-w-sm rounded-card bg-surface object-cover shadow-soft"
    />
  ) : (
    <div className="aspect-square w-full max-w-sm animate-pulse rounded-card bg-border" aria-label="טוען תמונה" />
  );
}

async function imageBlob(path: string) {
  const { data, error } = await createClient().storage.from(GENERATED_BUCKET).download(path);
  if (error || !data) throw error ?? new Error("download failed");
  return data;
}

function MessageActions({
  message,
  canRetry,
  onRetry,
}: {
  message: Message;
  canRetry: boolean;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isImage = !!message.imageUrl;

  async function copy() {
    try {
      if (isImage && message.imageUrl) {
        const blob = await imageBlob(message.imageUrl);
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      } else {
        await navigator.clipboard.writeText(message.content);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — nothing else to do
    }
  }

  async function share() {
    try {
      if (isImage && message.imageUrl) {
        const blob = await imageBlob(message.imageUrl);
        const file = new File([blob], "image.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
          return;
        }
        download();
        return;
      }
      if (navigator.share) {
        await navigator.share({ text: message.content });
      } else {
        await copy();
      }
    } catch {
      // user cancelled the share sheet
    }
  }

  async function download() {
    if (!message.imageUrl) return;
    try {
      const blob = await imageBlob(message.imageUrl);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tzeela-${message.id.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // ignore
    }
  }

  const btn =
    "flex size-11 items-center justify-center rounded-button text-secondary transition-colors duration-150 hover:bg-primary-hover hover:text-primary";

  return (
    <div className="mt-1 flex items-center gap-0.5" role="group" aria-label="פעולות על התשובה">
      <button type="button" onClick={copy} className={btn} aria-label={copied ? "הועתק" : "העתק"}>
        {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
      <button type="button" onClick={share} className={btn} aria-label="שתף">
        <Share2 className="size-4" aria-hidden />
      </button>
      {isImage && (
        <button type="button" onClick={download} className={btn} aria-label="הורד">
          <Download className="size-4" aria-hidden />
        </button>
      )}
      {canRetry && (
        <button type="button" onClick={onRetry} className={btn} aria-label="נסה שוב">
          <RotateCcw className="size-4" aria-hidden />
        </button>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "הועתק" : ""}
      </span>
    </div>
  );
}
