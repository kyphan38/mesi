"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SmilePlus, UtensilsCrossed } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import { listConfirmedMealsForHistory, type MealDocWithId } from "@/lib/db/meals";
import { getUserFriendlyFirestoreMessage } from "@/lib/db/firestore-errors";
import { buildHistoryListItems, type HistoryListItem } from "@/lib/history/group-history";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { aggregateFromMeals, insulinSpikeAbbrev } from "@/lib/plan/day-insulin";
import { API_SLOT_VI } from "@/lib/plan/slot-labels";

const SLOT_ORDER: ApiMealTime[] = ["morning", "lunch", "dinner"];

function ratingLabel(r: MealDocWithId["data"]["rating"]): string | null {
  if (r === "good") return "Ngon";
  if (r === "neutral") return "BT";
  if (r === "bad") return "Chưa hợp";
  if (r === "skipped") return "-";
  return null;
}

function passesGoodFilter(item: HistoryListItem): boolean {
  if (item.kind === "single") return item.doc.data.rating === "good";
  return item.docs.some((d) => d.data.rating === "good");
}

function HistoryCardSkeleton() {
  return (
    <Card className="overflow-hidden border-transparent">
      <CardHeader className="pb-2">
        <div className="bg-muted h-5 w-48 animate-pulse rounded-md" />
        <div className="bg-muted mt-2 h-4 w-32 animate-pulse rounded-md" />
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="bg-muted h-10 w-full animate-pulse rounded-md" />
      </CardContent>
    </Card>
  );
}

export function HistoryListClient() {
  const router = useRouter();
  const [rows, setRows] = useState<MealDocWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyGood, setOnlyGood] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await listConfirmedMealsForHistory({ limit: 100 });
      setRows(r);
    } catch (e) {
      console.error(e);
      setLoadError(getUserFriendlyFirestoreMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  const items = useMemo(() => buildHistoryListItems(rows), [rows]);
  const filtered = useMemo(
    () => (onlyGood ? items.filter(passesGoodFilter) : items),
    [items, onlyGood],
  );

  const showFilterRow = rows.length >= 1;

  return (
    <div className="bg-background min-h-0 flex-1">
      <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex shrink-0 items-center justify-center border-b px-4 py-3 backdrop-blur">
        <span className="text-foreground text-xl font-medium leading-tight">Lịch sử</span>
      </header>

      <div className="mx-auto w-full max-w-[430px] space-y-4 px-4 py-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        {loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Không tải được lịch sử</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{loadError}</span>
              <Button type="button" variant="secondary" size="sm" className="mt-1 w-fit" onClick={() => void refresh()}>
                Thử lại
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {showFilterRow ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant={onlyGood ? "default" : "outline"}
              size="sm"
              className="min-h-11 gap-1"
              disabled={loading || !!loadError}
              onClick={() => setOnlyGood((x) => !x)}
            >
              <SmilePlus className="size-4" />
              Chỉ món ngon
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <HistoryCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 && !loadError ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 px-2 text-center">
            <UtensilsCrossed
              className="text-muted-foreground/50 size-16 h-16 w-16 shrink-0"
              aria-hidden
              strokeWidth={1.25}
            />
            {rows.length === 0 ? (
              <>
                <p className="text-foreground text-lg font-medium leading-snug">Chưa có thực đơn nào</p>
                <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">Lên plan bữa đầu tiên ngay!</p>
                <Button type="button" className="min-h-11" onClick={() => router.push("/")}>
                  Lên thực đơn
                </Button>
              </>
            ) : (
              <>
                <p className="text-foreground text-lg font-medium leading-snug">Chưa có món được đánh dấu ngon</p>
                <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
                  Đánh giá “Ngon” sau khi ăn để Mesi nhớ khẩu vị của bạn.
                </p>
                <Link href="/" className={buttonVariants({ variant: "secondary" })}>
                  Về trang chủ
                </Link>
              </>
            )}
          </div>
        ) : loadError ? null : (
          <div className="space-y-3">
            {filtered.map((item) => {
              if (item.kind === "single") {
                const d = item.doc;
                const dt = d.data.dayTotals;
                const meals = Object.values(d.data.slots)
                  .map((s) => s?.meal)
                  .filter((m): m is NonNullable<typeof m> => m != null);
                const insulin = aggregateFromMeals(meals);
                const iAbbrev = insulinSpikeAbbrev(insulin);
                const macroLine =
                  dt != null ? (
                    <span className="text-muted-foreground">
                      ~{Math.round(dt.calories)} kcal · P {Math.round(dt.protein_g)} · C {Math.round(dt.carb_g)} · F{" "}
                      {Math.round(dt.fat_g)} · I {iAbbrev}
                    </span>
                  ) : null;
                return (
                  <Link key={d.id} href={`/history/${d.id}`} className="block">
                    <Card className="hover:bg-muted/30 transition-colors duration-150">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-sm font-medium leading-snug">
                              {formatDateKeyVi(d.data.dateKey)}
                            </CardTitle>
                            <CardDescription className="mt-1 text-xs leading-snug tabular-nums">
                              {macroLine}
                            </CardDescription>
                          </div>
                          {ratingLabel(d.data.rating) ? (
                            <span className="text-muted-foreground shrink-0 text-xs">{ratingLabel(d.data.rating)}</span>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1.5 pt-0 text-sm">
                        {SLOT_ORDER.map((slot) => {
                          const name = d.data.slots[slot]?.meal?.name?.trim();
                          if (!name) return null;
                          return (
                            <p key={slot} className="text-foreground leading-snug">
                              <span className="text-muted-foreground font-medium">{API_SLOT_VI[slot]}:</span>{" "}
                              <span className="line-clamp-2">{name}</span>
                            </p>
                          );
                        })}
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
                  <Card className="hover:bg-muted/30 border-primary/30 transition-colors duration-150">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium leading-snug">
                        Meal prep {item.docs.length} ngày - {formatDateKeyVi(first.data.dateKey)} →{" "}
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
