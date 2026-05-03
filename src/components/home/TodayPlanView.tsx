"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Droplets, Lightbulb, Pill, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InsulinMacroBadge, MacroProgressBars } from "@/components/plan/macro-progress-bars";
import { MealIngredientsCollapsible } from "@/components/plan/meal-ingredients-list";
import {
  resolveMacroTargets,
  scaleMacroTargetsByPlannedMealSlots,
  scaleMacroTargetsByServings,
} from "@/lib/constants/health-presets";
import { updateSlotEatenAt } from "@/lib/db/meals";
import { setHomeComposeNewPlanActive } from "@/lib/plan/home-compose-new-flag";
import { aggregateFromMeals, insulinSpikeAbbrev } from "@/lib/plan/day-insulin";
import { formatDateKeyVi } from "@/lib/locale/vi-date";
import { API_SLOT_VI } from "@/lib/plan/slot-labels";
import type { MealDocWithId } from "@/lib/db/meals";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import type { HealthProfileDoc } from "@/types/health-profile";
import { cn } from "@/lib/utils";

const ALL_API_SLOTS: ApiMealTime[] = ["morning", "lunch", "dinner"];

function formatDoneAt(ms: number): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

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
  onPlanUpdated,
}: {
  plan: MealDocWithId;
  healthProfile: HealthProfileDoc;
  onReplacedPlan: () => void;
  onPlanSlot: (slot: ApiMealTime) => void;
  onReplanSlot: (slot: ApiMealTime) => void;
  /** Call after marking eaten / persistence so parent can refresh Firestore doc. */
  onPlanUpdated?: () => void | Promise<void>;
}) {
  const d = plan.data;
  const [eatenBusy, setEatenBusy] = useState<ApiMealTime | null>(null);

  const plannedSlotCount = useMemo(
    () => ALL_API_SLOTS.filter((t) => d.slots[t]?.meal != null).length,
    [d.slots],
  );

  const macroTargetsDay = useMemo(() => {
    const householdDay = scaleMacroTargetsByServings(resolveMacroTargets(healthProfile), d.servings);
    return scaleMacroTargetsByPlannedMealSlots(householdDay, plannedSlotCount);
  }, [healthProfile, d.servings, plannedSlotCount]);

  const mealsForInsulin = useMemo(() => {
    const meals = ALL_API_SLOTS.map((t) => d.slots[t]?.meal).filter((m): m is NonNullable<typeof m> => m != null);
    return meals;
  }, [d.slots]);

  const insulinAbbrev = useMemo(
    () => (mealsForInsulin.length > 0 ? insulinSpikeAbbrev(aggregateFromMeals(mealsForInsulin)) : null),
    [mealsForInsulin],
  );

  const funFact = useMemo(() => randomFunFactFromPlan(d), [d]);

  const startNewPlan = () => {
    setHomeComposeNewPlanActive(true);
    onReplacedPlan();
  };

  const toggleEaten = async (slot: ApiMealTime, currentlyEaten: boolean) => {
    setEatenBusy(slot);
    try {
      await updateSlotEatenAt(plan.id, slot, !currentlyEaten);
      await onPlanUpdated?.();
    } catch (e) {
      console.error(e);
    } finally {
      setEatenBusy(null);
    }
  };

  return (
    <>
      <div className="mx-auto min-h-0 w-full max-w-[430px] flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-28">
        <div>
          <h2 className="text-foreground text-xl font-semibold leading-tight tracking-tight">Thực đơn hôm nay</h2>
          <p className="text-muted-foreground text-sm tabular-nums">{formatDateKeyVi(d.dateKey)}</p>
        </div>

        <Card className="rounded-2xl border-border">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1 pb-2">
            <CardTitle className="text-base font-medium leading-snug tracking-tight">Tóm tắt dinh dưỡng</CardTitle>
            {insulinAbbrev != null && insulinAbbrev !== "" ? (
              <InsulinMacroBadge abbrev={insulinAbbrev} />
            ) : null}
          </CardHeader>
          <CardContent>
            <MacroProgressBars totals={d.dayTotals} targets={macroTargetsDay} mode="fullDayTargets" />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <p className="text-foreground text-base font-semibold tracking-tight">Các bữa</p>
          {ALL_API_SLOTS.map((slot) => {
            const entry = d.slots[slot];
            if (entry?.meal) {
              const eaten = Boolean(entry.eatenAt);
              return (
                <div
                  key={slot}
                  className={cn(
                    "border-border bg-card text-card-foreground relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all",
                    eaten && "opacity-60 [filter:grayscale(0.5)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onReplanSlot(slot)}
                    className="text-muted-foreground hover:text-teal-600 active:text-teal-700 absolute top-4 right-4 z-10 inline-flex shrink-0 transition-all active:scale-95 p-2 -m-2"
                    aria-label={`Đổi món ${API_SLOT_VI[slot]}`}
                  >
                    <RefreshCw className="size-4" />
                  </button>

                  <div className="pr-12">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {API_SLOT_VI[slot]}
                    </p>
                  </div>

                  <div className="mt-3 flex gap-3">
                    {!eaten ? (
                      <label className="flex shrink-0 cursor-pointer items-start pt-0.5">
                        <input
                          type="checkbox"
                          checked={eaten}
                          disabled={eatenBusy === slot}
                          onChange={() => void toggleEaten(slot, eaten)}
                          className="accent-teal-600 border-slate-300 text-teal-600 focus-visible:ring-teal-500/40 size-5 shrink-0 rounded-full border focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                          aria-label={`Đã ăn ${API_SLOT_VI[slot]}`}
                        />
                      </label>
                    ) : typeof entry.eatenAt === "number" ? (
                      <p className="text-muted-foreground max-w-[11rem] shrink-0 pt-0.5 text-xs leading-snug tabular-nums">
                        Đã hoàn thành lúc {formatDoneAt(entry.eatenAt)}
                      </p>
                    ) : (
                      <p className="text-muted-foreground shrink-0 pt-0.5 text-xs">Đã hoàn thành</p>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/history/${plan.id}`}
                        className="hover:bg-muted/40 -mx-1 block rounded-md px-1 py-0.5 text-left text-sm transition-colors hover:text-teal-700"
                      >
                        <p
                          className={cn(
                            "text-base font-medium leading-snug",
                            eaten ? "text-muted-foreground line-through" : "text-foreground",
                          )}
                        >
                          {entry.meal.name}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm font-normal tabular-nums">
                          ~{Math.round(entry.meal.calories)} kcal · P {Math.round(entry.meal.macros.protein_g)}g · C{" "}
                          {Math.round(entry.meal.macros.carb_g)}g · F {Math.round(entry.meal.macros.fat_g)}g
                        </p>
                      </Link>
                      <MealIngredientsCollapsible
                        ingredients={entry.meal.ingredients ?? []}
                        missingIngredients={entry.meal.missing_ingredients ?? []}
                      />
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={slot}
                className="border-border bg-card rounded-2xl border border-dashed p-5 text-center shadow-sm"
              >
                <p className="text-muted-foreground text-sm">
                  {API_SLOT_VI[slot]} - chưa có plan
                </p>
                <button
                  type="button"
                  onClick={() => onPlanSlot(slot)}
                  className="mt-2 text-sm font-medium text-teal-600 underline-offset-2 hover:text-teal-700 hover:underline"
                >
                  Lên plan cho {API_SLOT_VI[slot].toLowerCase()}
                </button>
              </div>
            );
          })}
        </div>

        <Card className="rounded-2xl border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Thói quen</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-4 text-sm">
            {d.supplementReminder?.trim() ? (
              <p className="flex items-start gap-3">
                <div className="rounded-lg bg-purple-50 p-2 text-purple-500 dark:bg-purple-950/40 dark:text-purple-400">
                  <Pill className="size-4" aria-hidden />
                </div>
                <span>{d.supplementReminder}</span>
              </p>
            ) : null}
            <p className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400">
                <Droplets className="size-4" aria-hidden />
              </div>
              <span>
                <span className="text-foreground font-medium">Nước:</span> mục tiêu{" "}
                <span className="tabular-nums">{d.waterTargetLiters}</span> L / ngày
              </span>
            </p>
          </CardContent>
        </Card>

        {funFact ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/25">
            <div className="flex gap-3">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="text-foreground text-sm font-medium">Có thể bạn chưa biết</p>
                <p className="text-muted-foreground text-sm italic">{funFact}</p>
              </div>
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground w-full"
          onClick={startNewPlan}
        >
          Lên plan mới
        </Button>
      </div>
    </>
  );
}
