"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, User } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RatingPromptBanner } from "@/components/home/RatingPromptBanner";
import { useToast } from "@/components/ui/toast";
import { useMesiTaste } from "@/components/providers/MesiTasteProvider";
import { cn } from "@/lib/utils";
import {
  ALL_PANTRY_PRESETS,
  CARB_PRESETS,
  PROTEIN_PRESETS,
  type PantryPreset,
  VEG_PRESETS,
} from "@/lib/constants/pantry-presets";
import {
  incrementIngredientUse,
  listIngredientStats,
  topIngredientIds,
  type IngredientStat,
} from "@/lib/db/ingredients";
import {
  countDistinctIntentDays,
  recordPlanIntentForToday,
} from "@/lib/db/plan-intents";
import { apiFetch } from "@/lib/api/api-fetch";
import { getDefaultHealthProfile, getHealthProfile } from "@/lib/db/firestore";
import {
  buildSuggestMealPrepRequest,
  buildSuggestMealsRequest,
  labelsFromPantrySelection,
} from "@/lib/meal-plan/build-suggest-request";
import { ingredientLineDocId } from "@/lib/meal-plan/ingredient-id";
import type { CookAgainPayloadV1 } from "@/lib/plan/cook-again";
import { readCookAgainPayload } from "@/lib/plan/cook-again";
import { writeMealPrepDraft, writePlanDraft } from "@/lib/plan/plan-draft";
import {
  getLatestUnratedConfirmedDoc,
  updateMealRating,
  type MealDocWithId,
} from "@/lib/db/meals";
import type { SuggestMealPrepParsed, SuggestMealsParsed } from "@/lib/ai/validators/meals";

type MealSlot = "morning" | "afternoon" | "evening";
type Effort = "quick" | "medium" | "high";

const MEAL_LABELS: Record<MealSlot, string> = {
  morning: "Sáng",
  afternoon: "Trưa",
  evening: "Tối",
};

const EFFORT_OPTIONS: { id: Effort; label: string }[] = [
  { id: "quick", label: "Nhanh (<15 phút)" },
  { id: "medium", label: "Vừa (15–30 phút)" },
  { id: "high", label: "Kỳ công (>30 phút)" },
];

/** Compact labels for native select / one-line UI */
const EFFORT_SELECT_LABEL: Record<Effort, string> = {
  quick: "Nhanh (<15p)",
  medium: "Vừa (15–30p)",
  high: "Kỳ công (>30p)",
};

const SLOT_EMOJI: Record<MealSlot, string> = {
  morning: "☀️",
  afternoon: "🌤️",
  evening: "🌙",
};

export function HomeScreen() {
  const router = useRouter();
  const { show } = useToast();
  const { tasteContext, refreshTaste } = useMesiTaste();
  const [stats, setStats] = useState<IngredientStat[]>([]);
  const [intentDays, setIntentDays] = useState(0);

  const [dinerPreset, setDinerPreset] = useState<"1" | "2" | "3" | "other">("1");
  const [dinerOther, setDinerOther] = useState("4");

  const [mealOn, setMealOn] = useState<Record<MealSlot, boolean>>({
    morning: true,
    afternoon: false,
    evening: false,
  });
  const [effort, setEffort] = useState<Record<MealSlot, Effort>>({
    morning: "quick",
    afternoon: "quick",
    evening: "quick",
  });

  const [selectedPantry, setSelectedPantry] = useState<Set<string>>(() => new Set());
  const [customTags, setCustomTags] = useState<{ id: string; label: string }[]>([]);
  const [customInput, setCustomInput] = useState("");

  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingQuick, setLoadingQuick] = useState(false);
  const [loadingPrep, setLoadingPrep] = useState(false);

  const [ratingDoc, setRatingDoc] = useState<MealDocWithId | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [mealPrepMode, setMealPrepMode] = useState(false);
  const [prepDayCount, setPrepDayCount] = useState(3);

  /** Blocking API errors — toast chỉ cho validation ngắn, không trùng banner. */
  const [apiError, setApiError] = useState<string | null>(null);

  const refreshMeta = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([listIngredientStats(), countDistinctIntentDays()]);
      setStats(s);
      setIntentDays(c);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [s, c] = await Promise.all([listIngredientStats(), countDistinctIntentDays()]);
        if (cancelled) return;
        setStats(s);
        setIntentDays(c);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyCookAgainPayload = useCallback((payload: CookAgainPayloadV1) => {
    const n = payload.servings;
    if (n >= 1 && n <= 3) {
      setDinerPreset(String(n) as "1" | "2" | "3");
    } else {
      setDinerPreset("other");
      setDinerOther(String(n));
    }
    setMealOn(payload.mealOn);
    setEffort(payload.effort);
    setSelectedPantry(new Set(payload.selectedPantryIds));
    setCustomTags(payload.customTags);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("cookAgain") !== "1") return;
    const payload = readCookAgainPayload();
    if (!payload) {
      router.replace("/", { scroll: false });
      return;
    }
    applyCookAgainPayload(payload);
    router.replace("/", { scroll: false });
  }, [router, applyCookAgainPayload]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const d = await getLatestUnratedConfirmedDoc();
        if (!cancelled) setRatingDoc(d);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const topIds = useMemo(() => topIngredientIds(stats, 5), [stats]);
  const topIdSet = useMemo(() => new Set(topIds), [topIds]);

  const effectiveDiners = useMemo(() => {
    if (dinerPreset === "other") {
      const n = Number.parseInt(dinerOther, 10);
      if (Number.isFinite(n) && n >= 1) return Math.min(99, n);
      return 1;
    }
    return Number.parseInt(dinerPreset, 10) as 1 | 2 | 3;
  }, [dinerPreset, dinerOther]);

  const toggleMeal = (slot: MealSlot) => {
    setMealOn((m) => ({ ...m, [slot]: !m[slot] }));
  };

  const setEffortFor = (slot: MealSlot, e: Effort) => {
    setEffort((x) => ({ ...x, [slot]: e }));
  };

  const togglePantry = (id: string, label: string) => {
    setSelectedPantry((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        void incrementIngredientUse(id, label).catch((err) => console.error(err));
      }
      return next;
    });
  };

  const addCustomPantry = () => {
    const t = customInput.trim();
    if (!t) return;
    const id = ingredientLineDocId(t);
    if (customTags.some((c) => c.id === id) || selectedPantry.has(id)) {
      setCustomInput("");
      return;
    }
    setCustomTags((c) => [...c, { id, label: t }]);
    setSelectedPantry((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    void incrementIngredientUse(id, t).catch((e) => console.error(e));
    setCustomInput("");
  };

  const toggleCustomTag = (id: string, label: string) => {
    setSelectedPantry((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        void incrementIngredientUse(id, label).catch((e) => console.error(e));
      }
      return next;
    });
  };

  const runSuggestFlow = async (fromQuick: boolean) => {
    const enabled = (Object.keys(MEAL_LABELS) as MealSlot[]).some((s) => mealOn[s]);
    if (!enabled) {
      show("Chọn ít nhất một buổi để lên thực đơn.", "error");
      return;
    }

    setApiError(null);
    if (fromQuick) setLoadingQuick(true);
    else setLoadingMenu(true);
    try {
      const profile = (await getHealthProfile()) ?? getDefaultHealthProfile();
      const body = buildSuggestMealsRequest({
        profile,
        servings: effectiveDiners,
        mealOn,
        effort,
        selectedIngredientLabels: labelsFromPantrySelection(selectedPantry, customTags),
        tasteContext,
      });

      const res = await apiFetch("/api/ai/suggest-meals", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; data?: SuggestMealsParsed };

      if (!res.ok || !json.ok || !json.data) {
        setApiError(json.error ?? `Lỗi ${res.status}`);
        return;
      }

      writePlanDraft({
        version: 1,
        suggestResult: json.data,
        suggestRequest: body,
        profileSnapshot: profile,
      });
      await recordPlanIntentForToday();
      await refreshMeta();
      show(fromQuick ? "Đang mở gợi ý…" : "Đang mở gợi ý…", "info");
      router.push("/plan");
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Không gọi được API.");
    } finally {
      setLoadingMenu(false);
      setLoadingQuick(false);
    }
  };

  const runMealPrepFlow = async () => {
    const enabled = (Object.keys(MEAL_LABELS) as MealSlot[]).some((s) => mealOn[s]);
    if (!enabled) {
      show("Chọn ít nhất một buổi để lên meal prep.", "error");
      return;
    }
    setApiError(null);
    setLoadingPrep(true);
    try {
      const profile = (await getHealthProfile()) ?? getDefaultHealthProfile();
      const body = buildSuggestMealPrepRequest({
        profile,
        servings: effectiveDiners,
        mealOn,
        effort,
        selectedIngredientLabels: labelsFromPantrySelection(selectedPantry, customTags),
        prepDayCount,
        tasteContext,
      });

      const res = await apiFetch("/api/ai/suggest-meal-prep", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; data?: SuggestMealPrepParsed };

      if (!res.ok || !json.ok || !json.data) {
        setApiError(json.error ?? `Lỗi ${res.status}`);
        return;
      }

      writeMealPrepDraft({
        version: 1,
        prepDayCount: body.prep_day_count,
        suggestResult: json.data,
        suggestRequest: body,
        profileSnapshot: profile,
      });
      await recordPlanIntentForToday();
      await refreshMeta();
      show("Đang mở meal prep…", "info");
      router.push("/plan/prep");
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Không gọi được API.");
    } finally {
      setLoadingPrep(false);
    }
  };

  const onRateMeal = async (r: "good" | "neutral" | "bad") => {
    if (!ratingDoc) return;
    setRatingBusy(true);
    try {
      await updateMealRating(ratingDoc.id, r);
      await refreshTaste();
      setRatingDoc(null);
      show("Đã lưu đánh giá.", "success");
    } catch (e) {
      show(e instanceof Error ? e.message : "Không lưu được.", "error");
    } finally {
      setRatingBusy(false);
    }
  };

  const onSkipRating = async () => {
    if (!ratingDoc) return;
    setRatingBusy(true);
    try {
      await updateMealRating(ratingDoc.id, "skipped");
      setRatingDoc(null);
    } catch (e) {
      show(e instanceof Error ? e.message : "Không lưu được.", "error");
    } finally {
      setRatingBusy(false);
    }
  };

  const renderChip = (p: PantryPreset, isFrequent: boolean) => {
    const on = selectedPantry.has(p.id);
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => togglePantry(p.id, p.label)}
        className={cn(
          "relative min-h-11 rounded-full border px-3 py-2 text-left text-sm transition-colors",
          on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted",
          isFrequent && !on && "border-primary/50 ring-1 ring-primary/30",
        )}
      >
        {isFrequent ? (
          <span className="bg-primary/15 text-primary absolute -top-1.5 -right-1 rounded px-1 text-[10px] font-medium">
            Hay dùng
          </span>
        ) : null}
        {p.label}
      </button>
    );
  };

  const orderedPresets = useMemo(() => {
    const frequent: PantryPreset[] = [];
    const byId = new Map(ALL_PANTRY_PRESETS.map((p) => [p.id, p]));
    for (const id of topIds) {
      const p = byId.get(id);
      if (p) frequent.push(p);
    }
    const frequentIdSet = new Set(frequent.map((p) => p.id));
    return { frequent, frequentIdSet };
  }, [topIds]);

  const proteinRows = useMemo(
    () => PROTEIN_PRESETS.filter((p) => !orderedPresets.frequentIdSet.has(p.id)),
    [orderedPresets.frequentIdSet],
  );
  const vegRows = useMemo(
    () => VEG_PRESETS.filter((p) => !orderedPresets.frequentIdSet.has(p.id)),
    [orderedPresets.frequentIdSet],
  );
  const carbRows = useMemo(
    () => CARB_PRESETS.filter((p) => !orderedPresets.frequentIdSet.has(p.id)),
    [orderedPresets.frequentIdSet],
  );

  return (
    <div className="bg-background min-h-0 flex-1">
      <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <span className="text-foreground text-lg font-semibold tracking-tight">Mesi</span>
        <div className="flex items-center gap-1">
          <Link
            href="/history"
            className="text-muted-foreground hover:text-foreground inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg"
            aria-label="Lịch sử"
          >
            <History className="size-5" />
          </Link>
          <Link
            href="/profile#cai-dat"
            className="text-muted-foreground hover:text-foreground inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg"
            aria-label="Hồ sơ và cài đặt"
          >
            <User className="size-5" />
          </Link>
        </div>
      </header>

      <div
        className="mx-auto w-full max-w-[430px] space-y-6 scroll-pb-32 px-4 py-4 pb-28"
        style={{ scrollPaddingBottom: "max(7rem, env(safe-area-inset-bottom))" }}
      >
        {apiError ? (
          <Alert variant="destructive" className="relative pr-10">
            <AlertTitle>Không tạo được gợi ý</AlertTitle>
            <AlertDescription className="text-destructive/90">{apiError}</AlertDescription>
            <button
              type="button"
              className="text-destructive ring-offset-background focus:ring-ring absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
              onClick={() => setApiError(null)}
              aria-label="Đóng"
            >
              ×
            </button>
          </Alert>
        ) : null}
        <RatingPromptBanner
          doc={ratingDoc}
          busy={ratingBusy}
          onRate={(r) => void onRateMeal(r)}
          onSkip={() => void onSkipRating()}
        />

        {intentDays >= 3 ? (
          <div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              disabled={loadingQuick || mealPrepMode}
              onClick={() => void runSuggestFlow(true)}
            >
              {loadingQuick ? "Đang chuẩn bị…" : "Plan nhanh"}
            </Button>
            <p className="text-muted-foreground mt-1.5 text-center text-xs">
              Gợi ý nhanh cùng backend Gemini
            </p>
            {mealPrepMode ? (
              <p className="text-muted-foreground mt-1 text-center text-xs">Tắt Meal prep để dùng Plan nhanh.</p>
            ) : null}
          </div>
        ) : null}

        <section className="space-y-3">
          <label className="border-border flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <p className="text-foreground font-medium">Meal prep (nhiều ngày)</p>
              <p className="text-muted-foreground text-xs">Một lần nấu, chia bữa — sau khi xong bạn lưu cả lịch.</p>
            </div>
            <input
              type="checkbox"
              checked={mealPrepMode}
              onChange={() => setMealPrepMode((x) => !x)}
              className="border-input size-5 rounded"
              aria-label="Bật meal prep"
            />
          </label>
          {mealPrepMode ? (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium">Số ngày liên tiếp (2–7)</p>
              <Input
                type="number"
                min={2}
                max={7}
                className="min-h-11 max-w-[8rem] text-base"
                value={prepDayCount}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(n)) {
                    setPrepDayCount(2);
                    return;
                  }
                  setPrepDayCount(Math.max(2, Math.min(7, n)));
                }}
                aria-label="Số ngày meal prep"
              />
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-sm font-medium">Số người ăn</h2>
          <div className="flex flex-wrap gap-2">
            {(["1", "2", "3"] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDinerPreset(n)}
                className={cn(
                  "min-h-11 min-w-[3.5rem] rounded-xl border px-3 text-sm font-medium",
                  dinerPreset === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card",
                )}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDinerPreset("other")}
              className={cn(
                "min-h-11 rounded-xl border px-3 text-sm font-medium",
                dinerPreset === "other"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card",
              )}
            >
              Khác
            </button>
          </div>
          {dinerPreset === "other" ? (
            <Input
              type="number"
              min={1}
              max={99}
              className="min-h-11 max-w-[8rem] text-base"
              value={dinerOther}
              onChange={(e) => setDinerOther(e.target.value)}
              aria-label="Số người (nhập tay)"
            />
          ) : null}
          <p className="text-muted-foreground mt-1 text-xs tabular-nums" aria-live="polite">
            Tổng: {effectiveDiners} người ăn
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">Lên plan cho buổi nào?</h2>
          {(Object.keys(MEAL_LABELS) as MealSlot[]).map((slot) => (
            <div key={slot} className="border-border rounded-xl border p-3">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={mealOn[slot]}
                  onChange={() => toggleMeal(slot)}
                  className="border-input size-5 rounded"
                />
                <span className="text-foreground font-medium">{MEAL_LABELS[slot]}</span>
              </label>
              {mealOn[slot] ? (
                <div className="mt-2 flex min-h-11 items-center gap-2">
                  <span className="shrink-0 text-base select-none" aria-hidden>
                    {SLOT_EMOJI[slot]}
                  </span>
                  <select
                    value={effort[slot]}
                    onChange={(e) => setEffortFor(slot, e.target.value as Effort)}
                    aria-label={`Mức nấu ${MEAL_LABELS[slot]}`}
                    className="border-input bg-background text-foreground focus-visible:ring-ring flex h-11 min-h-11 min-w-0 flex-1 rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-2"
                  >
                    {EFFORT_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {EFFORT_SELECT_LABEL[o.id]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">Nhà đang có gì?</h2>

          {orderedPresets.frequent.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium">Lần trước bạn có…</p>
              <div className="flex flex-wrap gap-2">{orderedPresets.frequent.map((p) => renderChip(p, true))}</div>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">Protein</p>
            <div className="flex flex-wrap gap-2">{proteinRows.map((p) => renderChip(p, topIdSet.has(p.id)))}</div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">Rau / củ</p>
            <div className="flex flex-wrap gap-2">{vegRows.map((p) => renderChip(p, topIdSet.has(p.id)))}</div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">Tinh bột</p>
            <div className="flex flex-wrap gap-2">{carbRows.map((p) => renderChip(p, topIdSet.has(p.id)))}</div>
          </div>

          {customTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {customTags.map((c) => {
                const on = selectedPantry.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCustomTag(c.id, c.label)}
                    className={cn(
                      "min-h-11 rounded-full border px-3 py-2 text-sm",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Input
              placeholder="Thêm nguyên liệu khác…"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomPantry();
                }
              }}
              className="min-h-11 flex-1 text-base"
            />
            <Button type="button" variant="secondary" className="min-h-11 shrink-0" onClick={addCustomPantry}>
              Thêm
            </Button>
          </div>
        </section>

        <Button
          type="button"
          className="min-h-12 w-full text-base font-semibold"
          disabled={loadingMenu || loadingPrep}
          onClick={() => void (mealPrepMode ? runMealPrepFlow() : runSuggestFlow(false))}
        >
          {loadingPrep
            ? "Đang lập meal prep…"
            : loadingMenu
              ? "Đang nghĩ món…"
              : mealPrepMode
                ? "Lên meal prep"
                : "Lên thực đơn"}
        </Button>
      </div>
    </div>
  );
}
