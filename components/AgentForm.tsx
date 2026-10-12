"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OUTPUTS_BUCKET, type Agent } from "@/lib/types";
import { normalizeAgent, validateAgent, type AgentErrors, type AgentInput } from "@/lib/agents";
import { AGENT_ICONS, DEFAULT_ICON } from "./AgentIcon";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";

const EMPTY: AgentInput = {
  name: "",
  description: "",
  system_prompt: "",
  category: "",
  icon: DEFAULT_ICON,
  is_favorite: false,
  is_master: false,
  is_image_generator: false,
};

export function AgentForm({ agent, categories }: { agent?: Agent; categories: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<AgentInput>(
    agent
      ? {
          name: agent.name,
          description: agent.description,
          system_prompt: agent.system_prompt,
          category: agent.category,
          icon: agent.icon ?? DEFAULT_ICON,
          is_favorite: agent.is_favorite,
          is_master: agent.is_master,
          is_image_generator: agent.is_image_generator,
        }
      : EMPTY,
  );
  const [errors, setErrors] = useState<AgentErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof AgentInput>(key: K, value: AgentInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateAgent(values);
    setErrors(errs);
    const firstInvalid = Object.keys(errs)[0];
    if (firstInvalid) {
      document.getElementById(`field-${firstInvalid}`)?.focus();
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = normalizeAgent(values);
    const { data, error } = agent
      ? await supabase.from("agents").update(payload).eq("id", agent.id).select("id").single()
      : await supabase.from("agents").insert(payload).select("id").single();
    setSaving(false);
    if (error || !data) {
      toast(navigator.onLine ? "הסוכן לא נשמר. אפשר לנסות שוב." : "אין כרגע חיבור לאינטרנט.", "error");
      return;
    }
    toast(agent ? "השינויים נשמרו" : "הסוכן נוצר");
    router.push(agent ? `/agents/${agent.id}` : "/");
    router.refresh();
  }

  async function onDelete() {
    if (!agent) return;
    setDeleting(true);
    const supabase = createClient();
    // Output files are identified safely through this agent's rows, before the cascade removes them.
    const { data: files } = await supabase
      .from("agent_outputs")
      .select("file_url")
      .eq("agent_id", agent.id)
      .not("file_url", "is", null);
    // sessions + agent_outputs are removed by ON DELETE CASCADE in the DB.
    const { error } = await supabase.from("agents").delete().eq("id", agent.id);
    if (!error && files?.length) {
      await supabase.storage.from(OUTPUTS_BUCKET).remove(files.map((f) => f.file_url as string));
    }
    setDeleting(false);
    if (error) {
      setConfirmDelete(false);
      toast("המחיקה לא הצליחה. אפשר לנסות שוב.", "error");
      return;
    }
    toast("הסוכן נמחק");
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <Field id="name" label="שם הסוכן" error={errors.name} hint="2–60 תווים">
          <input
            id="field-name"
            value={values.name}
            maxLength={60}
            onChange={(e) => set("name", e.target.value)}
            {...aria("name", errors.name)}
            className={inputCls(errors.name)}
          />
        </Field>

        <Field
          id="description"
          label="תיאור קצר"
          error={errors.description}
          hint={`${values.description.length}/180`}
        >
          <input
            id="field-description"
            value={values.description}
            maxLength={180}
            onChange={(e) => set("description", e.target.value)}
            {...aria("description", errors.description)}
            className={inputCls(errors.description)}
          />
        </Field>

        <Field id="category" label="קטגוריה" error={errors.category} hint="בחירה מהרשימה או כתיבת קטגוריה חדשה">
          <input
            id="field-category"
            list="category-options"
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            {...aria("category", errors.category)}
            className={inputCls(errors.category)}
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field
          id="system_prompt"
          label="הנחיות לסוכן"
          error={errors.system_prompt}
          hint="מי הסוכן, איך הוא עונה ומה התחום שלו. לפחות 30 תווים."
        >
          <textarea
            id="field-system_prompt"
            value={values.system_prompt}
            rows={8}
            onChange={(e) => set("system_prompt", e.target.value)}
            {...aria("system_prompt", errors.system_prompt)}
            className={`${inputCls(errors.system_prompt)} h-auto py-3 leading-relaxed`}
          />
        </Field>

        <fieldset>
          <legend className="mb-2 text-[15px] font-medium">אייקון</legend>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
            {Object.entries(AGENT_ICONS).map(([key, { icon: Icon, label }]) => {
              const selected = values.icon === key;
              return (
                <label
                  key={key}
                  className={`flex size-12 cursor-pointer items-center justify-center rounded-button border transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                    selected
                      ? "border-primary bg-primary-hover text-primary"
                      : "border-border bg-surface text-secondary hover:bg-primary-hover"
                  }`}
                >
                  <input
                    type="radio"
                    name="icon"
                    value={key}
                    checked={selected}
                    onChange={() => set("icon", key)}
                    className="sr-only"
                  />
                  <Icon className="size-5" aria-hidden />
                  <span className="sr-only">{label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="divide-y divide-border rounded-card border border-border bg-surface">
          <Toggle
            label="מועדף"
            description="יופיע בראש המסך"
            checked={values.is_favorite}
            onChange={(v) => set("is_favorite", v)}
          />
          <Toggle
            label="סוכן־על"
            description="עונה על בסיס תקצירי התוצרים השמורים באותה קטגוריה"
            checked={values.is_master}
            onChange={(v) => set("is_master", v)}
          />
          <Toggle
            label="סוכן ליצירת תמונות"
            description="הסוכן ייצור תמונות במקום תשובות טקסט"
            checked={values.is_image_generator}
            onChange={(v) => set("is_image_generator", v)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex h-12 items-center gap-2 rounded-button bg-primary px-8 text-[15px] font-medium text-white disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {agent ? "שמירת שינויים" : "שמור"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="h-12 rounded-button border border-border px-6 text-[15px] font-medium hover:bg-primary-hover"
          >
            ביטול
          </button>
          {agent && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ms-auto flex h-12 items-center gap-2 rounded-button px-4 text-[15px] font-medium text-error hover:bg-error/10"
            >
              <Trash2 className="size-5" aria-hidden />
              מחיקת סוכן
            </button>
          )}
        </div>
      </form>

      {agent && (
        <ConfirmDialog
          open={confirmDelete}
          title="למחוק את הסוכן?"
          description="השיחות והתוצרים השייכים לסוכן יימחקו גם הם. לא ניתן לבטל פעולה זו."
          confirmLabel="מחק"
          destructive
          busy={deleting}
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

function inputCls(error?: string) {
  return `h-12 w-full rounded-input border bg-surface px-3 outline-none transition-colors duration-150 focus:border-primary ${
    error ? "border-error" : "border-border"
  }`;
}

function aria(key: string, error?: string) {
  return {
    "aria-invalid": !!error,
    "aria-describedby": `hint-${key}${error ? ` error-${key}` : ""}`,
  };
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`field-${id}`} className="mb-1 block text-[15px] font-medium">
        {label} <span className="text-error" aria-hidden>*</span>
        <span className="sr-only">(חובה)</span>
      </label>
      {children}
      <p id={`hint-${id}`} className="mt-1 text-[13px] text-secondary">
        {hint}
      </p>
      {error && (
        <p id={`error-${id}`} className="mt-1 text-[14px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex-1">
        <label htmlFor={id} className="block font-medium">
          {label}
        </label>
        <p id={`${id}-d`} className="text-[13px] text-secondary">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-d`}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-primary" : "bg-[#b9c0c4]"
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200 ${
            checked ? "start-6" : "start-1"
          }`}
        />
      </button>
    </div>
  );
}
