"use client";

import { useEffect } from "react";
import { HealthProfileForm } from "@/components/profile/HealthProfileForm";

export default function ProfilePage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#settings") return;
    const id = window.setTimeout(() => {
      document.getElementById("settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col">
      <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex shrink-0 items-center justify-center border-b px-4 py-3 backdrop-blur">
        <h1 className="text-foreground text-xl font-semibold leading-tight tracking-tight">Hồ sơ</h1>
      </header>
      <HealthProfileForm redirectAfterSave showIntro={false} />
    </div>
  );
}
