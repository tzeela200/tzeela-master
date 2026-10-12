"use client";

import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";

// Human message + retry. Never shows technical details to the user.
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <AlertCircle className="mb-4 size-10 text-error" aria-hidden />
      <h1 className="mb-2 text-[22px]">משהו השתבש</h1>
      <p className="mb-6 text-secondary">
        {typeof navigator !== "undefined" && !navigator.onLine
          ? "אין כרגע חיבור לאינטרנט."
          : "לא הצלחנו לטעון את העמוד."}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex h-12 items-center gap-2 rounded-button bg-primary px-6 text-[15px] font-medium text-white"
        >
          <RotateCcw className="size-4" aria-hidden />
          נסה שוב
        </button>
        <Link
          href="/"
          className="flex h-12 items-center rounded-button border border-border px-6 text-[15px] font-medium hover:bg-primary-hover"
        >
          לדף הבית
        </Link>
      </div>
    </main>
  );
}
