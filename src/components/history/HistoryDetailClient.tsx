"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import { getHealthProfile } from "@/lib/db/firestore";
import { deleteConfirmedMeal, getMealDoc, type MealDocWithId } from "@/lib/db/meals";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { buildCookAgainPayloadFromDoc, writeCookAgainPayload } from "@/lib/plan/cook-again";
import { API_SLOT_VI } from "@/lib/plan/slot-labels";
import { resolveMacroTargets, scaleMacroTargetsByServings } from "@/lib/constants/health-presets";
import { stripLeadingStepNumber } from "@/lib/plan/recipe-step";
import { MacroProgressBars } from "@/components/plan/macro-progress-bars";
import type { HealthProfileDoc } from "@/types/health-profile";

const ALL_API_SLOTS: ApiMealTime[] = ["morning", "lunch", "dinner"];

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
    show("Đã chuyển về trang chủ - kiểm tra nguyên liệu rồi bấm Lên thực đơn.", "info");
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
        <span className="text-foreground text-base font-medium">Chi tiết</span>
      </header>

      <div className="mx-auto w-full max-w-[430px] space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="text-sm font-medium" onClick={() => cookAgain()}>
            Nấu lại
          </Button>
          {d.prep_batch_id ? (
            <Link
              href={`/history/prep/${d.prep_batch_id}`}
              className={buttonVariants({ variant: "outline", className: "text-sm font-medium" })}
            >
              Xem cả batch prep
            </Link>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="text-sm font-medium"
            onClick={() => void removeFromHistory()}
          >
            Xóa khỏi lịch sử
          </Button>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-2">
            <p className="text-muted-foreground text-sm font-normal">{formatDateKeyVi(d.dateKey)}</p>
            <CardTitle className="text-base font-medium leading-snug">Tóm tắt dinh dưỡng</CardTitle>
            <p className="text-foreground mt-1 text-2xl font-medium tabular-nums">
              ~{Math.round(d.dayTotals.calories)} kcal đã lưu
            </p>
          </CardHeader>
          <CardContent>
            <MacroProgressBars totals={d.dayTotals} targets={macroTargetsDay} mode="fullDayTargets" />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <p className="text-foreground text-base font-medium">Các bữa</p>
          <div className="space-y-3">
            {ALL_API_SLOTS.map((slot) => {
              const entry = d.slots[slot];
              if (!entry?.meal) return null;
              return (
                <div
                  key={slot}
                  className="border-border rounded-lg border p-4"
                >
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {API_SLOT_VI[slot]}
                  </p>
                  {entry.is_reheated ? (
                    <p className="text-muted-foreground mt-1 text-xs font-normal">Hâm lại / từ tủ lạnh</p>
                  ) : null}
                  <p className="text-foreground mt-1 text-base font-medium leading-snug">{entry.meal.name}</p>
                  <p className="text-muted-foreground mt-1 text-sm font-normal tabular-nums">
                    ~{Math.round(entry.meal.calories)} kcal · P {Math.round(entry.meal.macros.protein_g)}g · C{" "}
                    {Math.round(entry.meal.macros.carb_g)}g · F {Math.round(entry.meal.macros.fat_g)}g
                  </p>
                  {entry.recipe?.steps?.length ? (
                    <div className="mt-5">
                      <p className="text-muted-foreground mb-3 text-sm font-medium">Các bước</p>
                      <ol className="list-inside list-decimal space-y-3 marker:font-medium">
                        {entry.recipe.steps.map((s, i) => (
                          <li key={i} className="text-foreground text-sm font-normal leading-relaxed">
                            {stripLeadingStepNumber(s)}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {d.shoppingNote ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ghi chú mua sắm</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm whitespace-pre-wrap">{d.shoppingNote}</CardContent>
          </Card>
        ) : null}

        {d.prep_instructions ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Hướng dẫn prep</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm whitespace-pre-wrap">{d.prep_instructions}</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
