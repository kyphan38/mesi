"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import { getHealthProfile } from "@/lib/db/firestore";
import { deleteConfirmedMeal, getMealDoc, type MealDocWithId } from "@/lib/db/meals";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { buildCookAgainPayloadFromDoc, writeCookAgainPayload } from "@/lib/plan/cook-again";
import { API_SLOT_VI } from "@/lib/plan/slot-labels";
import { resolveMacroTargets, scaleMacroTargetsByServings } from "@/lib/constants/health-presets";
import { sumDayTotals } from "@/lib/plan/day-insulin";
import { InsulinSpikeBadge } from "@/components/plan/insulin-spike-badge";
import { MacroProgressBars } from "@/components/plan/macro-progress-bars";
import type { HealthProfileDoc } from "@/types/health-profile";

export function HistoryDetailClient({ docId }: { docId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [row, setRow] = useState<MealDocWithId | null | undefined>(undefined);
  const [healthProfile, setHealthProfile] = useState<HealthProfileDoc | null>(null);

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
    startTransition(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    startTransition(() => {
      void getHealthProfile().then(setHealthProfile);
    });
  }, []);

  const apiSlots = useMemo(() => {
    if (!row) return [] as ApiMealTime[];
    return Object.keys(row.data.slots).filter((k) => row.data.slots[k as ApiMealTime]) as ApiMealTime[];
  }, [row]);

  const selectedMeals = useMemo(() => {
    if (!row) return [];
    return apiSlots.map((s) => row.data.slots[s]!.meal);
  }, [row, apiSlots]);

  const dayTotals = useMemo(() => sumDayTotals(selectedMeals), [selectedMeals]);
  const macroMode = apiSlots.length >= 3 ? "fullDayTargets" : "totalsOnly";
  const macroTargetsDay = useMemo(() => {
    const base = healthProfile ?? ({
      nutritionGoalIds: ["eat_clean_skin"],
    } as Pick<HealthProfileDoc, "nutritionGoalIds" | "macroTargets">);
    const resolved = resolveMacroTargets(base);
    const servings = row?.data.servings ?? 1;
    return scaleMacroTargetsByServings(resolved, servings);
  }, [healthProfile, row]);

  const cookAgain = () => {
    if (!row) return;
    const payload = buildCookAgainPayloadFromDoc(row.id, row.data);
    writeCookAgainPayload(payload);
    router.push("/?cookAgain=1");
    show("Đã chuyển về trang chủ — kiểm tra nguyên liệu rồi bấm Lên thực đơn.", "info");
  };

  const removeFromHistory = async () => {
    if (!row) return;
    const ok =
      typeof window !== "undefined" &&
      window.confirm("Xóa mục này khỏi lịch sử? Hành động không thể hoàn tác.");
    if (!ok) return;
    try {
      await deleteConfirmedMeal(row.id);
      show("Đã xóa.", "success");
      router.push("/history");
    } catch (e) {
      console.error(e);
      show(e instanceof Error ? e.message : "Không xóa được.", "error");
    }
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
        <Link
          href="/history"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
          aria-label="Về lịch sử"
        >
          <ArrowLeft className="size-5 shrink-0" aria-hidden />
          Lịch sử
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
          <Button type="button" variant="outline" onClick={() => void removeFromHistory()}>
            Xóa khỏi lịch sử
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{formatDateKeyVi(d.dateKey)}</CardTitle>
            <CardDescription>
              {macroMode === "fullDayTargets"
                ? `~${Math.round(dayTotals.calories)} kcal`
                : `Tổng các bữa đã chọn · ~${Math.round(dayTotals.calories)} kcal`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MacroProgressBars totals={dayTotals} targets={macroTargetsDay} mode={macroMode} />
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
