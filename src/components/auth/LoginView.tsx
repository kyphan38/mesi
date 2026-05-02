"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertCircle } from "lucide-react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getFirebaseAuth } from "@/lib/auth/firebase-client";

type LoginViewProps = {
  appName: string;
  subtitle?: string;
  className?: string;
};

export function LoginView({ appName, subtitle, className }: LoginViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(getFirebaseAuth(), provider);
    } catch (err) {
      const code =
        err !== null && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      const host = typeof window !== "undefined" ? window.location.hostname : "";
      if (code === "auth/unauthorized-domain" && host) {
        setError(
          `This host is not allowed for Firebase Auth (${host}). In Firebase Console → Authentication → Settings → Authorized domains, add your production host (e.g. ${host}) and redeploy if needed.`,
        );
      } else {
        setError(err instanceof Error ? err.message : "Sign-in failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-[100dvh] items-center justify-center bg-background px-6",
        className,
      )}
    >
      <section className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <Image
            src="/branding/mesi-icon.svg"
            alt={`${appName} icon`}
            width={40}
            height={40}
            className="mx-auto h-10 w-10 rounded-xl border border-border/80 bg-muted/40 p-1"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{appName}</h1>
          <p className="text-sm text-muted-foreground">
            {subtitle ?? "Private workspace. Continue with your Google account."}
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          className="h-11 w-full"
          disabled={loading}
          onClick={() => void onGoogleSignIn()}
        >
          {loading ? "Signing in..." : "Continue with Google"}
        </Button>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-left text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
