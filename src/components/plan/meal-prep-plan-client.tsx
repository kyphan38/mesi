"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useMesiTaste } from "@/components/providers/MesiTasteProvider";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import type { MealOption } from "@/lib/ai/validators/meals";
import { addDaysToLocalDateKey, localDateKey } from "@/lib/db/plan-intents";
import {
  buildConfirmedPlanPayload,
  incrementIngredientsFromMeals,
  saveConfirmedPlan,
} from "@/lib/db/meals";
import { clearMealPrepDraft, readMealPrepDraft, type MealPrepPlanDraftV1 } from "@/lib/plan/plan-draft";
import { aggregateFromMeals, sumDayTotals } from "@/lib/plan/day-insulin";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { API_SLOT_VI } from "@/lib/plan/slot-labels";
import { InsulinSpikeBadge } from "@/components/plan/insulin-spike-badge";
import { getSupplementTimingHint } from "@/lib/constants/health-presets";
import { primaryNutritionGoalKey } from "@/lib/meal-plan/nutrition-baseline";

const KIND_VI: Record<string, string> = {
  cook_fresh: "Nấu mới",
  reheat: "Hâm lại",
  from_fridge: "Từ tủ lạnh",
};

function supplementReminderFromDraft(draft: MealPrepPlanDraftV1): string {
  const hint = draft.suggestResult.supplement_plan_hint?.trim();
  if (hint) return hint;
  const p = draft.profileSnapshot;
  return p.supplements
    .map((s) => {
      const hint = getSupplementTimingHint(s.id);
      return hint ? `${s.label} — ${hint}` : s.label;
    })
    .join(" • ");
}

export function MealPrepPlanClient() {
  const router = useRouter();
  const { show } = useToast();
  const { refreshTaste } = useMesiTaste();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const draft = mounted ? readMealPrepDraft() : null;

  useEffect(() => {
    if (mounted && draft === null) {
      router.replace("/");
    }
  }, [mounted, draft, router]);

  if (!mounted || draft === null) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">
        Đang mở meal prep…
      </div>
    );
  }

  return <MealPrepSummary draft={draft} onDone={() => router.push("/")} showToast={show} refreshTaste={refreshTaste} />;
}

function MealPrepSummary({
  draft,
  onDone,
  showToast,
  refreshTaste,
}: {
  draft: MealPrepPlanDraftV1;
  onDone: () => void;
  showToast: (msg: string, variant: "success" | "error" | "info") => void;
  refreshTaste: () => Promise<void>;
}) {
  const prepN = draft.prepDayCount;
  const startKey = localDateKey();

  const byDay = useMemo(() => {
    const map = new Map<number, typeof draft.suggestResult.meal_schedule>();
    for (const row of draft.suggestResult.meal_schedule) {
      const arr = map.get(row.day_index) ?? [];
      arr.push(row);
      map.set(row.day_index, arr);
    }
    return map;
  }, [draft.suggestResult.meal_schedule]);

  const [saving, setSaving] = useState(false);
  const primaryGoal = useMemo(
    () => primaryNutritionGoalKey(draft.profileSnapshot.nutritionGoalIds),
    [draft.profileSnapshot.nutritionGoalIds],
  );

  const confirmAll = async () => {
    setSaving(true);
    try {
      const batchId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `prep_${Date.now()}`;
      const prepInstructions = draft.suggestResult.prep_instructions.trim();
      const allMeals: MealOption[] = [];

      for (let day = 1; day <= prepN; day++) {
        const rows = byDay.get(day);
        if (!rows?.length) continue;

        const slots: Parameters<typeof buildConfirmedPlanPayload>[0]["slots"] = {};
        for (const r of rows) {
          const reheated = r.meal_kind !== "cook_fresh";
          slots[r.slot] = { meal: r.meal, is_reheated: reheated };
          allMeals.push(r.meal);
        }

        const meals = Object.values(slots).map((s) => s.meal);
        const dayTotals = sumDayTotals(meals);
        const dayInsulin = aggregateFromMeals(meals);

        const dateKey = addDaysToLocalDateKey(startKey, day - 1);
        const payload = buildConfirmedPlanPayload({
          slots,
          servings: draft.suggestRequest.servings,
          dayTotals,
          dayInsulin,
          supplementReminder: supplementReminderFromDraft(draft),
          waterTargetLiters: draft.profileSnapshot.waterTargetLiters,
          shoppingNote: draft.suggestResult.batch_shopping_list?.join(" · "),
          dateKey,
          is_meal_prep: true,
          prep_batch_id: batchId,
          prep_instructions: prepInstructions,
        });

        await saveConfirmedPlan(payload);
      }

      await incrementIngredientsFromMeals(allMeals);
      clearMealPrepDraft();
      await refreshTaste();
      showToast("Đã lưu kế hoạch meal prep.", "success");
      onDone();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Lưu thất bại", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-background min-h-0 flex-1 pb-24">
      <header className="border-border sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" />
          Trang chủ
        </Link>
        <span className="text-foreground font-semibold">Meal prep</span>
      </header>

      <div className="mx-auto w-full max-w-[430px] space-y-4 px-4 py-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{prepN} ngày · bắt đầu {formatDateKeyVi(startKey)}</CardTitle>
            <CardDescription>Mục tiêu dinh dưỡng: {primaryGoal}</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm whitespace-pre-wrap">
            <p className="text-foreground font-medium">Hướng dẫn prep</p>
            <p>{draft.suggestResult.prep_instructions}</p>
          </CardContent>
        </Card>

        {draft.suggestResult.batch_shopping_list && draft.suggestResult.batch_shopping_list.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Mua thêm (nếu cần)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-muted-foreground list-inside list-disc text-sm">
                {draft.suggestResult.batch_shopping_list.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {Array.from({ length: prepN }, (_, i) => i + 1).map((day) => {
          const rows = byDay.get(day);
          if (!rows?.length) return null;
          const dateKey = addDaysToLocalDateKey(startKey, day - 1);
          const meals = rows.map((r) => r.meal);
          const dayTotals = sumDayTotals(meals);
          const dayInsulin = aggregateFromMeals(meals);

          return (
            <Card key={day}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ngày {day} · {formatDateKeyVi(dateKey)}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  ~{Math.round(dayTotals.calories)} kcal
                  <InsulinSpikeBadge size="sm" value={dayInsulin} />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {rows.map((r, idx) => (
                  <div
                    key={`${r.slot}-${idx}`}
                    className="border-border flex items-start justify-between gap-2 rounded-lg border p-2 text-sm"
                  >
                    <div>
                      <p className="text-muted-foreground text-xs">{API_SLOT_VI[r.slot]}</p>
                      <p className="text-foreground font-medium">{r.meal.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {KIND_VI[r.meal_kind] ?? r.meal_kind} · ~{Math.round(r.meal.calories)} kcal
                      </p>
                    </div>
                    <InsulinSpikeBadge value={r.meal.insulin_spike} />
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        <Button
          type="button"
          className="bg-primary text-primary-foreground min-h-12 w-full font-semibold"
          disabled={saving}
          onClick={() => void confirmAll()}
        >
          {saving ? "Đang lưu…" : "Lưu vào lịch sử"}
        </Button>
      </div>
    </div>
  );
}
