"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Home, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/",
    label: "Trang chủ",
    icon: Home,
    match: (p: string) => p === "/" || p.startsWith("/plan"),
  },
  {
    href: "/history",
    label: "Lịch sử",
    icon: History,
    match: (p: string) => p === "/history" || p.startsWith("/history/"),
  },
  {
    href: "/profile",
    label: "Hồ sơ",
    icon: User,
    match: (p: string) => p === "/profile" || p.startsWith("/profile/"),
  },
] as const;

export function MobileMainNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/90 fixed right-0 bottom-0 left-0 z-50 border-t backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Điều hướng chính"
    >
      <div className="mx-auto flex max-w-[430px] items-stretch justify-around gap-1 px-2 pt-1">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "text-muted-foreground flex min-h-11 min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-medium transition-colors",
                active && "bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
