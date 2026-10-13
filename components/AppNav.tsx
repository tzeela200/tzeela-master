"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bot, Star, Archive, Settings, FolderTree } from "lucide-react";

const MOBILE_ITEMS = [
  { href: "/", label: "בית", icon: Home },
  { href: "/niches", label: "נישות", icon: FolderTree },
  { href: "/outputs", label: "תוצרים", icon: Archive },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

const DESKTOP_ITEMS = [
  { href: "/", label: "בית", icon: Home },
  { href: "/niches", label: "נישות", icon: FolderTree },
  { href: "/#all-agents", label: "כל הסוכנים", icon: Bot },
  { href: "/#favorites", label: "מועדפים", icon: Star },
  { href: "/outputs", label: "תוצרים", icon: Archive },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href.includes("#")) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-border bg-surface px-4 py-6 md:flex">
      <Link href="/" className="mb-8 flex h-11 items-center px-3 text-2xl font-bold text-primary">
        צאלה
      </Link>
      <nav aria-label="ניווט ראשי">
        <ul className="space-y-1">
          {DESKTOP_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-11 items-center gap-3 rounded-button px-3 text-[15px] transition-colors duration-150 hover:bg-primary-hover ${
                    active ? "bg-primary-hover font-medium text-primary" : "text-ink"
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  // The workspace owns the full screen on mobile (composer must stay reachable).
  if (pathname.startsWith("/agents/") && !pathname.endsWith("/edit") && pathname !== "/agents/new") {
    return null;
  }
  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {MOBILE_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[13px] ${
                  active ? "font-medium text-primary" : "text-secondary"
                }`}
              >
                <Icon className="size-6" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
