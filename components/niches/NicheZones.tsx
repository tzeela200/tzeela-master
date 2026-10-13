import Link from "next/link";
import { FolderTree, Plus, History } from "lucide-react";

export type NicheZone = {
  id: string;
  name: string;
  projects: number;
  threads: number;
  openTasks: { id: string; title: string; status: string }[];
  openTaskCount: number;
  recent: { id: string; title: string; date: string }[];
};

export type UserActivity = { id: string; title: string; date: string };

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" });

/** Dashboard: one zone per pinned niche, then "what you did lately". */
export function NicheZones({ zones, activity }: { zones: NicheZone[]; activity: UserActivity[] }) {
  return (
    <>
      <section aria-labelledby="zones-title" className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <h2 id="zones-title" className="flex-1 text-[18px] md:text-[22px]">
            הנישות שלי
          </h2>
          <Link href="/niches" className="flex h-11 items-center rounded-button px-3 text-[15px] text-primary hover:bg-primary-hover">
            כל הנישות
          </Link>
        </div>
        {zones.length === 0 ? (
          <Link
            href="/niches"
            className="flex min-h-20 items-center gap-3 rounded-card border border-dashed border-primary bg-surface px-5 py-4 text-primary hover:bg-primary-hover"
          >
            <FolderTree className="size-6 shrink-0" aria-hidden />
            <span>פתחי נישות (AllDent, פיננסי, אישי…) וסמני &quot;להציג בדף הבית&quot; כדי לראות כאן את המשימות והפעולות של כל אחת.</span>
          </Link>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {zones.map((z) => (
              <li key={z.id} className="flex flex-col rounded-card bg-surface p-5 shadow-soft">
                <Link href={`/niches/${z.id}`} className="mb-1 text-[20px] font-medium hover:text-primary">
                  {z.name}
                </Link>
                <p className="mb-3 text-[14px] text-secondary">
                  {z.projects} פרויקטים · {z.threads} נושאים · {z.openTaskCount} משימות פתוחות
                </p>
                <h3 className="mb-1 text-[15px] font-medium">משימות פתוחות</h3>
                {z.openTasks.length === 0 ? (
                  <p className="mb-3 text-[14px] text-secondary">אין משימות פתוחות.</p>
                ) : (
                  <ul className="mb-3 space-y-1 text-[15px]">
                    {z.openTasks.map((t) => (
                      <li key={t.id} className="flex gap-2">
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        {t.status === "failed" && <span className="shrink-0 text-[13px] font-medium text-error">נכשלה</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <h3 className="mb-1 text-[15px] font-medium">פעולות אחרונות</h3>
                {z.recent.length === 0 ? (
                  <p className="mb-3 text-[14px] text-secondary">עדיין אין פעולות.</p>
                ) : (
                  <ul className="mb-3 space-y-1 text-[14px] text-secondary">
                    {z.recent.map((r) => (
                      <li key={r.id} className="flex gap-2">
                        <span className="min-w-0 flex-1 truncate">{r.title}</span>
                        <span className="shrink-0">{dateFmt.format(new Date(r.date))}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={`/niches/${z.id}`}
                  className="mt-auto flex h-11 items-center gap-1 self-start rounded-button px-2 text-[14px] text-primary hover:bg-primary-hover"
                >
                  <Plus className="size-4" aria-hidden />
                  נושא או משימה
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activity.length > 0 && (
        <section aria-labelledby="my-activity-title" className="mb-10">
          <h2 id="my-activity-title" className="mb-4 flex items-center gap-2 text-[18px] md:text-[22px]">
            <History className="size-5 text-primary" aria-hidden />
            הפעולות האחרונות שלך
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface shadow-soft">
            {activity.map((a) => (
              <li key={a.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 truncate">{a.title}</span>
                <span className="shrink-0 text-[13px] text-secondary">{dateFmt.format(new Date(a.date))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
