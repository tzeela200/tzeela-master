"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/Toast";

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/**
 * רכיב 3 — נועל צילום מצב: סופר מסמכים, הערות ומשימות שנסגרו מאז הצילום הקודם,
 * וכותב שורה ביומן. לא משנה שום נתון קיים.
 */
export function SyncButton({
  nicheId,
  lastSnapshotAt,
}: {
  nicheId: string;
  lastSnapshotAt: string | null;
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const sync = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/niches/${nicheId}/snapshot`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "הסנכרון נכשל");
      toast(body.summary || "תמונת המצב עודכנה");
      start(() => router.refresh());
    } catch (err) {
      toast(err instanceof Error ? err.message : "הסנכרון נכשל", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {lastSnapshotAt && (
        <span className="text-[13px] text-secondary">
          סונכרן {dateFmt.format(new Date(lastSnapshotAt))}
        </span>
      )}
      <button
        type="button"
        onClick={sync}
        disabled={busy || pending}
        className="flex min-h-11 items-center gap-2 rounded-button bg-primary px-4 text-[15px] font-medium text-white disabled:opacity-60"
      >
        <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
        {busy ? "מסנכרן…" : "עדכון תמונת מצב"}
      </button>
    </div>
  );
}
