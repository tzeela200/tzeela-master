"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

type ToastKind = "success" | "error";
type ToastState = { id: number; message: string; kind: ToastKind } | null;

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    setToast({ id: Date.now(), message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8"
      >
        {toast && (
          <div
            key={toast.id}
            className="flex items-center gap-2 rounded-button bg-ink px-4 py-3 text-[15px] text-white shadow-soft"
          >
            {toast.kind === "success" ? (
              <CheckCircle2 className="size-5 text-[#9fd4b4]" aria-hidden />
            ) : (
              <AlertCircle className="size-5 text-[#f0a3a3]" aria-hidden />
            )}
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
