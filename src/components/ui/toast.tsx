"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

type ToastEntry = { message: string; type: ToastType };

const ToastContext = createContext<
  ((message: string, type?: ToastType) => void) | null
>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastEntry | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(dismiss, 3200);
    return () => window.clearTimeout(id);
  }, [toast, dismiss]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast ? (
        <div
          className={cn(
            "toast-mesi pointer-events-auto fixed bottom-6 right-6 z-[200] flex max-w-[min(360px,calc(100vw-2rem))] items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg sm:right-6",
            toast.type === "success" && "toast-mesi-success",
            toast.type === "error" && "toast-mesi-error",
            toast.type === "info" && "toast-mesi-info",
          )}
          role="status"
        >
          <span aria-hidden className="shrink-0 text-base leading-none opacity-90">
            {toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}
          </span>
          <span className="min-w-0 flex-1">{toast.message}</span>
          <button
            type="button"
            className="shrink-0 rounded-md p-1 opacity-80 hover:opacity-100"
            onClick={dismiss}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return useMemo(
    () => ({
      show: (message: string, type: ToastType = "info") => {
        ctx?.(message, type);
      },
    }),
    [ctx],
  );
}
