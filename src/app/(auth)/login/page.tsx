import { Suspense } from "react";
import { LoginClientPage } from "@/app/(auth)/login/LoginClientPage";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <LoginClientPage />
    </Suspense>
  );
}
