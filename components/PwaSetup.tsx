"use client";

import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/useOnline";

/** Registers the service worker (production only) and shows a small offline indicator. */
export function PwaSetup() {
  const online = useOnline();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is a nice-to-have; the app works without it.
    });
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-ink px-4 py-2 text-[14px] text-white"
    >
      <WifiOff className="size-4" aria-hidden />
      אין כרגע חיבור לאינטרנט.
    </div>
  );
}
