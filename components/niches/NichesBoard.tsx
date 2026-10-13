"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderTree, Pin, Plus, ChevronLeft } from "lucide-react";
import { nicheTree, type Niche } from "@/lib/niches";
import { EmptyState } from "../EmptyState";
import { NicheForm } from "./NicheForm";

export type NicheStats = { projects: number; threads: number; openTasks: number };

export function NichesBoard({ initial, stats }: { initial: Niche[]; stats: Record<string, NicheStats> }) {
  const router = useRouter();
  const [niches, setNiches] = useState(initial);
  const [form, setForm] = useState<{ parentId: string | null } | null>(null);
  const tree = nicheTree(niches);

  const count = (id: string) => stats[id] ?? { projects: 0, threads: 0, openTasks: 0 };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6 flex items-center gap-3">
        <h1 className="flex-1">נישות</h1>
        <button
          type="button"
          onClick={() => setForm({ parentId: null })}
          className="flex h-12 items-center gap-2 rounded-button bg-primary px-5 text-[15px] font-medium text-white"
        >
          <Plus className="size-5" aria-hidden />
          נישה חדשה
        </button>
      </header>
      <p className="mb-6 text-secondary">
        נישה היא תחום בחיים או בעבודה (למשל AllDent, פיננסי, אישי). לכל נישה יש פרויקטים, נושאים ותוצרים משלה, והם
        לא מתערבבים עם נישות אחרות.
      </p>

      {niches.length === 0 ? (
        <EmptyState icon={FolderTree} message="עדיין אין נישות. אפשר להתחיל מהנישה הראשונה." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {tree.map(({ niche, children }) => {
            const c = count(niche.id);
            return (
              <li key={niche.id} className="rounded-card bg-surface p-5 shadow-soft">
                <Link
                  href={`/niches/${niche.id}`}
                  className="group flex items-start gap-2 rounded-button outline-offset-4"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 text-[20px]">
                      <span className="truncate">{niche.name}</span>
                      {niche.pinned && <Pin className="size-4 shrink-0 text-primary" aria-label="מוצגת בדף הבית" />}
                    </h2>
                    {niche.description && <p className="mt-1 line-clamp-2 text-secondary">{niche.description}</p>}
                  </div>
                  <ChevronLeft className="mt-1 size-5 shrink-0 text-secondary group-hover:text-primary" aria-hidden />
                </Link>
                <p className="mt-3 text-[14px] text-secondary">
                  {c.projects} פרויקטים · {c.threads} נושאים · {c.openTasks} משימות פתוחות
                </p>
                {children.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label={`תתי־נישות של ${niche.name}`}>
                    {children.map((ch) => (
                      <li key={ch.id}>
                        <Link
                          href={`/niches/${ch.id}`}
                          className="flex h-9 items-center rounded-full bg-primary-hover px-3 text-[14px] text-primary"
                        >
                          {ch.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setForm({ parentId: niche.id })}
                  className="mt-3 flex h-11 items-center gap-1 rounded-button px-2 text-[14px] text-primary hover:bg-primary-hover"
                >
                  <Plus className="size-4" aria-hidden />
                  תת־נישה
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <NicheForm
        open={form !== null}
        niche={null}
        parentId={form?.parentId ?? null}
        niches={niches}
        onClose={() => setForm(null)}
        onSaved={(n) => {
          setNiches((list) => [...list, n]);
          setForm(null);
          router.refresh();
        }}
      />
    </main>
  );
}
