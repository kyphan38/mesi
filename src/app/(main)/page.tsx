import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Mesi</h1>
        <p className="text-muted-foreground text-sm">
          Kế hoạch ăn uống — bắt đầu từ hồ sơ sức khỏe và bữa ăn (sắp tới).
        </p>
      </div>
      <nav className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          href="/profile"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "inline-flex min-h-12 w-full justify-center sm:w-auto sm:min-w-[12rem]",
          )}
        >
          Hồ sơ sức khỏe
        </Link>
        <Link
          href="/settings"
          className={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            "inline-flex min-h-12 w-full justify-center sm:w-auto sm:min-w-[12rem]",
          )}
        >
          Cài đặt
        </Link>
      </nav>
    </main>
  );
}
