import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  message,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-card bg-surface px-6 py-12 text-center shadow-soft">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-hover text-primary">
        <Icon className="size-7" aria-hidden />
      </div>
      <p className="mb-6 text-[17px]">{message}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="flex h-12 items-center rounded-button bg-primary px-6 text-[15px] font-medium text-white"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
