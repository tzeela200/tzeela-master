"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logActivity, MAX_PINNED, type Niche } from "@/lib/niches";
import { useToast } from "../Toast";

const inputCls =
  "h-12 w-full rounded-input border border-border bg-surface px-3 text-[15px] outline-none focus:border-primary";

/** Create or edit a niche (or a sub-niche) in a native dialog. */
export function NicheForm({
  open,
  niche,
  parentId,
  niches,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = create */
  niche: Niche | null;
  /** default parent for a new sub-niche */
  parentId?: string | null;
  niches: Niche[];
  onClose: () => void;
  onSaved: (n: Niche) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setError(null);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  // Only top-level niches can be parents (two levels: niche › sub-niche).
  const parents = niches.filter((n) => !n.parent_id && n.id !== niche?.id);
  const pinnedCount = niches.filter((n) => n.pinned && n.id !== niche?.id).length;

  async function submit(form: FormData) {
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const parent = String(form.get("parent") ?? "") || null;
    const pinned = form.get("pinned") === "on";
    if (!name || name.length > 60) {
      setError("שם הנישה צריך להיות בין 1 ל־60 תווים.");
      return;
    }
    if (pinned && pinnedCount >= MAX_PINNED) {
      setError(`אפשר להצמיד לדף הבית עד ${MAX_PINNED} נישות.`);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const values = { name, description, parent_id: parent, pinned };
    const res = niche
      ? await supabase.from("niches").update(values).eq("id", niche.id).select("*").single<Niche>()
      : await supabase.from("niches").insert(values).select("*").single<Niche>();
    setBusy(false);
    if (res.error || !res.data) {
      setError("הנישה לא נשמרה. כדאי לנסות שוב.");
      return;
    }
    if (!niche)
      await logActivity(supabase, {
        action: "create_niche",
        entity_type: "niche",
        entity_id: res.data.id,
        title: `פתחת נישה: ${name}`,
        niche_id: res.data.id,
      });
    toast(niche ? "הנישה עודכנה" : "הנישה נוצרה");
    onSaved(res.data);
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="niche-form-title"
      className="m-auto w-[calc(100%-32px)] max-w-md rounded-dialog bg-surface p-6 text-ink shadow-soft backdrop:bg-black/30"
    >
      <h2 id="niche-form-title" className="mb-4 text-[20px]">
        {niche ? "עריכת נישה" : parentId ? "תת־נישה חדשה" : "נישה חדשה"}
      </h2>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="niche-name" className="mb-1 block text-[15px] font-medium">
              שם
            </label>
            <input
              id="niche-name"
              name="name"
              required
              maxLength={60}
              defaultValue={niche?.name ?? ""}
              placeholder="למשל: AllDent, פיננסי, אישי"
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="niche-desc" className="mb-1 block text-[15px] font-medium">
              תיאור (לא חובה)
            </label>
            <textarea
              id="niche-desc"
              name="description"
              rows={3}
              defaultValue={niche?.description ?? ""}
              className="w-full rounded-input border border-border bg-surface p-3 text-[15px] outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="niche-parent" className="mb-1 block text-[15px] font-medium">
              שייכת לנישה
            </label>
            <select
              id="niche-parent"
              name="parent"
              defaultValue={niche?.parent_id ?? parentId ?? ""}
              className={inputCls}
              disabled={!!niche && niches.some((n) => n.parent_id === niche.id)}
            >
              <option value="">— נישה ראשית —</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <input type="checkbox" name="pinned" defaultChecked={niche?.pinned ?? false} className="size-5 accent-primary" />
            להציג בדף הבית
          </label>
          {error && (
            <p role="alert" className="text-error">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-button border border-border px-5 text-[15px] font-medium hover:bg-primary-hover"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-12 rounded-button bg-primary px-5 text-[15px] font-medium text-white disabled:opacity-60"
            >
              {busy ? "שומר…" : "שמירה"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
