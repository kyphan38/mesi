"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api/api-fetch";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import type { MealOption, RecipeDetailParsed, SuggestMealsParsed } from "@/lib/ai/validators/meals";
import { getSupplementTimingHint } from "@/lib/constants/health-presets";
import { buildHealthProfilePayload } from "@/lib/meal-plan/build-suggest-request";
import {
  aggregateFromMeals,
  anyHighGlycemicLoad,
  macroCaloriePercents,
  sumDayTotals,
} from "@/lib/plan/day-insulin";
import { clearPlanDraft, readPlanDraft, type PlanDraftV1 } from "@/lib/plan/plan-draft";
import { API_SLOT_VI } from "@/lib/plan/slot-labels";
import { evaluateDayNutrition } from "@/lib/nutrition/evaluate-day";
import { primaryNutritionGoalKey } from "@/lib/meal-plan/nutrition-baseline";
import {
  buildConfirmedPlanPayload,
  incrementIngredientsFromMeals,
  saveConfirmedPlan,
} from "@/lib/db/meals";
import { IngredientEditSheet } from "@/components/plan/ingredient-edit-sheet";
import { InsulinSpikeBadge } from "@/components/plan/insulin-spike-badge";
import { MealOptionCard } from "@/components/plan/meal-option-card";

function initOptions(sr: SuggestMealsParsed): Record<ApiMealTime, MealOption[]> {
  const o = {} as Record<ApiMealTime, MealOption[]>;
  for (const slot of Object.keys(sr.meals) as ApiMealTime[]) {
    o[slot] = [...sr.meals[slot]];
  }
  return o;
}

function initExclude(sr: SuggestMealsParsed): Record<ApiMealTime, Set<string>> {
  const ex = {} as Record<ApiMealTime, Set<string>>;
  for (const slot of Object.keys(sr.meals) as ApiMealTime[]) {
    ex[slot] = new Set(sr.meals[slot].map((m) => m.name));
  }
  return ex;
}

function supplementReminder(draft: PlanDraftV1): string {
  const hint = draft.suggestResult.supplement_plan_hint?.trim();
  if (hint) return hint;
  const p = draft.profileSnapshot;
  return p.supplements
    .map((s) => {
      const hint = getSupplementTimingHint(s.id);
      return hint ? `${s.label} - ${hint}` : s.label;
    })
    .join(" • ");
}

function randomFunFact(meals: MealOption[]): string {
  const facts = meals.map((m) => m.fun_fact).filter(Boolean);
  if (facts.length === 0) return "";
  return facts[Math.floor(Math.random() * facts.length)]!;
}

export function PlanPageClient() {
  const router = useRouter();
  const { show } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const draft = mounted ? readPlanDraft() : null;

  useEffect(() => {
    if (mounted && draft === null) {
      router.replace("/");
    }
  }, [mounted, draft, router]);

  if (!mounted || draft === null) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">
        Đang mở thực đơn…
      </div>
    );
  }

  return <PlanWizard draft={draft} onDone={() => router.push("/")} showToast={show} />;
}

function PlanWizard({
  draft,
  onDone,
  showToast,
}: {
  draft: PlanDraftV1;
  onDone: () => void;
  showToast: (msg: string, variant: "success" | "error" | "info") => void;
}) {
  const apiSlots = useMemo(
    () => Object.keys(draft.suggestResult.meals) as ApiMealTime[],
    [draft.suggestResult.meals],
  );

  const [step, setStep] = useState<"options" | "summary">("options");
  const [optionsBySlot, setOptionsBySlot] = useState<Record<ApiMealTime, MealOption[]>>(() =>
    initOptions(draft.suggestResult),
  );
  const [excludeBySlot, setExcludeBySlot] = useState<Record<ApiMealTime, Set<string>>>(() =>
    initExclude(draft.suggestResult),
  );
  const [selectedBySlot, setSelectedBySlot] = useState<Partial<Record<ApiMealTime, MealOption>>>({});
  const [sheetSlot, setSheetSlot] = useState<ApiMealTime | null>(null);
  const [recipeSlot, setRecipeSlot] = useState<ApiMealTime | null>(null);
  const [recipeCache, setRecipeCache] = useState<Partial<Record<ApiMealTime, RecipeDetailParsed>>>(
    {},
  );
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState<ApiMealTime | null>(null);
  const [shopping, setShopping] = useState<{ suggestions: { ingredient: string; reason: string }[]; reassurance_note: string } | null>(null);
  const [gapsDismissed, setGapsDismissed] = useState(false);

  const hp = useMemo(() => buildHealthProfilePayload(draft.profileSnapshot), [draft.profileSnapshot]);
  const primaryGoal = useMemo(
    () => primaryNutritionGoalKey(draft.profileSnapshot.nutritionGoalIds),
    [draft.profileSnapshot.nutritionGoalIds],
  );

  const selectedMeals = useMemo(() => {
    return apiSlots.map((s) => selectedBySlot[s]).filter((m): m is MealOption => m != null);
  }, [apiSlots, selectedBySlot]);

  const dayTotals = useMemo(() => sumDayTotals(selectedMeals), [selectedMeals]);
  const dayInsulin = useMemo(() => aggregateFromMeals(selectedMeals), [selectedMeals]);
  const macroPct = useMemo(() => macroCaloriePercents(dayTotals), [dayTotals]);
  const gaps = useMemo(
    () => (selectedMeals.length > 0 ? evaluateDayNutrition(selectedMeals, primaryGoal) : null),
    [selectedMeals, primaryGoal],
  );
  const glWarn = useMemo(() => anyHighGlycemicLoad(selectedMeals), [selectedMeals]);
  const funFact = useMemo(() => randomFunFact(selectedMeals), [selectedMeals]);

  const allSelected = apiSlots.every((s) => selectedBySlot[s] != null);

  const loadMore = async (slot: ApiMealTime) => {
    const effort =
      draft.suggestRequest.meals.find((m) => m.time === slot)?.effort ?? "medium";
    setMoreLoading(slot);
    try {
      const body = {
        ...draft.suggestRequest,
        meals: [{ time: slot, effort }],
      };
      const res = await apiFetch("/api/ai/suggest-meals", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: SuggestMealsParsed;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.data?.meals?.[slot]) {
        showToast(json.error ?? "Không lấy thêm gợi ý.", "error");
        return;
      }
      const newOpts = json.data.meals[slot];
      setOptionsBySlot((prev) => ({
        ...prev,
        [slot]: [...(prev[slot] ?? []), ...newOpts],
      }));
      setExcludeBySlot((prev) => {
        const set = new Set(prev[slot]);
        for (const o of newOpts) set.add(o.name);
        return { ...prev, [slot]: set };
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Lỗi mạng", "error");
    } finally {
      setMoreLoading(null);
    }
  };

  const applyAdjust = async (slot: ApiMealTime, changes: { add?: string[]; remove?: string[] }) => {
    const meal = selectedBySlot[slot];
    if (!meal) return;
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/ai/adjust-meal", {
        method: "POST",
        body: JSON.stringify({ meal, changes, health_profile: hp }),
      });
      const json = (await res.json()) as { ok?: boolean; data?: { meal: MealOption }; error?: string };
      if (!res.ok || !json.ok || !json.data?.meal) {
        showToast(json.error ?? "Cập nhật thất bại", "error");
        return;
      }
      const updated = json.data.meal;
      setSelectedBySlot((prev) => ({ ...prev, [slot]: updated }));
      setOptionsBySlot((prev) => ({
        ...prev,
        [slot]: (prev[slot] ?? []).map((o) => (o.name === meal.name ? updated : o)),
      }));
      setSheetSlot(null);
      showToast("Đã cập nhật món.", "success");
    } finally {
      setActionLoading(false);
    }
  };

  const runSwap = async (slot: ApiMealTime) => {
    const meal = selectedBySlot[slot];
    if (!meal) return;
    const effort =
      draft.suggestRequest.meals.find((m) => m.time === slot)?.effort ?? "medium";
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/ai/swap-meal", {
        method: "POST",
        body: JSON.stringify({
          health_profile: hp,
          ingredients: draft.suggestRequest.ingredients,
          servings: draft.suggestRequest.servings,
          slot,
          effort,
          current_meal: meal,
          exclude_meals: Array.from(excludeBySlot[slot] ?? []),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; data?: { meal: MealOption }; error?: string };
      if (!res.ok || !json.ok || !json.data?.meal) {
        showToast(json.error ?? "Swap thất bại", "error");
        return;
      }
      const newMeal = json.data.meal;
      setSelectedBySlot((prev) => ({ ...prev, [slot]: newMeal }));
      setOptionsBySlot((prev) => ({
        ...prev,
        [slot]: [...(prev[slot] ?? []).filter((o) => o.name !== meal.name), newMeal],
      }));
      setExcludeBySlot((prev) => {
        const set = new Set(prev[slot]);
        set.add(newMeal.name);
        return { ...prev, [slot]: set };
      });
      setSheetSlot(null);
      showToast("Đã đổi món gợi ý.", "success");
    } finally {
      setActionLoading(false);
    }
  };

  const openRecipe = (slot: ApiMealTime) => {
    const meal = selectedBySlot[slot];
    if (!meal) return;
    setRecipeSlot(slot);
    if (recipeCache[slot]) return;
    setRecipeLoading(true);
    void (async () => {
      try {
        const res = await apiFetch("/api/ai/recipe-detail", {
          method: "POST",
          body: JSON.stringify({
            meal,
            servings: draft.suggestRequest.servings,
            health_profile: hp,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; data?: RecipeDetailParsed; error?: string };
        if (!res.ok || !json.ok || !json.data) {
          showToast(json.error ?? "Không tải công thức", "error");
          return;
        }
        setRecipeCache((prev) => ({ ...prev, [slot]: json.data! }));
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Lỗi", "error");
      } finally {
        setRecipeLoading(false);
      }
    })();
  };

  const loadShopping = async () => {
    const meal =
      selectedMeals.sort((a, b) => b.missing_ingredients.length - a.missing_ingredients.length)[0];
    if (!meal) return;
    try {
      const res = await apiFetch("/api/ai/shopping-suggest", {
        method: "POST",
        body: JSON.stringify({
          meal,
          available_ingredients: draft.suggestRequest.ingredients,
          health_profile: hp,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { suggestions: { ingredient: string; reason: string }[]; reassurance_note: string };
      };
      if (json.ok && json.data) setShopping(json.data);
    } catch {
      /* optional */
    }
  };

  const goToSummary = () => {
    setStep("summary");
    void loadShopping();
  };

  const confirmPlan = async () => {
    if (!allSelected) return;
    setActionLoading(true);
    try {
      const slots: Partial<Record<ApiMealTime, { meal: MealOption; recipe?: RecipeDetailParsed }>> = {};
      for (const slot of apiSlots) {
        const m = selectedBySlot[slot];
        if (!m) continue;
        const r = recipeCache[slot];
        slots[slot] = r ? { meal: m, recipe: r } : { meal: m };
      }
      const payload = buildConfirmedPlanPayload({
        slots,
        servings: draft.suggestRequest.servings,
        dayTotals,
        dayInsulin,
        supplementReminder: supplementReminder(draft),
        waterTargetLiters: draft.profileSnapshot.waterTargetLiters,
        shoppingNote: shopping?.reassurance_note,
      });
      await saveConfirmedPlan(payload);
      await incrementIngredientsFromMeals(selectedMeals);
      clearPlanDraft();
      showToast("Đã lưu thực đơn hôm nay.", "success");
      onDone();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Lưu thất bại", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-0 flex-1 pb-24">
      <header className="border-border sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Trang chủ
        </Link>
        <span className="text-foreground pointer-events-none min-w-0 flex-1 truncate text-center text-sm font-semibold">
          {step === "options" ? "Chọn món" : "Tóm tắt"}
        </span>
        <Link
          href="/history"
          className="text-muted-foreground hover:text-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          aria-label="Lịch sử"
        >
          <History className="size-4" />
        </Link>
      </header>

      <div className="mx-auto w-full max-w-[430px] space-y-6 px-4 py-4">
        {step === "options" ? (
          <>
            {apiSlots.map((slot) => (
              <section key={slot} className="space-y-3">
                <h2 className="text-foreground text-base font-semibold">{API_SLOT_VI[slot]}</h2>
                <div className="space-y-3">
                  {(optionsBySlot[slot] ?? []).map((opt, idx) => (
                    <MealOptionCard
                      key={`${opt.name}-${idx}`}
                      option={opt}
                      selected={selectedBySlot[slot]?.name === opt.name}
                      onSelect={() =>
                        setSelectedBySlot((prev) => ({
                          ...prev,
                          [slot]: opt,
                        }))
                      }
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={moreLoading === slot}
                    onClick={() => void loadMore(slot)}
                  >
                    {moreLoading === slot ? "Đang tải…" : "Gợi ý thêm"}
                  </Button>
                  {selectedBySlot[slot] ? (
                    <Button type="button" variant="secondary" size="sm" onClick={() => setSheetSlot(slot)}>
                      Sửa nguyên liệu / Swap
                    </Button>
                  ) : null}
                </div>
              </section>
            ))}

            <Button
              type="button"
              className="bg-primary text-primary-foreground min-h-12 w-full font-semibold"
              disabled={!allSelected}
              onClick={goToSummary}
            >
              Xem tóm tắt
            </Button>
          </>
        ) : (
          <>
            {gaps?.has_gaps && !gapsDismissed ? (
              <Card className="border-primary/40 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Gợi ý nhẹ</CardTitle>
                  <CardDescription>
                    So với mục tiêu hôm nay, bạn có thể điều chỉnh thêm - hoặc giữ nguyên nếu ổn.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setStep("options");
                      setGapsDismissed(false);
                    }}
                  >
                    Điều chỉnh
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setGapsDismissed(true)}>
                    Giữ nguyên
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cả ngày</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <span>
                    ~{Math.round(dayTotals.calories)} kcal · Đánh giá insulin:
                  </span>
                  <InsulinSpikeBadge size="lg" value={dayInsulin} />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <MacroBars pct={macroPct} totals={dayTotals} />
                {glWarn ? (
                  <p className="text-muted-foreground text-xs leading-snug">
                    Bữa hôm nay có phần tải đường huyết khá cao. Cân nhắc thay tinh bột trắng bằng khoai lang hoặc
                    yến mạch.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-2">
              <p className="text-foreground text-sm font-medium">Từng bữa</p>
              {apiSlots.map((slot) => {
                const m = selectedBySlot[slot];
                if (!m) return null;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => openRecipe(slot)}
                    className="border-border hover:bg-muted/50 w-full rounded-xl border p-3 text-left text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-muted-foreground text-xs">{API_SLOT_VI[slot]}</p>
                        <p className="text-foreground font-medium">{m.name}</p>
                        <p className="text-muted-foreground text-xs">~{Math.round(m.calories)} kcal</p>
                      </div>
                      <InsulinSpikeBadge value={m.insulin_spike} />
                    </div>
                  </button>
                );
              })}
            </div>

            {funFact ? (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Lightbulb className="size-4 shrink-0 text-amber-600" />
                    Có thể bạn chưa biết
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">{funFact}</CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Nhớ uống</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">{supplementReminder(draft)}</CardContent>
            </Card>

            <p className="text-muted-foreground text-center text-sm">
              Mục tiêu nước hôm nay:{" "}
              <span className="text-foreground font-medium">{draft.profileSnapshot.waterTargetLiters} L</span>
            </p>

            {shopping ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Nếu tiện, mua thêm</CardTitle>
                  <CardDescription>{shopping.reassurance_note}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <ul className="text-muted-foreground list-inside list-disc space-y-1">
                    {shopping.suggestions.map((s, i) => (
                      <li key={i}>
                        <span className="text-foreground">{s.ingredient}</span> - {s.reason}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => setStep("options")}>
                      OK, chỉnh món
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => {}}>
                      Nấu với những gì có
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("options")}>
                Quay lại
              </Button>
              <Button
                type="button"
                className="bg-primary text-primary-foreground min-h-12 flex-[2] font-semibold"
                disabled={actionLoading || !allSelected}
                onClick={() => void confirmPlan()}
              >
                {actionLoading ? "Đang lưu…" : "Xác nhận thực đơn"}
              </Button>
            </div>
          </>
        )}
      </div>

      <IngredientEditSheet
        key={
          sheetSlot
            ? `${sheetSlot}-${selectedBySlot[sheetSlot]?.name ?? ""}`
            : "closed"
        }
        open={sheetSlot != null}
        meal={sheetSlot ? selectedBySlot[sheetSlot] ?? null : null}
        slotLabel={sheetSlot ? API_SLOT_VI[sheetSlot] : ""}
        onClose={() => setSheetSlot(null)}
        onApplyAdjust={async (ch) => {
          if (sheetSlot) await applyAdjust(sheetSlot, ch);
        }}
        onSwap={async () => {
          if (sheetSlot) await runSwap(sheetSlot);
        }}
        loading={actionLoading}
      />

      {recipeSlot && selectedBySlot[recipeSlot] ? (
        <RecipeOverlay
          slot={recipeSlot}
          meal={selectedBySlot[recipeSlot]!}
          recipe={recipeCache[recipeSlot]}
          loading={recipeLoading}
          onClose={() => setRecipeSlot(null)}
        />
      ) : null}
    </div>
  );
}

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

function RecipeOverlay({
  slot,
  meal,
  recipe,
  loading,
  onClose,
}: {
  slot: ApiMealTime;
  meal: MealOption;
  recipe?: RecipeDetailParsed;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/50" aria-label="Đóng" onClick={onClose} />
      <div className="border-border bg-background fixed inset-x-0 bottom-0 top-[12%] z-50 flex flex-col overflow-hidden rounded-t-2xl border shadow-xl">
        <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-muted-foreground text-xs">{API_SLOT_VI[slot]}</p>
            <p className="text-foreground text-lg font-semibold">{meal.name}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">Đang tạo công thức…</p>
          ) : recipe ? (
            <div className="space-y-4 text-sm">
              <section>
                <p className="text-foreground mb-2 font-medium">Nguyên liệu</p>
                <ul className="text-muted-foreground list-inside list-disc space-y-1">
                  {meal.ingredients.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </section>
              <section>
                <p className="text-foreground mb-2 font-medium">Các bước</p>
                <ol className="text-muted-foreground list-inside list-decimal space-y-2">
                  {recipe.steps.map((s, i) => (
                    <li key={i} className="leading-relaxed">
                      {s}
                    </li>
                  ))}
                </ol>
              </section>
              {recipe.tips ? (
                <section>
                  <p className="text-foreground mb-1 font-medium">Mẹo</p>
                  <p className="text-muted-foreground">{recipe.tips}</p>
                </section>
              ) : null}
              <p className="text-muted-foreground text-xs">
                ~{meal.prep_time_minutes} phút · {meal.cooking_method}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Không có dữ liệu.</p>
          )}
        </div>
      </div>
    </>
  );
}
