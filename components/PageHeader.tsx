import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function PageHeader({ title, backHref }: { title: string; backHref: string }) {
  return (
    <header className="mb-6 flex items-center gap-2">
      <Link
        href={backHref}
        aria-label="חזרה"
        className="-ms-2 flex size-11 items-center justify-center rounded-button hover:bg-primary-hover"
      >
        <ArrowRight className="size-6" aria-hidden />
      </Link>
      <h1 className="text-[24px] md:text-[28px]">{title}</h1>
    </header>
  );
}
