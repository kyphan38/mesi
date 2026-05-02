import type { SuggestMealsParsed, SuggestMealPrepParsed } from "@/lib/ai/validators/meals";
import type { SuggestMealsRequest, SuggestMealPrepRequest } from "@/lib/ai/types/meal-api";
import type { HealthProfileDoc } from "@/types/health-profile";

export const MESI_PLAN_DRAFT_KEY = "mesi_plan_draft_v1";
export const MESI_MEAL_PREP_DRAFT_KEY = "mesi_meal_prep_draft_v1";

export type PlanDraftV1 = {
  version: 1;
  suggestResult: SuggestMealsParsed;
  suggestRequest: SuggestMealsRequest;
  profileSnapshot: HealthProfileDoc;
};

export type MealPrepPlanDraftV1 = {
  version: 1;
  prepDayCount: number;
  suggestResult: SuggestMealPrepParsed;
  suggestRequest: SuggestMealPrepRequest;
  profileSnapshot: HealthProfileDoc;
};

export function writePlanDraft(draft: PlanDraftV1): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(MESI_PLAN_DRAFT_KEY, JSON.stringify(draft));
}

export function readPlanDraft(): PlanDraftV1 | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(MESI_PLAN_DRAFT_KEY);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as PlanDraftV1;
    if (o.version !== 1 || !o.suggestResult?.meals || !o.suggestRequest || !o.profileSnapshot) {
      return null;
    }
    return o;
  } catch {
    return null;
  }
}

export function clearPlanDraft(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(MESI_PLAN_DRAFT_KEY);
}

export function writeMealPrepDraft(draft: MealPrepPlanDraftV1): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(MESI_MEAL_PREP_DRAFT_KEY, JSON.stringify(draft));
}

export function readMealPrepDraft(): MealPrepPlanDraftV1 | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(MESI_MEAL_PREP_DRAFT_KEY);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as MealPrepPlanDraftV1;
    if (
      o.version !== 1 ||
      !o.suggestResult?.meal_schedule ||
      !o.suggestRequest?.prep_day_count ||
      !o.profileSnapshot
    ) {
      return null;
    }
    return o;
  } catch {
    return null;
  }
}

export function clearMealPrepDraft(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(MESI_MEAL_PREP_DRAFT_KEY);
}
