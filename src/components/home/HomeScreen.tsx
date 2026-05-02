"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { History, Plus, Shuffle, User, X } from "lucide-react";
import { AddIngredientSheet } from "@/components/home/AddIngredientSheet";
import { TodayPlanView } from "@/components/home/TodayPlanView";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RatingPromptBanner } from "@/components/home/RatingPromptBanner";
import { useToast } from "@/components/ui/toast";
import { useMesiTaste } from "@/components/providers/MesiTasteProvider";
import { cn } from "@/lib/utils";
import {
  getPantryPreset,
  getPresetCategoryById,
  PANTRY_CATEGORIES,
  type PantryCategory,
  type PantryPreset,
} from "@/lib/constants/pantry-presets";
import {
  deleteUserIngredient,
  hydrateCustomItemsFromStats,
  incrementIngredientUse,
  listIngredientStats,
  topIngredientIds,
  type IngredientStat,
} from "@/lib/db/ingredients";
import { recordPlanIntentForToday } from "@/lib/db/plan-intents";
import { getUserFriendlyFirestoreMessage } from "@/lib/db/firestore-errors";
import { apiFetch } from "@/lib/api/api-fetch";
import { getDefaultHealthProfile, getHealthProfile } from "@/lib/db/firestore";
import {
  buildSuggestMealPrepRequest,
  buildSuggestMealsRequest,
  labelsFromPantrySelection,
} from "@/lib/meal-plan/build-suggest-request";
import type { CookAgainPayloadV1 } from "@/lib/plan/cook-again";
import { readCookAgainPayload } from "@/lib/plan/cook-again";
import { writeMealPrepDraft, writePlanDraft } from "@/lib/plan/plan-draft";
import {
  getLatestUnratedConfirmedDoc,
  getTodayConfirmedPlan,
  updateMealRating,
  type MealDocWithId,
} from "@/lib/db/meals";
import type { SuggestMealPrepParsed, SuggestMealsParsed } from "@/lib/ai/validators/meals";
import type { HealthProfileDoc } from "@/types/health-profile";

type MealSlot = "morning" | "afternoon" | "evening";
type Effort = "quick" | "medium" | "high";

const MEAL_LABELS: Record<MealSlot, string> = {
  morning: "Sáng",
  afternoon: "Trưa",
  evening: "Tối",
};

const SLOTS: MealSlot[] = ["morning", "afternoon", "evening"];

const EFFORT_OPTIONS: { id: Effort; label: string }[] = [
  { id: "quick", label: "Nhanh (<15 phút)" },
  { id: "medium", label: "Vừa (15–30 phút)" },
  { id: "high", label: "Kỳ công (>30 phút)" },
];

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

const RANDOM_FALLBACK_IDS = ["egg", "chicken_breast", "tomato", "rice", "spinach"] as const;

const ALL_QUICK_EFFORT: Record<MealSlot, Effort> = {
  morning: "quick",
  afternoon: "quick",
  evening: "quick",
};

function emptyCustomItems(): Record<PantryCategory, PantryPreset[]> {
  return { protein: [], vegetable: [], carb: [], fruit: [], other: [] };
}

function orderCategoryRows(
  basePresets: PantryPreset[],
  customInCategory: PantryPreset[],
  topIds: string[],
): PantryPreset[] {
  const combined = [...basePresets, ...customInCategory];
  const inIds = new Set(combined.map((p) => p.id));
  const head: PantryPreset[] = [];
  for (const id of topIds) {
    if (!inIds.has(id)) continue;
    const p = combined.find((x) => x.id === id);
    if (p) head.push(p);
  }
  const headIds = new Set(head.map((p) => p.id));
  const tail = combined.filter((p) => !headIds.has(p.id));
  return [...head, ...tail];
}

function flatCustomTags(items: Record<PantryCategory, PantryPreset[]>): { id: string; label: string }[] {
  return Object.values(items).flat();
}

export function HomeScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const { show } = useToast();
  const { tasteContext, refreshTaste } = useMesiTaste();
  const [stats, setStats] = useState<IngredientStat[]>([]);
  const [metaLoadError, setMetaLoadError] = useState<string | null>(null);

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
  const [customItems, setCustomItems] = useState<Record<PantryCategory, PantryPreset[]>>(() =>
    emptyCustomItems(),
  );

  const [addSheetState, setAddSheetState] = useState<{
    open: boolean;
    categoryId: PantryCategory | null;
  }>({ open: false, categoryId: null });

  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingRandom, setLoadingRandom] = useState(false);
  const [loadingPrep, setLoadingPrep] = useState(false);

  const [ratingDoc, setRatingDoc] = useState<MealDocWithId | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [mealPrepMode, setMealPrepMode] = useState(false);
  const [prepDayCount, setPrepDayCount] = useState(3);

  const [apiError, setApiError] = useState<string | null>(null);
  const [pantryReady, setPantryReady] = useState(false);
  const [homeHeadReady, setHomeHeadReady] = useState(false);
  const [todayPlanDoc, setTodayPlanDoc] = useState<MealDocWithId | null>(null);
  const [homeProfile, setHomeProfile] = useState<HealthProfileDoc | null>(null);
  const [formOverride, setFormOverride] = useState(false);

  const refreshTodayPlan = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([getHealthProfile(), getTodayConfirmedPlan()]);
      setHomeProfile(p ?? getDefaultHealthProfile());
      setTodayPlanDoc(t);
      if (t != null) {
        startTransition(() => setFormOverride(false));
      }
    } catch (e) {
      console.error(e);
      setHomeProfile(getDefaultHealthProfile());
      setTodayPlanDoc(null);
    } finally {
      setHomeHeadReady(true);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void refreshTodayPlan();
    });
  }, [pathname, refreshTodayPlan]);

  const refreshMeta = useCallback(async () => {
    setMetaLoadError(null);
    try {
      const s = await listIngredientStats();
      setStats(s);
      setCustomItems(hydrateCustomItemsFromStats(s));
    } catch (e) {
      console.error(e);
      setMetaLoadError(getUserFriendlyFirestoreMessage(e));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await listIngredientStats();
        if (cancelled) return;
        setStats(s);
        setCustomItems(hydrateCustomItemsFromStats(s));
        setPantryReady(true);
      } catch (e) {
        console.error(e);
        if (!cancelled) setMetaLoadError(getUserFriendlyFirestoreMessage(e));
        if (!cancelled) setPantryReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyCookAgainPayload = useCallback((payload: CookAgainPayloadV1) => {
    setFormOverride(true);
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
    setCustomItems((prev) => {
      const map = new Map(prev.other.map((x) => [x.id, x] as const));
      for (const t of payload.customTags) {
        map.set(t.id, t);
      }
      return { ...prev, other: [...map.values()] };
    });
  }, []);

  useEffect(() => {
    if (!pantryReady || typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("cookAgain") !== "1") return;
    const payload = readCookAgainPayload();
    if (!payload) {
      router.replace("/", { scroll: false });
      return;
    }
    startTransition(() => {
      applyCookAgainPayload(payload);
    });
    router.replace("/", { scroll: false });
  }, [pantryReady, router, applyCookAgainPayload]);

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

  const effectiveDiners = useMemo(() => {
    if (dinerPreset === "other") {
      const n = Number.parseInt(dinerOther, 10);
      if (Number.isFinite(n) && n >= 1) return Math.min(99, n);
      return 1;
    }
    return Number.parseInt(dinerPreset, 10) as 1 | 2 | 3;
  }, [dinerPreset, dinerOther]);

  const flatCustomList = useMemo(() => flatCustomTags(customItems), [customItems]);

  const addSheetCategoryLabel = useMemo(() => {
    if (!addSheetState.categoryId) return "";
    return PANTRY_CATEGORIES.find((c) => c.id === addSheetState.categoryId)?.label ?? "";
  }, [addSheetState.categoryId]);

  const existingLabelsForSheet = useMemo(() => {
    const id = addSheetState.categoryId;
    if (!id) return new Set<string>();
    const cat = PANTRY_CATEGORIES.find((c) => c.id === id);
    const labels = new Set<string>();
    if (cat) {
      for (const p of cat.presets) labels.add(p.label.toLowerCase());
    }
    for (const p of customItems[id]) {
      labels.add(p.label.toLowerCase());
    }
    return labels;
  }, [addSheetState.categoryId, customItems]);

  const toggleMeal = (slot: MealSlot) => {
    setMealOn((m) => ({ ...m, [slot]: !m[slot] }));
  };

  const setEffortFor = (slot: MealSlot, e: Effort) => {
    setEffort((x) => ({ ...x, [slot]: e }));
  };

  const openAddSheet = (catId: PantryCategory) => {
    setAddSheetState({ open: true, categoryId: catId });
  };

  const closeAddSheet = () => {
    setAddSheetState({ open: false, categoryId: null });
  };

  const onAddFromSheet = async (categoryId: PantryCategory, item: PantryPreset) => {
    setCustomItems((prev) => ({
      ...prev,
      [categoryId]: [...prev[categoryId], item],
    }));
    setSelectedPantry((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    try {
      await incrementIngredientUse(item.id, item.label, {
        category: categoryId,
        isCustom: true,
      });
      await refreshMeta();
    } catch (e) {
      console.error(e);
    }
  };

  const removeCustomItem = async (categoryId: PantryCategory, item: PantryPreset) => {
    setCustomItems((prev) => ({
      ...prev,
      [categoryId]: prev[categoryId].filter((x) => x.id !== item.id),
    }));
    setSelectedPantry((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    try {
      await deleteUserIngredient(item.id);
      await refreshMeta();
    } catch (e) {
      console.error(e);
    }
  };

  const togglePantryPreset = (id: string, label: string) => {
    const cat = getPresetCategoryById(id);
    setSelectedPantry((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (cat) {
          void incrementIngredientUse(id, label, { category: cat, isCustom: false }).catch((err) =>
            console.error(err),
          );
        } else {
          void incrementIngredientUse(id, label).catch((err) => console.error(err));
        }
      }
      return next;
    });
  };

  const togglePantryCustom = (categoryId: PantryCategory, id: string, label: string) => {
    setSelectedPantry((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        void incrementIngredientUse(id, label, { category: categoryId, isCustom: true }).catch((e) =>
          console.error(e),
        );
      }
      return next;
    });
  };

  const isCustomRowItem = (item: PantryPreset, categoryPresets: PantryPreset[]) =>
    !categoryPresets.some((p) => p.id === item.id);

  const runSuggestFlow = async () => {
    const enabled = SLOTS.some((s) => mealOn[s]);
    if (!enabled) {
      show("Chọn ít nhất một buổi để lên thực đơn.", "error");
      return;
    }

    setApiError(null);
    setLoadingMenu(true);
    try {
      const profile = (await getHealthProfile()) ?? getDefaultHealthProfile();
      const body = buildSuggestMealsRequest({
        profile,
        servings: effectiveDiners,
        mealOn,
        effort,
        selectedIngredientLabels: labelsFromPantrySelection(selectedPantry, flatCustomList),
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
      show("Đang mở gợi ý…", "info");
      router.push("/plan");
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Không gọi được API.");
    } finally {
      setLoadingMenu(false);
    }
  };

  const runRandomPlan = async () => {
    setApiError(null);
    setLoadingRandom(true);
    try {
      const profile = (await getHealthProfile()) ?? getDefaultHealthProfile();

      let ingredientLabels = stats
        .slice(0, 8)
        .map((r) => r.label.trim())
        .filter(Boolean);

      if (ingredientLabels.length === 0) {
        ingredientLabels = RANDOM_FALLBACK_IDS.map((id) => getPantryPreset(id)?.label).filter(
          (x): x is string => Boolean(x),
        );
      }

      const anyMeal = SLOTS.some((s) => mealOn[s]);
      const mealOnRandom: Record<MealSlot, boolean> = anyMeal
        ? { ...mealOn }
        : { morning: true, afternoon: true, evening: true };

      const body = buildSuggestMealsRequest({
        profile,
        servings: 1,
        mealOn: mealOnRandom,
        effort: ALL_QUICK_EFFORT,
        selectedIngredientLabels: [],
        ingredientLabelsOverride: ingredientLabels,
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
      show("Đang mở gợi ý…", "info");
      router.push("/plan");
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Không gọi được API.");
    } finally {
      setLoadingRandom(false);
    }
  };

  const runMealPrepFlow = async () => {
    const enabled = SLOTS.some((s) => mealOn[s]);
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
        selectedIngredientLabels: labelsFromPantrySelection(selectedPantry, flatCustomList),
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

  const renderPantryChip = (
    item: PantryPreset,
    categoryId: PantryCategory,
    categoryPresets: PantryPreset[],
  ) => {
    const on = selectedPantry.has(item.id);
    const customRow = isCustomRowItem(item, categoryPresets);
    const toggle = () =>
      customRow
        ? togglePantryCustom(categoryId, item.id, item.label)
        : togglePantryPreset(item.id, item.label);

    return (
      <div
        key={item.id}
        className={cn(
          "inline-flex max-w-full min-h-10 items-stretch overflow-hidden rounded-full border text-sm transition-colors",
          on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 bg-card text-foreground",
        )}
      >
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "max-w-[min(100%,12rem)] min-h-10 px-3 py-1.5 text-left",
            on ? "" : "hover:bg-muted",
          )}
        >
          <span className="truncate">{item.label}</span>
        </button>
        {customRow ? (
          <button
            type="button"
            onClick={() => void removeCustomItem(categoryId, item)}
            className={cn(
              "border-border shrink-0 border-l px-2 transition-colors",
              on
                ? "hover:bg-primary/90 text-primary-foreground"
                : "text-muted-foreground hover:bg-destructive/15 hover:text-destructive",
            )}
            aria-label={`Xoá ${item.label}`}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    );
  };

  const ctaBusy = loadingMenu || loadingRandom || loadingPrep;

  const visibleCategories = PANTRY_CATEGORIES.filter((c) => {
    if (c.id === "other") return customItems.other.length > 0;
    return true;
  });

  const showTodaySummary = homeHeadReady && todayPlanDoc != null && !formOverride;

  if (!homeHeadReady) {
    return (
      <div className="bg-background flex min-h-0 flex-1 flex-col">
        <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex shrink-0 items-center justify-between border-b px-4 py-3 backdrop-blur">
          <span className="text-foreground text-lg font-semibold tracking-tight">Mesi</span>
          <div className="w-20" />
        </header>
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">Đang tải…</div>
      </div>
    );
  }

  if (showTodaySummary && todayPlanDoc && homeProfile) {
    return (
      <div className="bg-background flex min-h-0 flex-1 flex-col">
        <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex shrink-0 items-center justify-between border-b px-4 py-3 backdrop-blur">
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
        <RatingPromptBanner
          doc={ratingDoc}
          busy={ratingBusy}
          onRate={(r) => void onRateMeal(r)}
          onSkip={() => void onSkipRating()}
        />
        <TodayPlanView
          plan={todayPlanDoc}
          healthProfile={homeProfile}
          onReplacedPlan={() => {
            setFormOverride(true);
            setTodayPlanDoc(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col">
      <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex shrink-0 items-center justify-between border-b px-4 py-3 backdrop-blur">
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
        className="mx-auto min-h-0 w-full max-w-[430px] flex-1 overflow-y-auto px-4 py-4 pb-28"
        style={{ scrollPaddingBottom: "max(7rem, env(safe-area-inset-bottom))" }}
      >
        <div className="space-y-6">
          {metaLoadError ? (
            <Alert variant="destructive">
              <AlertTitle>Không tải được dữ liệu</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span>{metaLoadError}</span>
                <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => void refreshMeta()}>
                  Thử lại
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

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
            {SLOTS.map((slot) => (
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

          <section className="space-y-4">
            <h2 className="text-foreground text-sm font-medium">Nhà đang có gì?</h2>

            {visibleCategories.map((cat) => {
              const rows = orderCategoryRows(cat.presets, customItems[cat.id], topIds);
              return (
                <div key={cat.id} className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{cat.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {rows.map((item) => renderPantryChip(item, cat.id, cat.presets))}
                    <button
                      type="button"
                      onClick={() => openAddSheet(cat.id)}
                      className="border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary inline-flex min-h-10 items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm transition-colors"
                      aria-label={`Thêm nguyên liệu vào ${cat.label}`}
                    >
                      <Plus className="size-3.5 shrink-0" aria-hidden />
                      Thêm
                    </button>
                  </div>
                </div>
              );
            })}

            {customItems.other.length === 0 ? (
              <button
                type="button"
                onClick={() => openAddSheet("other")}
                className="text-muted-foreground hover:text-primary mt-1 inline-flex items-center gap-1.5 text-sm transition-colors"
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                Thêm nguyên liệu khác
              </button>
            ) : null}
          </section>
        </div>
      </div>

      <AddIngredientSheet
        open={addSheetState.open}
        categoryId={addSheetState.categoryId}
        categoryLabel={addSheetCategoryLabel}
        existingLabelsLower={existingLabelsForSheet}
        onAdd={(cat, item) => {
          void onAddFromSheet(cat, item);
        }}
        onClose={closeAddSheet}
      />

      <div
        className={cn(
          "border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 mx-auto w-full max-w-[430px] border-t px-4 pt-3 pb-2 backdrop-blur-sm",
          "max-md:fixed max-md:right-0 max-md:left-0 max-md:z-40 max-md:bottom-[var(--bottom-nav-height,4rem)]",
          "md:relative md:z-10 md:shrink-0",
        )}
      >
        <div className="flex flex-col gap-0">
          <Button
            type="button"
            className="bg-primary text-primary-foreground min-h-12 w-full text-base font-semibold"
            disabled={ctaBusy}
            onClick={() => void (mealPrepMode ? runMealPrepFlow() : runSuggestFlow())}
          >
            {loadingPrep
              ? "Đang lập meal prep…"
              : loadingMenu
                ? "Đang nghĩ món…"
                : mealPrepMode
                  ? "Lên meal prep"
                  : "Lên thực đơn"}
          </Button>
          {!mealPrepMode ? (
            <button
              type="button"
              disabled={ctaBusy || loadingRandom}
              onClick={() => void runRandomPlan()}
              className="text-muted-foreground hover:text-primary mt-2 w-full text-center text-sm transition-colors disabled:opacity-50"
            >
              <Shuffle className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
              {loadingRandom ? "Đang chọn ngẫu nhiên…" : "hoặc random cho tôi"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
