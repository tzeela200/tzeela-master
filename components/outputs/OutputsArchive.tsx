"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Search, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OUTPUTS_BUCKET, STATUS_LABELS, type AgentOutput, type OutputStatus } from "@/lib/types";
import { EmptyState } from "../EmptyState";
import { ConfirmDialog } from "../ConfirmDialog";
import { useToast } from "../Toast";
import { OutputCard } from "./OutputCard";
import { OutputViewer } from "./OutputViewer";

export type OutputRow = AgentOutput & { agentName: string };

const DATE_RANGES = {
  all: { label: "כל התאריכים", days: null },
  today: { label: "היום", days: 1 },
  week: { label: "7 הימים האחרונים", days: 7 },
  month: { label: "30 הימים האחרונים", days: 30 },
} as const;
type DateRange = keyof typeof DATE_RANGES;

export function OutputsArchive({
  initial,
  agents,
  openId,
}: {
  initial: OutputRow[];
  agents: { id: string; name: string }[];
  openId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [agent, setAgent] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<OutputStatus | "">("");
  const [range, setRange] = useState<DateRange>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [viewing, setViewing] = useState<OutputRow | null>(() => initial.find((r) => r.id === openId) ?? null);
  const [deleting, setDeleting] = useState<OutputRow | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  useEffect(() => setRows(initial), [initial]);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category))).sort((a, b) => a.localeCompare(b, "he")),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const days = DATE_RANGES[range].days;
    const since = days ? Date.now() - days * 86_400_000 : 0;
    return rows.filter(
      (r) =>
        (!q || [r.summary_text, r.category, r.agentName].some((f) => f.toLowerCase().includes(q))) &&
        (!agent || r.agent_id === agent) &&
        (!category || r.category === category) &&
        (!status || r.status === status) &&
        (!since || new Date(r.created_at).getTime() >= since),
    );
  }, [rows, query, agent, category, status, range]);

  const activeFilters = [agent, category, status, range !== "all" ? range : ""].filter(Boolean).length;

  async function changeStatus(row: OutputRow, next: OutputStatus) {
    const prev = row.status;
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    const { error } = await createClient().from("agent_outputs").update({ status: next }).eq("id", row.id);
    if (error) {
      setRows((list) => list.map((r) => (r.id === row.id ? { ...r, status: prev } : r)));
      toast("השינוי לא נשמר.", "error");
      return;
    }
    toast(`הסטטוס עודכן ל"${STATUS_LABELS[next]}"`);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    const supabase = createClient();
    const { error } = await supabase.from("agent_outputs").delete().eq("id", deleting.id);
    if (!error && deleting.file_url) {
      await supabase.storage.from(OUTPUTS_BUCKET).remove([deleting.file_url]);
    }
    setBusyDelete(false);
    if (error) {
      toast("המחיקה לא הצליחה.", "error");
    } else {
      setRows((list) => list.filter((r) => r.id !== deleting.id));
      toast("התוצר נמחק");
      router.refresh();
    }
    setDeleting(null);
  }

  const selectCls =
    "h-12 w-full rounded-input border border-border bg-surface px-3 text-[15px] outline-none focus:border-primary";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="mb-6">תוצרים</h1>

      {initial.length === 0 ? (
        <EmptyState icon={Archive} message="עדיין לא שמרת תוצרים." actionLabel="חזרה לסוכנים" actionHref="/" />
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="output-search" className="sr-only">
                חיפוש תוצרים
              </label>
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-secondary"
                aria-hidden
              />
              <input
                id="output-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש בתקציר, קטגוריה או שם סוכן"
                className="h-12 w-full rounded-input border border-border bg-surface ps-11 pe-3 outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              aria-controls="output-filters"
              className="relative flex h-12 shrink-0 items-center gap-2 rounded-button border border-border bg-surface px-4 text-[15px] font-medium hover:bg-primary-hover"
            >
              <SlidersHorizontal className="size-5" aria-hidden />
              <span className="hidden sm:inline">סינון</span>
              {activeFilters > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[12px] text-white">
                  {activeFilters}
                  <span className="sr-only"> מסננים פעילים</span>
                </span>
              )}
            </button>
          </div>

          <div
            id="output-filters"
            hidden={!showFilters}
            className="mb-6 grid grid-cols-1 gap-3 rounded-card bg-surface p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="text-[13px] text-secondary">
              סוכן
              <select value={agent} onChange={(e) => setAgent(e.target.value)} className={selectCls}>
                <option value="">כל הסוכנים</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[13px] text-secondary">
              קטגוריה
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
                <option value="">כל הקטגוריות</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[13px] text-secondary">
              סטטוס
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OutputStatus | "")}
                className={selectCls}
              >
                <option value="">כל הסטטוסים</option>
                {(Object.keys(STATUS_LABELS) as OutputStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[13px] text-secondary">
              תאריך
              <select value={range} onChange={(e) => setRange(e.target.value as DateRange)} className={selectCls}>
                {(Object.keys(DATE_RANGES) as DateRange[]).map((k) => (
                  <option key={k} value={k}>
                    {DATE_RANGES[k].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="sr-only" role="status">
            {`${filtered.length} תוצרים`}
          </p>
          {filtered.length === 0 ? (
            <p className="rounded-card bg-surface p-6 text-center text-secondary">
              לא נמצאו תוצרים שמתאימים לחיפוש.
            </p>
          ) : (
            <ul className="space-y-3">
              {filtered.map((r) => (
                <li key={r.id}>
                  <OutputCard
                    output={r}
                    onOpen={() => setViewing(r)}
                    onStatus={(s) => changeStatus(r, s)}
                    onDelete={() => setDeleting(r)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <OutputViewer output={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="למחוק את התוצר?"
        description="התוצר והקובץ שלו יימחקו. לא ניתן לבטל פעולה זו."
        confirmLabel="מחק"
        destructive
        busy={busyDelete}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </main>
  );
}
