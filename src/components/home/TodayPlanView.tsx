"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InsulinSpikeBadge } from "@/components/plan/insulin-spike-badge";
import { MacroProgressBars } from "@/components/plan/macro-progress-bars";
import { resolveMacroTargets, scaleMacroTargetsByServings } from "@/lib/constants/health-presets";
import { deleteConfirmedPlansForDateKey } from "@/lib/db/meals";
import { localDateKey } from "@/lib/db/plan-intents";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { API_SLOT_VI } from "@/lib/plan/slot-labels";
import type { MealDocWithId } from "@/lib/db/meals";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import type { HealthProfileDoc } from "@/types/health-profile";

function randomFunFactFromPlan(doc: MealDocWithId["data"]): string {
  const facts: string[] = [];
  for (const slot of Object.keys(doc.slots) as ApiMealTime[]) {
    const f = doc.slots[slot]?.meal.fun_fact;
    if (f) facts.push(f);
  }
  if (facts.length === 0) return "";
  return facts[Math.floor(Math.random() * facts.length)]!;
}

export function TodayPlanView({
  plan,
  healthProfile,
  onReplacedPlan,
}: {
  plan: MealDocWithId;
  healthProfile: HealthProfileDoc;
  onReplacedPlan: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const d = plan.data;

  const apiSlots = useMemo(
    () => Object.keys(d.slots).filter((k) => d.slots[k as ApiMealTime]) as ApiMealTime[],
    [d.slots],
  );

  const macroTargetsDay = useMemo(
    () => scaleMacroTargetsByServings(resolveMacroTargets(healthProfile), d.servings),
    [healthProfile, d.servings],
  );

  const funFact = useMemo(() => randomFunFactFromPlan(d), [d]);
  const macroMode = apiSlots.length >= 3 ? "fullDayTargets" : "totalsOnly";

  const startNewPlan = async () => {
    setBusy(true);
    try {
      await deleteConfirmedPlansForDateKey(localDateKey());
      onReplacedPlan();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mx-auto min-h-0 w-full max-w-[430px] flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-28">
        <div>
          <h2 className="text-foreground text-xl font-medium leading-tight">Thực đơn hôm nay</h2>
          <p className="text-muted-foreground text-sm">{formatDateKeyVi(d.dateKey)}</p>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-base font-medium leading-snug">
              {macroMode === "fullDayTargets" ? "Tóm tắt dinh dưỡng" : "Tổng các bữa đã chọn"}
            </CardTitle>
            <p className="text-foreground mt-1 text-2xl font-medium tabular-nums">
              {macroMode === "fullDayTargets"
                ? `~${Math.round(d.dayTotals.calories)} kcal đã lưu`
                : `~${Math.round(d.dayTotals.calories)} kcal · chưa so với mục tiêu cả ngày`}
            </p>
          </CardHeader>
          <CardContent>
            <MacroProgressBars totals={d.dayTotals} targets={macroTargetsDay} mode={macroMode} />
          </CardContent>
        </Card>

        <div className="space-y-2">
          <p className="text-foreground text-base font-medium">Các bữa</p>
          {apiSlots.map((slot) => {
            const entry = d.slots[slot];
            if (!entry?.meal) return null;
            return (
              <Link
                key={slot}
                href={`/history/${plan.id}`}
                className="border-border hover:bg-muted/50 block rounded-lg border p-4 text-left text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {API_SLOT_VI[slot]}
                    </p>
                    <p className="text-foreground mt-1 text-base font-medium leading-snug">{entry.meal.name}</p>
                    <p className="text-muted-foreground mt-1 text-sm font-normal tabular-nums">
                      ~{Math.round(entry.meal.calories)} kcal · P {Math.round(entry.meal.macros.protein_g)}g · C{" "}
                      {Math.round(entry.meal.macros.carb_g)}g · F {Math.round(entry.meal.macros.fat_g)}g
                    </p>
                  </div>
                  <InsulinSpikeBadge value={entry.meal.insulin_spike} />
                </div>
              </Link>
            );
          })}
        </div>

        {d.supplementReminder ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Nhớ uống</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">{d.supplementReminder}</CardContent>
          </Card>
        ) : null}

        <p className="text-muted-foreground text-center text-sm">
          Mục tiêu nước hôm nay:{" "}
          <span className="text-foreground font-medium">{d.waterTargetLiters} L</span>
        </p>

        {funFact ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Có thể bạn chưa biết</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm italic">{funFact}</CardContent>
          </Card>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-muted-foreground w-full"
          disabled={busy}
          onClick={() => void startNewPlan()}
        >
          {busy ? "Đang chuẩn bị…" : "Lên plan mới"}
        </Button>
      </div>
    </>
  );
}
