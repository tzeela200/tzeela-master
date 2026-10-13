"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { useFileDrop } from "@/lib/useFileDrop";

type Result = {
  ok?: boolean;
  error?: string;
  step?: string;
  skills?: number;
  subfolders?: number;
  folders?: number;
  agentsCreated?: number;
  agentSkills?: number;
  teams?: number;
  roles?: number;
};

const ERRORS: Record<string, string> = {
  migration_missing: "חסרות טבלאות במסד הנתונים. צריך להריץ קודם את קובץ ה-SQL של שלב 0002.",
  bad_bundle: "הקובץ שנבחר אינו קובץ קטלוג תקין (registry-bundle.json).",
  unauthorized: "צריך להתחבר מחדש.",
};

export function RegistryImport() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const { dragging, dropProps } = useFileDrop((f) => onFile(f), { disabled: busy });

  async function onFile(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/import-registry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: text,
      });
      const data = (await res.json().catch(() => ({ error: "import_failed" }))) as Result;
      setResult(data);
      if (data.ok) router.refresh();
    } catch {
      setResult({ error: "import_failed" });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="בחירת קובץ קטלוג"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <div
        {...dropProps}
        className={`flex flex-col items-start gap-3 rounded-card border-2 border-dashed p-4 transition-colors duration-150 sm:flex-row sm:items-center ${
          dragging ? "border-primary bg-primary-hover" : "border-border"
        }`}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex h-12 items-center gap-2 rounded-button bg-primary px-5 text-[15px] font-medium text-white transition-colors duration-150 disabled:opacity-60"
        >
          <Upload className="size-5" aria-hidden />
          {busy ? "מייבא…" : "ייבוא קטלוג סקילים"}
        </button>
        <span className="text-[14px] text-secondary">
          {dragging ? "שחררי כאן" : "או לגרור לכאן את registry-bundle.json"}
        </span>
      </div>
      <div role="status" aria-live="polite" className="mt-4 text-[15px]">
        {result?.ok && (
          <p>
            יובאו {result.skills} סקילים, {result.folders} תיקיות ו-{result.subfolders} תתי־תיקיות.{" "}
            נוצרו {result.agentsCreated} סוכנים חדשים, {result.agentSkills} שיוכי סקיל־סוכן, {result.teams} צוותים ו-
            {result.roles} תפקידים.
          </p>
        )}
        {result && !result.ok && (
          <p className="text-error">
            {ERRORS[result.error ?? ""] ?? `הייבוא נכשל${result.step ? ` (בשלב ${result.step})` : ""}.`}
          </p>
        )}
      </div>
    </div>
  );
}
