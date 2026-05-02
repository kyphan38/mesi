"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, History as HistoryIcon, SmilePlus, Trash2, UtensilsCrossed } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import { deleteConfirmedMeal, listConfirmedMealsForHistory, type MealDocWithId } from "@/lib/db/meals";
import { getUserFriendlyFirestoreMessage } from "@/lib/db/firestore-errors";
import { buildHistoryListItems, type HistoryListItem } from "@/lib/history/group-history";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { API_SLOT_VI } from "@/lib/plan/slot-labels";

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
        <div className="flex gap-2">
          <div className="bg-muted h-6 w-14 animate-pulse rounded-full" />
          <div className="bg-muted h-6 w-14 animate-pulse rounded-full" />
        </div>
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

  const deleteEntry = useCallback(
    async (docId: string) => {
      const ok =
        typeof window !== "undefined" && window.confirm("Xóa mục này khỏi lịch sử? Không thể hoàn tác.");
      if (!ok) return;
      try {
        await deleteConfirmedMeal(docId);
        await refresh();
      } catch (e) {
        console.error(e);
        setLoadError(getUserFriendlyFirestoreMessage(e));
      }
    },
    [refresh],
  );

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
      <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-medium"
          aria-label="Về trang chủ"
        >
          <ArrowLeft className="size-5 shrink-0" aria-hidden />
          Trang chủ
        </Link>
        <span className="text-foreground inline-flex items-center gap-1 text-xl font-medium leading-tight">
          <HistoryIcon className="size-5" />
          Lịch sử
        </span>
        <span className="w-12" />
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
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">Đánh dấu “ngon” để Mesi học khẩu vị.</p>
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
                const cal = d.data.dayTotals?.calories;
                return (
                  <div key={d.id} className="flex items-stretch gap-2">
                    <Link href={`/history/${d.id}`} className="min-w-0 flex-1">
                      <Card className="hover:bg-muted/30 h-full transition-colors duration-150">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                          <CardTitle className="text-sm font-medium leading-snug">
                                {formatDateKeyVi(d.data.dateKey)}
                              </CardTitle>
                          <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
                                {typeof cal === "number" ? <span>~{Math.round(cal)} kcal</span> : null}
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
                                className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                          <p className="text-foreground line-clamp-2 text-base font-medium leading-snug">
                            {Object.values(d.data.slots)
                              .map((s) => s?.meal.name)
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="text-muted-foreground active:bg-destructive/10 active:text-destructive h-11 w-11 shrink-0 self-center"
                      aria-label="Xóa khỏi lịch sử"
                      onClick={(e) => {
                        e.preventDefault();
                        void deleteEntry(d.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
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
