import { Activity, CircleCheck, CircleDashed, Loader } from "lucide-react";
import type { RoomStatus, NicheHealth } from "@/lib/niche-room";
import { SyncButton } from "./SyncButton";

const HEALTH: Record<NicheHealth, { label: string; dot: string }> = {
  ok: { label: "תקין", dot: "bg-success" },
  warn: { label: "דורש תשומת לב", dot: "bg-accent" },
  down: { label: "לא עובד", dot: "bg-error" },
  unknown: { label: "לא נבדק", dot: "bg-border" },
};

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

function Stage({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof CircleCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <h3 className="mb-2 flex items-center gap-2 text-[15px]">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
        {title}
      </h3>
      {text ? (
        <p className="whitespace-pre-line text-[14px] text-secondary">{text}</p>
      ) : (
        <p className="text-[14px] text-secondary">עדיין לא נכתב</p>
      )}
    </div>
  );
}

export function StatusGroup({
  nicheId,
  status,
  lastSnapshotAt,
}: {
  nicheId: string;
  status: RoomStatus;
  lastSnapshotAt: string | null;
}) {
  const health = HEALTH[status.health] ?? HEALTH.unknown;

  return (
    <section aria-labelledby="status-title" className="rounded-card bg-surface p-5 shadow-soft">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 id="status-title" className="flex-1 text-[18px] md:text-[22px]">
          התמצאות וסטטוס
        </h2>
        <SyncButton nicheId={nicheId} lastSnapshotAt={lastSnapshotAt} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="flex min-h-11 items-center gap-2 rounded-button bg-primary-hover px-3 text-[14px] text-primary">
          <span className={`size-2.5 rounded-full ${health.dot}`} aria-hidden />
          {health.label}
        </span>
        {status.checkedAt && (
          <span className="text-[13px] text-secondary">
            נבדק {dateFmt.format(new Date(status.checkedAt))}
          </span>
        )}
        <span className="ms-auto flex items-center gap-1.5 text-[13px] text-secondary">
          <Activity className="size-4" aria-hidden />
          מפתחות וטוקנים — מצב בלבד, בלי ערכים
        </span>
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:gap-8">
        <Stage icon={CircleCheck} title="גמור ועובד" text={status.done} />
        <Stage icon={Loader} title="בעבודה ובבדיקה" text={status.doing} />
        <Stage icon={CircleDashed} title="עוד לא התחלנו" text={status.todo} />
      </div>
    </section>
  );
}
