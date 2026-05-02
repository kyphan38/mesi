"use client";

import { ToastProvider } from "@/components/ui/toast";

export function ToastLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
