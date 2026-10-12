"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow up to ~8 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  async function submit() {
    const value = text.trim();
    if (!value || disabled) return;
    const ok = await onSend(value);
    if (ok) setText("");
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-border bg-surface px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
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
          className="max-h-[200px] min-h-12 flex-1 resize-none rounded-input border border-border bg-bg px-3 py-3 leading-normal outline-none transition-colors duration-150 focus:border-primary"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          aria-label="שלח"
          className="flex size-12 shrink-0 items-center justify-center rounded-button bg-primary text-white transition-opacity duration-150 disabled:opacity-50"
        >
          <SendHorizontal className="size-5 -scale-x-100" aria-hidden />
        </button>
      </div>
    </form>
  );
}
