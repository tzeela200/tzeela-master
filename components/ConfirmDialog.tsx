"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Native <dialog> gives focus trapping, Escape handling and focus restore for free.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "ביטול",
  destructive,
  busy,
  onConfirm,
  onCancel,
}: Props) {
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
        onCancel();
      }}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
      className="m-auto w-[calc(100%-32px)] max-w-md rounded-dialog bg-surface p-6 text-ink shadow-soft backdrop:bg-black/30"
    >
      <h2 id="confirm-title" className="mb-2 text-[20px]">
        {title}
      </h2>
      <p id="confirm-desc" className="mb-6 text-secondary">
        {description}
      </p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="h-12 rounded-button border border-border px-5 text-[15px] font-medium hover:bg-primary-hover"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`h-12 rounded-button px-5 text-[15px] font-medium text-white disabled:opacity-60 ${
            destructive ? "bg-error" : "bg-primary"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
