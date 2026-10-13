"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Pencil,
  Pin,
  PinOff,
  Archive,
  Plus,
  MessageSquare,
  FileText,
  ListChecks,
  FolderKanban,
  History,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Agent } from "@/lib/types";
import { STATUS_LABELS, type OutputStatus } from "@/lib/types";
import {
  logActivity,
  MAX_PINNED,
  nichePath,
  PROJECT_STATUS_LABEL,
  type Niche,
  type Project,
  type ProjectStatus,
} from "@/lib/niches";
import { AgentPicker } from "../AgentPicker";
import { ConfirmDialog } from "../ConfirmDialog";
import { useToast } from "../Toast";
import { DropOverlay } from "../DropOverlay";
import { useFileDrop } from "@/lib/useFileDrop";
import { droppedFileProblem } from "@/lib/files";
import { NicheForm } from "./NicheForm";

export type NicheThread = {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  projectId: string | null;
  updatedAt: string;
};
export type NicheOutput = {
  id: string;
  summary: string;
  status: OutputStatus;
  projectId: string | null;
  agentName: string;
  createdAt: string;
};
export type NicheTask = { id: string; title: string; status: string; project_id: string | null; updated_at: string };
export type NicheActivity = { id: string; actor: "user" | "agent" | "system"; title: string; created_at: string };

const TASK_STATUS: Record<string, string> = {
  open: "פתוחה",
  queued: "בתור",
  running: "בביצוע",
  waiting: "ממתינה",
  failed: "נכשלה",
};

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" });
const inputCls =
  "h-12 w-full rounded-input border border-border bg-surface px-3 text-[15px] outline-none focus:border-primary";

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof MessageSquare;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card bg-surface p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-5 text-primary" aria-hidden />
        <h2 className="flex-1 text-[18px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function NicheDetail({
  niche: initialNiche,
  niches,
  subNiches,
  projects: initialProjects,
  threads,
  outputs,
  outputsReady,
  tasks: initialTasks,
  activity,
  agents,
  projectFilter,
}: {
  niche: Niche;
  niches: Niche[];
  subNiches: Niche[];
  projects: Project[];
  threads: NicheThread[];
  outputs: NicheOutput[];
  outputsReady: boolean;
  tasks: NicheTask[];
  activity: NicheActivity[];
  agents: Agent[];
  projectFilter: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [niche, setNiche] = useState(initialNiche);
  const [projects, setProjects] = useState(initialProjects);
  const [tasks, setTasks] = useState(initialTasks);
  const [editing, setEditing] = useState(false);
  const [subForm, setSubForm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [picker, setPicker] = useState(false);
  // A file dropped on the niche page opens a new thread in this niche with the file attached.
  const [dropped, setDropped] = useState<File | null>(null);
  const { dragging, dropProps } = useFileDrop((f) => {
    const problem = droppedFileProblem(f);
    if (problem) return toast(problem, "error");
    setDropped(f);
    setPicker(true);
  });
  const [addingProject, setAddingProject] = useState(false);
  const [busy, setBusy] = useState(false);

  const project = projectFilter ? projects.find((p) => p.id === projectFilter) ?? null : null;
  const byProject = <T extends { projectId?: string | null; project_id?: string | null }>(list: T[]) =>
    project ? list.filter((x) => (x.projectId ?? x.project_id) === project.id) : list;
  const visibleProjects = projects.filter((p) => p.status !== "archived");
  const projectName = (id: string | null) => (id ? projects.find((p) => p.id === id)?.name : null);
  const scopeQuery = `&niche=${niche.id}${project ? `&project=${project.id}` : ""}`;

  async function togglePin() {
    const supabase = createClient();
    if (!niche.pinned) {
      const { count } = await supabase.from("niches").select("id", { count: "exact", head: true }).eq("pinned", true);
      if ((count ?? 0) >= MAX_PINNED) {
        toast(`אפשר להצמיד לדף הבית עד ${MAX_PINNED} נישות.`, "error");
        return;
      }
    }
    const { error } = await supabase.from("niches").update({ pinned: !niche.pinned }).eq("id", niche.id);
    if (error) return toast("השינוי לא נשמר.", "error");
    setNiche({ ...niche, pinned: !niche.pinned });
    toast(niche.pinned ? "הוסרה מדף הבית" : "מוצגת בדף הבית");
  }

  async function archive() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("niches").update({ archived: true, pinned: false }).eq("id", niche.id);
    setBusy(false);
    setArchiving(false);
    if (error) return toast("הנישה לא הועברה לארכיון.", "error");
    await logActivity(supabase, {
      action: "archive_niche",
      entity_type: "niche",
      entity_id: niche.id,
      title: `העברת לארכיון: ${niche.name}`,
      niche_id: niche.id,
    });
    toast("הנישה הועברה לארכיון");
    router.push("/niches");
    router.refresh();
  }

  async function addProject(form: FormData) {
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({ niche_id: niche.id, name, description: String(form.get("description") ?? "").trim() })
      .select("*")
      .single<Project>();
    setBusy(false);
    if (error || !data) return toast("הפרויקט לא נשמר.", "error");
    await logActivity(supabase, {
      action: "create_project",
      entity_type: "project",
      entity_id: data.id,
      title: `פתחת פרויקט: ${name}`,
      niche_id: niche.id,
      project_id: data.id,
    });
    setProjects((list) => [data, ...list]);
    setAddingProject(false);
    toast("הפרויקט נוצר");
  }

  async function setProjectStatus(p: Project, status: ProjectStatus) {
    const { error } = await createClient().from("projects").update({ status }).eq("id", p.id);
    if (error) return toast("השינוי לא נשמר.", "error");
    setProjects((list) => list.map((x) => (x.id === p.id ? { ...x, status } : x)));
    if (status === "archived" && project?.id === p.id) router.replace(`/niches/${niche.id}`);
  }

  async function addTask(form: FormData) {
    const title = String(form.get("title") ?? "").trim();
    if (!title) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, niche_id: niche.id, project_id: project?.id ?? null })
      .select("id, title, status, project_id, updated_at")
      .single<NicheTask>();
    if (error || !data) return toast("המשימה לא נשמרה.", "error");
    await logActivity(supabase, {
      action: "create_task",
      entity_type: "task",
      entity_id: data.id,
      title: `הוספת משימה: ${title}`,
      niche_id: niche.id,
      project_id: project?.id ?? null,
    });
    setTasks((list) => [data, ...list]);
  }

  async function completeTask(t: NicheTask) {
    const supabase = createClient();
    const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", t.id);
    if (error) return toast("המשימה לא עודכנה.", "error");
    await logActivity(supabase, {
      action: "complete_task",
      entity_type: "task",
      entity_id: t.id,
      title: `סיימת משימה: ${t.title}`,
      niche_id: niche.id,
      project_id: t.project_id,
    });
    setTasks((list) => list.filter((x) => x.id !== t.id));
    toast("המשימה סומנה כבוצעה");
  }

  const iconBtn = "flex size-11 items-center justify-center rounded-button text-secondary hover:bg-primary-hover";
  const parent = niche.parent_id ? niches.find((n) => n.id === niche.parent_id) : null;

  return (
    <main className="relative mx-auto min-h-dvh max-w-5xl px-4 py-6 md:px-8 md:py-10" {...dropProps}>
      {dragging && <DropOverlay label="שחררי כאן כדי לפתוח נושא חדש עם הקובץ בנישה" />}
      {/* Header */}
      <header className="mb-2 flex items-center gap-1">
        <Link href={parent ? `/niches/${parent.id}` : "/niches"} aria-label="חזרה" className={`-ms-2 ${iconBtn} text-ink`}>
          <ArrowRight className="size-6" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[24px] md:text-[28px]">{nichePath(niche, niches)}</h1>
        <button type="button" onClick={togglePin} aria-label={niche.pinned ? "הסרה מדף הבית" : "הצגה בדף הבית"} className={iconBtn}>
          {niche.pinned ? <PinOff className="size-5" aria-hidden /> : <Pin className="size-5" aria-hidden />}
        </button>
        <button type="button" onClick={() => setEditing(true)} aria-label="עריכת הנישה" className={iconBtn}>
          <Pencil className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={() => setArchiving(true)} aria-label="העברה לארכיון" className={iconBtn}>
          <Archive className="size-5" aria-hidden />
        </button>
      </header>
      {niche.description && <p className="mb-4 text-secondary">{niche.description}</p>}

      {/* Sub-niches */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {subNiches.map((s) => (
          <Link key={s.id} href={`/niches/${s.id}`} className="flex h-9 items-center rounded-full bg-primary-hover px-3 text-[14px] text-primary">
            {s.name}
          </Link>
        ))}
        {!niche.parent_id && (
          <button
            type="button"
            onClick={() => setSubForm(true)}
            className="flex h-9 items-center gap-1 rounded-full border border-dashed border-primary px-3 text-[14px] text-primary"
          >
            <Plus className="size-4" aria-hidden />
            תת־נישה
          </button>
        )}
      </div>

      {/* Primary action */}
      <button
        type="button"
        onClick={() => setPicker(true)}
        className="mb-6 flex h-12 w-full items-center justify-center gap-2 rounded-button bg-primary text-[15px] font-medium text-white md:w-auto md:px-6"
      >
        <Plus className="size-5" aria-hidden />
        {project ? `נושא חדש בפרויקט ${project.name}` : "נושא חדש בנישה"}
      </button>

      {project && (
        <div className="mb-4 flex items-center gap-2 rounded-card bg-primary-hover px-4 py-2 text-primary">
          <FolderKanban className="size-5" aria-hidden />
          <span className="flex-1">מוצג רק הפרויקט: {project.name}</span>
          <Link href={`/niches/${niche.id}`} aria-label="הצגת כל הנישה" className="flex size-11 items-center justify-center rounded-button hover:bg-surface">
            <X className="size-5" aria-hidden />
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Projects */}
        <Section
          icon={FolderKanban}
          title="פרויקטים"
          action={
            <button type="button" onClick={() => setAddingProject((v) => !v)} className="flex h-11 items-center gap-1 rounded-button px-2 text-[14px] text-primary hover:bg-primary-hover">
              <Plus className="size-4" aria-hidden />
              פרויקט
            </button>
          }
        >
          {addingProject && (
            <form
              className="mb-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                addProject(new FormData(e.currentTarget));
              }}
            >
              <label htmlFor="project-name" className="sr-only">
                שם הפרויקט
              </label>
              <input id="project-name" name="name" required maxLength={80} placeholder="שם הפרויקט" className={inputCls} autoFocus />
              <label htmlFor="project-desc" className="sr-only">
                תיאור הפרויקט
              </label>
              <input id="project-desc" name="description" placeholder="תיאור קצר (לא חובה)" className={inputCls} />
              <button type="submit" disabled={busy} className="h-11 rounded-button bg-primary px-4 text-[15px] font-medium text-white disabled:opacity-60">
                יצירה
              </button>
            </form>
          )}
          {visibleProjects.length === 0 ? (
            <p className="text-secondary">אין עדיין פרויקטים בנישה הזו.</p>
          ) : (
            <ul className="space-y-1">
              {visibleProjects.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Link
                    href={project?.id === p.id ? `/niches/${niche.id}` : `/niches/${niche.id}?project=${p.id}`}
                    aria-current={project?.id === p.id ? "true" : undefined}
                    className={`flex min-h-11 min-w-0 flex-1 items-center rounded-button px-2 hover:bg-primary-hover ${project?.id === p.id ? "font-medium text-primary" : ""}`}
                  >
                    <span className="truncate">{p.name}</span>
                    {p.niche_id !== niche.id && (
                      <span className="ms-2 shrink-0 text-[13px] text-secondary">({niches.find((n) => n.id === p.niche_id)?.name})</span>
                    )}
                  </Link>
                  <label htmlFor={`ps-${p.id}`} className="sr-only">
                    סטטוס {p.name}
                  </label>
                  <select
                    id={`ps-${p.id}`}
                    value={p.status}
                    onChange={(e) => setProjectStatus(p, e.target.value as ProjectStatus)}
                    className="h-11 rounded-input border border-border bg-surface px-2 text-[14px]"
                  >
                    {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {PROJECT_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Open tasks */}
        <Section icon={ListChecks} title="משימות פתוחות">
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget;
              addTask(new FormData(f)).then(() => f.reset());
            }}
          >
            <label htmlFor="task-title" className="sr-only">
              משימה חדשה
            </label>
            <input id="task-title" name="title" required maxLength={200} placeholder="משימה חדשה" className={inputCls} />
            <button type="submit" aria-label="הוספת משימה" className="flex size-12 shrink-0 items-center justify-center rounded-button bg-primary text-white">
              <Plus className="size-5" aria-hidden />
            </button>
          </form>
          {byProject(tasks).length === 0 ? (
            <p className="text-secondary">אין משימות פתוחות.</p>
          ) : (
            <ul className="space-y-1">
              {byProject(tasks).map((t) => (
                <li key={t.id} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`סימון "${t.title}" כבוצעה`}
                    onChange={() => completeTask(t)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className={`shrink-0 text-[13px] ${t.status === "failed" ? "font-medium text-error" : "text-secondary"}`}>
                    {TASK_STATUS[t.status] ?? t.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Threads */}
        <Section icon={MessageSquare} title="נושאים">
          {byProject(threads).length === 0 ? (
            <p className="text-secondary">עדיין אין נושאים כאן. &quot;נושא חדש&quot; פותח שיחה עם סוכן ששייכת לנישה.</p>
          ) : (
            <ul className="space-y-1">
              {byProject(threads).map((t) => (
                <li key={t.id}>
                  <Link href={`/agents/${t.agentId}?session=${t.id}`} className="flex min-h-11 items-center gap-2 rounded-button px-2 py-1 hover:bg-primary-hover">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{t.title}</span>
                      <span className="block truncate text-[13px] text-secondary">
                        {t.agentName}
                        {projectName(t.projectId) ? ` · ${projectName(t.projectId)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] text-secondary">{dateFmt.format(new Date(t.updatedAt))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Outputs */}
        <Section icon={FileText} title="תוצרים">
          {!outputsReady ? (
            <p className="text-secondary">שיוך תוצרים לנישה יופעל אחרי הרצת קובץ ה-SQL של שלב 0003.</p>
          ) : byProject(outputs).length === 0 ? (
            <p className="text-secondary">תשובה שנשמרת כתוצר בנושא של הנישה תופיע כאן.</p>
          ) : (
            <ul className="space-y-1">
              {byProject(outputs).map((o) => (
                <li key={o.id}>
                  <Link href={`/outputs?open=${o.id}`} className="flex min-h-11 items-center gap-2 rounded-button px-2 py-1 hover:bg-primary-hover">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.summary}</span>
                      <span className="block truncate text-[13px] text-secondary">
                        {o.agentName} · {STATUS_LABELS[o.status]}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] text-secondary">{dateFmt.format(new Date(o.createdAt))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Activity */}
        {activity.length > 0 && !project && (
          <Section icon={History} title="פעולות אחרונות בנישה">
            <ul className="space-y-2">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-2 text-[15px]">
                  <span className="min-w-0 flex-1">{a.title}</span>
                  <span className="shrink-0 text-[13px] text-secondary">{dateFmt.format(new Date(a.created_at))}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <NicheForm
        open={editing}
        niche={niche}
        niches={niches}
        onClose={() => setEditing(false)}
        onSaved={(n) => {
          setNiche(n);
          setEditing(false);
          router.refresh();
        }}
      />
      <NicheForm
        open={subForm}
        niche={null}
        parentId={niche.id}
        niches={niches}
        onClose={() => setSubForm(false)}
        onSaved={() => {
          setSubForm(false);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={archiving}
        title="להעביר את הנישה לארכיון?"
        description="הנישה תוסתר מהרשימות. הנושאים והתוצרים שלה נשמרים ולא נמחקים."
        confirmLabel="העברה לארכיון"
        busy={busy}
        onConfirm={archive}
        onCancel={() => setArchiving(false)}
      />
      <AgentPicker
        open={picker}
        title={
          dropped
            ? `לאיזה סוכן לצרף את "${dropped.name}"?`
            : project
              ? `נושא חדש ב${project.name}: בחירת סוכן`
              : `נושא חדש ב${niche.name}: בחירת סוכן`
        }
        agents={agents}
        intent={dropped ? "upload" : "chat"}
        file={dropped}
        extraQuery={scopeQuery}
        onClose={() => {
          setPicker(false);
          setDropped(null);
        }}
      />
    </main>
  );
}
