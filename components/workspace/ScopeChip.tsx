"use client";

import { useEffect, useRef, useState } from "react";
import { FolderTree } from "lucide-react";
import { nichePath, type Niche, type Project, type Scope } from "@/lib/niches";

const selectCls =
  "h-12 w-full rounded-input border border-border bg-surface px-3 text-[15px] outline-none focus:border-primary";

/**
 * Shows which niche/project the thread belongs to, and lets the user change it.
 * The caller decides what "change" means: state for a new thread, an update for a saved one.
 */
export function ScopeChip({
  scope,
  niches,
  projects,
  onChange,
}: {
  scope: Scope;
  niches: Niche[];
  projects: Project[];
  onChange: (next: Scope) => Promise<boolean> | boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [nicheId, setNicheId] = useState(scope.nicheId ?? "");
  const [projectId, setProjectId] = useState(scope.projectId ?? "");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setNicheId(scope.nicheId ?? "");
      setProjectId(scope.projectId ?? "");
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open, scope]);

  const niche = niches.find((n) => n.id === scope.nicheId);
  const project = projects.find((p) => p.id === scope.projectId);
  const label = niche ? `${nichePath(niche, niches)}${project ? ` › ${project.name}` : ""}` : "ללא נישה";
  const nicheProjects = projects.filter((p) => p.niche_id === nicheId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`נישה: ${label}. שינוי`}
        className={`flex h-9 max-w-[45%] shrink-0 items-center gap-1 rounded-full px-3 text-[13px] ${
          niche ? "bg-primary-hover text-primary" : "border border-dashed border-border text-secondary"
        }`}
      >
        <FolderTree className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </button>
      <dialog
        ref={ref}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        aria-labelledby="scope-title"
        className="m-auto w-[calc(100%-32px)] max-w-md rounded-dialog bg-surface p-6 text-ink shadow-soft backdrop:bg-black/30"
      >
        <h2 id="scope-title" className="mb-2 text-[20px]">
          שיוך הנושא
        </h2>
        <p className="mb-4 text-secondary">נושא בנישה מופיע בדף הנישה, ותוצרים שנשמרים ממנו משויכים אליה.</p>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onChange({ nicheId: nicheId || null, projectId: (nicheId && projectId) || null });
            if (ok) setOpen(false);
          }}
        >
          <div>
            <label htmlFor="scope-niche" className="mb-1 block text-[15px] font-medium">
              נישה
            </label>
            <select
              id="scope-niche"
              value={nicheId}
              onChange={(e) => {
                setNicheId(e.target.value);
                setProjectId("");
              }}
              className={selectCls}
            >
              <option value="">ללא נישה</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>
                  {nichePath(n, niches)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="scope-project" className="mb-1 block text-[15px] font-medium">
              פרויקט
            </label>
            <select
              id="scope-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={!nicheId || nicheProjects.length === 0}
              className={`${selectCls} disabled:opacity-60`}
            >
              <option value="">{nicheId && nicheProjects.length === 0 ? "אין פרויקטים בנישה" : "ללא פרויקט"}</option>
              {nicheProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-12 rounded-button border border-border px-5 text-[15px] font-medium hover:bg-primary-hover"
            >
              ביטול
            </button>
            <button type="submit" className="h-12 rounded-button bg-primary px-5 text-[15px] font-medium text-white">
              שמירה
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
