"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onIdTokenChanged, signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/auth/firebase-client";
import { hasAllowlistConfig, isAllowedUser } from "@/lib/auth/allowed-user";
import { awaitRouterReplace } from "@/lib/nav/await-router-replace";
import { HomeLikeSkeleton } from "@/components/shell/app-loading-skeleton";

type FirebaseAuthGateProps = {
  children: React.ReactNode;
};

function isAbortError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "name" in e &&
    (e as { name: string }).name === "AbortError"
  );
}

export function FirebaseAuthGate({ children }: FirebaseAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const authListenerEpoch = useRef(0);

  const targetNext = useMemo(() => {
    if (!pathname || pathname === "/") return "";
    return `?next=${encodeURIComponent(pathname)}`;
  }, [pathname]);

  const syncServerSession = useCallback(async (idToken: string | null) => {
    const method = idToken ? "POST" : "DELETE";
    try {
      await fetch("/api/auth/session", {
        method,
        headers: idToken ? { "Content-Type": "application/json" } : undefined,
        body: idToken ? JSON.stringify({ idToken }) : undefined,
      });
    } catch (e) {
      if (isAbortError(e)) return;
    }
  }, []);

  useEffect(() => {
    const epoch = ++authListenerEpoch.current;
    const auth = getFirebaseAuth();
    const unsub = onIdTokenChanged(auth, (user) => {
      void (async () => {
        try {
          if (!hasAllowlistConfig()) {
            if (!user) {
              await syncServerSession(null);
              if (epoch !== authListenerEpoch.current) return;
              await awaitRouterReplace(router, `/login${targetNext}`);
              if (epoch !== authListenerEpoch.current) return;
              setStatus("loading");
              return;
            }
            const idToken = await user.getIdToken();
            await syncServerSession(idToken);
            if (epoch !== authListenerEpoch.current) return;
            setStatus("ready");
            return;
          }
          if (isAllowedUser(user)) {
            const idToken = await user?.getIdToken();
            await syncServerSession(idToken ?? null);
            if (epoch !== authListenerEpoch.current) return;
            setStatus("ready");
            return;
          }
          await syncServerSession(null);
          if (epoch !== authListenerEpoch.current) return;
          if (user) {
            await signOut(auth);
          }
          if (epoch !== authListenerEpoch.current) return;
          await awaitRouterReplace(router, `/login${targetNext}`);
          if (epoch !== authListenerEpoch.current) return;
          setStatus("loading");
        } catch (e) {
          if (isAbortError(e)) return;
          console.error("[FirebaseAuthGate] onIdTokenChanged", e);
        }
      })().catch((e) => {
        if (isAbortError(e)) return;
        console.error("[FirebaseAuthGate] onIdTokenChanged (async)", e);
      });
    });
    return () => {
      unsub();
      authListenerEpoch.current++;
    };
  }, [router, syncServerSession, targetNext]);

  if (status !== "ready") {
    return <HomeLikeSkeleton />;
  }

  return <>{children}</>;
}
