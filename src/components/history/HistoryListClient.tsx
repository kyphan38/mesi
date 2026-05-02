"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { History as HistoryIcon, SmilePlus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import { listConfirmedMealsForHistory, type MealDocWithId } from "@/lib/db/meals";
import { buildHistoryListItems, type HistoryListItem } from "@/lib/history/group-history";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { API_SLOT_VI } from "@/lib/plan/slot-labels";
import { InsulinSpikeBadge } from "@/components/plan/insulin-spike-badge";

function slotChips(slots: MealDocWithId["data"]["slots"]): string[] {
  const out: string[] = [];
  for (const k of Object.keys(slots) as ApiMealTime[]) {
    if (slots[k]?.meal) out.push(API_SLOT_VI[k]);
  }
  return out;
}

function ratingLabel(r: MealDocWithId["data"]["rating"]): string | null {
  if (r === "good") return "Ngon";
  if (r === "neutral") return "BT";
  if (r === "bad") return "Chưa hợp";
  if (r === "skipped") return "—";
  return null;
}

function passesGoodFilter(item: HistoryListItem): boolean {
  if (item.kind === "single") return item.doc.data.rating === "good";
  return item.docs.some((d) => d.data.rating === "good");
}

export function HistoryListClient() {
  const [rows, setRows] = useState<MealDocWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyGood, setOnlyGood] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listConfirmedMealsForHistory({ limit: 100 });
      setRows(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = useMemo(() => buildHistoryListItems(rows), [rows]);
  const filtered = useMemo(
    () => (onlyGood ? items.filter(passesGoodFilter) : items),
    [items, onlyGood],
  );

  return (
    <div className="bg-background min-h-0 flex-1">
      <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
        >
          ← Trang chủ
        </Link>
        <span className="text-foreground inline-flex items-center gap-1 text-lg font-semibold tracking-tight">
          <HistoryIcon className="size-5" />
          Lịch sử
        </span>
        <span className="w-12" />
      </header>

      <div className="mx-auto w-full max-w-[430px] space-y-4 px-4 py-4 pb-10">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">Đánh dấu “ngon” để Mesi học khẩu vị.</p>
          <Button
            type="button"
            variant={onlyGood ? "default" : "outline"}
            size="sm"
            className="gap-1"
            onClick={() => setOnlyGood((x) => !x)}
          >
            <SmilePlus className="size-4" />
            Chỉ món ngon
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground py-10 text-center text-sm">Đang tải…</p>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
            <p className="text-muted-foreground text-sm">
              {onlyGood ? "Chưa có món được đánh dấu ngon." : "Chưa có thực đơn đã lưu."}
            </p>
            <Link href="/" className={buttonVariants({ variant: "secondary" })}>
              Về trang chủ
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              if (item.kind === "single") {
                const d = item.doc;
                const cal = d.data.dayTotals?.calories;
                return (
                  <Link key={d.id} href={`/history/${d.id}`} className="block">
                    <Card className="hover:bg-muted/30 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">{formatDateKeyVi(d.data.dateKey)}</CardTitle>
                            <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                              {typeof cal === "number" ? <span>~{Math.round(cal)} kcal</span> : null}
                              <InsulinSpikeBadge value={d.data.dayInsulin} />
                            </CardDescription>
                          </div>
                          {ratingLabel(d.data.rating) ? (
                            <span className="text-muted-foreground text-xs">{ratingLabel(d.data.rating)}</span>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {slotChips(d.data.slots).map((c) => (
                            <span
                              key={c}
                              className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                        <p className="text-foreground line-clamp-2 text-sm">
                          {Object.values(d.data.slots)
                            .map((s) => s?.meal.name)
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              }

              const first = item.docs[0]!;
              const last = item.docs[item.docs.length - 1]!;
              const calSum = item.docs.reduce((a, b) => a + (b.data.dayTotals?.calories ?? 0), 0);
              return (
                <Link key={item.batchId} href={`/history/prep/${item.batchId}`} className="block">
                  <Card className="hover:bg-muted/30 border-primary/30 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        Meal prep {item.docs.length} ngày — {formatDateKeyVi(first.data.dateKey)} →{" "}
                        {formatDateKeyVi(last.data.dateKey)}
                      </CardTitle>
                      <CardDescription>
                        {calSum > 0 ? `~${Math.round(calSum)} kcal tổng` : "Nhiều bữa đã lưu"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-muted-foreground text-sm">Chạm để xem từng ngày</CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
