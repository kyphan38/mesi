"use client";

import { ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MealDocWithId } from "@/lib/db/meals";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { cn } from "@/lib/utils";

export function RatingPromptBanner({
  doc,
  busy,
  onRate,
  onSkip,
}: {
  doc: MealDocWithId | null;
  busy: boolean;
  onRate: (r: "good" | "neutral" | "bad") => void;
  onSkip: () => void;
}) {
  if (!doc) return null;

  return (
    <div
      className={cn(
        "border-border bg-muted/50 flex flex-col gap-3 rounded-xl border p-4",
        busy && "pointer-events-none opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-foreground text-sm font-medium">Bữa {formatDateKeyVi(doc.data.dateKey)} thế nào?</p>
          <p className="text-muted-foreground text-xs">Chạm để giúp Mesi hiểu khẩu vị của bạn.</p>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          aria-label="Bỏ qua đánh giá"
          onClick={() => onSkip()}
          disabled={busy}
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          disabled={busy}
          onClick={() => onRate("good")}
        >
          <ThumbsUp className="size-4" />
          Ngon
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onRate("neutral")}>
          Bình thường
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={busy}
          onClick={() => onRate("bad")}
        >
          <ThumbsDown className="size-4" />
          Chưa hợp
        </Button>
      </div>
    </div>
  );
}
