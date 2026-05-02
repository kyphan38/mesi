"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InsulinSpikeBadge } from "@/components/plan/insulin-spike-badge";
import { MacroProgressBars } from "@/components/plan/macro-progress-bars";
import { resolveMacroTargets, scaleMacroTargetsByServings } from "@/lib/constants/health-presets";
import { setHomeComposeNewPlanActive } from "@/lib/plan/home-compose-new-flag";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { API_SLOT_VI } from "@/lib/plan/slot-labels";
import type { MealDocWithId } from "@/lib/db/meals";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import type { HealthProfileDoc } from "@/types/health-profile";

const ALL_API_SLOTS: ApiMealTime[] = ["morning", "lunch", "dinner"];

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
  onPlanSlot,
  onReplanSlot,
}: {
  plan: MealDocWithId;
  healthProfile: HealthProfileDoc;
  onReplacedPlan: () => void;
  onPlanSlot: (slot: ApiMealTime) => void;
  onReplanSlot: (slot: ApiMealTime) => void;
}) {
  const d = plan.data;

  const hasFullDay = useMemo(
    () => ALL_API_SLOTS.every((t) => d.slots[t]?.meal != null),
    [d.slots],
  );

  const macroTargetsDay = useMemo(
    () => scaleMacroTargetsByServings(resolveMacroTargets(healthProfile), d.servings),
    [healthProfile, d.servings],
  );

  const funFact = useMemo(() => randomFunFactFromPlan(d), [d]);
  const macroMode = hasFullDay ? "fullDayTargets" : "totalsOnly";

  const startNewPlan = () => {
    setHomeComposeNewPlanActive(true);
    onReplacedPlan();
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

        <div className="space-y-3">
          <p className="text-foreground text-base font-medium">Các bữa</p>
          {ALL_API_SLOTS.map((slot) => {
            const entry = d.slots[slot];
            if (entry?.meal) {
              return (
                <div key={slot} className="border-border rounded-lg border">
                  <Link
                    href={`/history/${plan.id}`}
                    className="border-border hover:bg-muted/50 block p-4 text-left text-sm"
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
                  <div className="border-border flex justify-end border-t px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onReplanSlot(slot)}
                      className="text-muted-foreground hover:text-primary text-xs font-medium"
                    >
                      Plan lại
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={slot}
                className="border-border rounded-lg border border-dashed p-4 text-center"
              >
                <p className="text-muted-foreground text-sm">
                  {API_SLOT_VI[slot]} - chưa có plan
                </p>
                <button
                  type="button"
                  onClick={() => onPlanSlot(slot)}
                  className="text-primary mt-2 text-sm font-medium hover:underline"
                >
                  Lên plan cho {API_SLOT_VI[slot].toLowerCase()}
                </button>
              </div>
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
          onClick={startNewPlan}
        >
          Lên plan mới
        </Button>
      </div>
    </>
  );
}
