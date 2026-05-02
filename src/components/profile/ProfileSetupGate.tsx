"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getHealthProfile } from "@/lib/db/firestore";

type ProfileSetupGateProps = {
  children: React.ReactNode;
};

/** Runs Firestore check only when route is not already `/profile`. */
function NonProfileGate({ children }: ProfileSetupGateProps) {
  const router = useRouter();
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const doc = await getHealthProfile();
        if (cancelled) return;
        const done = doc?.setupCompletedAt != null && typeof doc.setupCompletedAt === "number";
        if (!done) {
          router.replace("/profile");
        }
      } catch (e) {
        console.error("[ProfileSetupGate]", e);
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (pending) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
        Đang tải…
      </div>
    );
  }

  return <>{children}</>;
}

export function ProfileSetupGate({ children }: ProfileSetupGateProps) {
  const pathname = usePathname();
  const isProfile =
    pathname === "/profile" || (pathname != null && pathname.startsWith("/profile/"));

  if (isProfile) {
    return <>{children}</>;
  }

  return <NonProfileGate>{children}</NonProfileGate>;
}
