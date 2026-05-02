"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listMealsByPrepBatchId, type MealDocWithId } from "@/lib/db/meals";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { InsulinSpikeBadge } from "@/components/plan/insulin-spike-badge";

export function HistoryPrepBatchClient({ batchId }: { batchId: string }) {
  const [docs, setDocs] = useState<MealDocWithId[] | null | undefined>(undefined);

  const load = useCallback(async () => {
    setDocs(undefined);
    try {
      const rows = await listMealsByPrepBatchId(batchId);
      setDocs(rows);
    } catch (e) {
      console.error(e);
      setDocs(null);
    }
  }, [batchId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (docs === undefined) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">Đang tải…</div>
    );
  }

  if (docs === null || docs.length === 0) {
    return (
      <div className="mx-auto max-w-[430px] space-y-4 px-4 py-8 text-center">
        <p className="text-muted-foreground text-sm">Không tìm thấy batch meal prep.</p>
        <Link href="/history" className={buttonVariants({ variant: "secondary" })}>
          Về lịch sử
        </Link>
      </div>
    );
  }

  const first = docs[0]!;
  const last = docs[docs.length - 1]!;
  const prepText = first.data.prep_instructions?.trim();

  return (
    <div className="bg-background min-h-0 flex-1 pb-24">
      <header className="border-border sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link href="/history" className="text-muted-foreground hover:text-foreground text-sm">
          ← Lịch sử
        </Link>
        <span className="text-foreground font-semibold">Meal prep</span>
      </header>

      <div className="mx-auto w-full max-w-[430px] space-y-4 px-4 py-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {docs.length} ngày · {formatDateKeyVi(first.data.dateKey)} → {formatDateKeyVi(last.data.dateKey)}
            </CardTitle>
            <CardDescription>Từng ngày được lưu riêng — chạm để xem chi tiết.</CardDescription>
          </CardHeader>
          {prepText ? (
            <CardContent className="text-muted-foreground text-sm whitespace-pre-wrap">{prepText}</CardContent>
          ) : null}
        </Card>

        <div className="space-y-2">
          {docs.map((d) => (
            <Link key={d.id} href={`/history/${d.id}`} className="block">
              <Card className="hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{formatDateKeyVi(d.data.dateKey)}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    ~{Math.round(d.data.dayTotals.calories)} kcal
                    <InsulinSpikeBadge value={d.data.dayInsulin} />
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground line-clamp-2 text-sm">
                  {Object.values(d.data.slots)
                    .map((s) => s?.meal.name)
                    .filter(Boolean)
                    .join(" · ")}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
