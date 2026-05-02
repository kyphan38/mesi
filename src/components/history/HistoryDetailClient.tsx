"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import { getMealDoc, type MealDocWithId } from "@/lib/db/meals";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { buildCookAgainPayloadFromDoc, writeCookAgainPayload } from "@/lib/plan/cook-again";
import { API_SLOT_VI } from "@/lib/plan/slot-labels";
import { macroCaloriePercents, sumDayTotals, aggregateFromMeals } from "@/lib/plan/day-insulin";
import { InsulinSpikeBadge } from "@/components/plan/insulin-spike-badge";

function MacroBars({
  pct,
  totals,
}: {
  pct: { p: number; c: number; f: number };
  totals: { protein_g: number; carb_g: number; fat_g: number };
}) {
  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-blue-500" style={{ width: `${pct.p}%` }} />
        <div className="bg-amber-500" style={{ width: `${pct.c}%` }} />
        <div className="bg-rose-400" style={{ width: `${pct.f}%` }} />
      </div>
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>P {Math.round(totals.protein_g)}g</span>
        <span>C {Math.round(totals.carb_g)}g</span>
        <span>F {Math.round(totals.fat_g)}g</span>
      </div>
    </div>
  );
}

export function HistoryDetailClient({ docId }: { docId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [row, setRow] = useState<MealDocWithId | null | undefined>(undefined);

  const load = useCallback(async () => {
    setRow(undefined);
    try {
      const d = await getMealDoc(docId);
      setRow(d);
    } catch (e) {
      console.error(e);
      setRow(null);
    }
  }, [docId]);

  useEffect(() => {
    void load();
  }, [load]);

  const apiSlots = useMemo(() => {
    if (!row) return [] as ApiMealTime[];
    return Object.keys(row.data.slots).filter((k) => row.data.slots[k as ApiMealTime]) as ApiMealTime[];
  }, [row]);

  const selectedMeals = useMemo(() => {
    if (!row) return [];
    return apiSlots.map((s) => row.data.slots[s]!.meal);
  }, [row, apiSlots]);

  const dayTotals = useMemo(() => sumDayTotals(selectedMeals), [selectedMeals]);
  const dayInsulin = useMemo(() => aggregateFromMeals(selectedMeals), [selectedMeals]);
  const macroPct = useMemo(() => macroCaloriePercents(dayTotals), [dayTotals]);

  const cookAgain = () => {
    if (!row) return;
    const payload = buildCookAgainPayloadFromDoc(row.id, row.data);
    writeCookAgainPayload(payload);
    router.push("/?cookAgain=1");
    show("Đã chuyển về trang chủ - kiểm tra nguyên liệu rồi bấm Lên thực đơn.", "info");
  };

  if (row === undefined) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">Đang tải…</div>
    );
  }

  if (row === null) {
    return (
      <div className="mx-auto max-w-[430px] space-y-4 px-4 py-8 text-center">
        <p className="text-muted-foreground text-sm">Không tìm thấy bữa ăn này.</p>
        <Link href="/history" className={buttonVariants({ variant: "secondary" })}>
          Về lịch sử
        </Link>
      </div>
    );
  }

  const d = row.data;

  return (
    <div className="bg-background min-h-0 flex-1 pb-24">
      <header className="border-border sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link href="/history" className="text-muted-foreground hover:text-foreground text-sm">
          ← Lịch sử
        </Link>
        <span className="text-foreground font-semibold">Chi tiết</span>
      </header>

      <div className="mx-auto w-full max-w-[430px] space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => cookAgain()}>
            Nấu lại
          </Button>
          {d.prep_batch_id ? (
            <Link
              href={`/history/prep/${d.prep_batch_id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Xem cả batch prep
            </Link>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{formatDateKeyVi(d.dateKey)}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              ~{Math.round(dayTotals.calories)} kcal · Insulin:
              <InsulinSpikeBadge value={dayInsulin} />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MacroBars pct={macroPct} totals={dayTotals} />
          </CardContent>
        </Card>

        <div className="space-y-2">
          <p className="text-foreground text-sm font-medium">Từng bữa</p>
          {apiSlots.map((slot) => {
            const entry = d.slots[slot];
            if (!entry?.meal) return null;
            return (
              <Card key={slot}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{API_SLOT_VI[slot]}</CardTitle>
                  {entry.is_reheated ? (
                    <CardDescription>Hâm lại / từ tủ lạnh</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-foreground font-medium">{entry.meal.name}</p>
                  <p className="text-muted-foreground text-xs">{entry.meal.description}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">~{Math.round(entry.meal.calories)} kcal</span>
                    <InsulinSpikeBadge value={entry.meal.insulin_spike} />
                  </div>
                  {entry.recipe?.steps?.length ? (
                    <div>
                      <p className="text-foreground mb-1 font-medium">Các bước</p>
                      <ol className="text-muted-foreground list-inside list-decimal space-y-1">
                        {entry.recipe.steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {d.shoppingNote ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ghi chú mua sắm</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">{d.shoppingNote}</CardContent>
          </Card>
        ) : null}

        {d.prep_instructions ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Hướng dẫn prep</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm whitespace-pre-wrap">
              {d.prep_instructions}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
