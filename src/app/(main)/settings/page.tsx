"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy `/settings` - merged into Profile; preserve bookmarks. */
export default function SettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profile#settings");
  }, [router]);

  return (
    <div className="text-muted-foreground flex min-h-[40vh] flex-1 items-center justify-center px-4 text-sm">
      Đang chuyển đến Hồ sơ…
    </div>
  );
}
