import type {
  ApiMealTime,
  MealEffort,
  SuggestMealPrepRequest,
  SuggestMealsRequest,
  TasteContext,
} from "@/lib/ai/types/meal-api";
import type { HealthProfileDoc } from "@/types/health-profile";
import { getAvoidFoodLabel } from "@/lib/constants/health-presets";
import { getPantryPreset } from "@/lib/constants/pantry-presets";
import { primaryNutritionGoalKey } from "@/lib/meal-plan/nutrition-baseline";

export type HomeMealSlot = "morning" | "afternoon" | "evening";

/** afternoon → lunch, evening → dinner */
export function uiSlotToApiTime(slot: HomeMealSlot): ApiMealTime {
  if (slot === "afternoon") return "lunch";
  if (slot === "evening") return "dinner";
  return "morning";
}

export function apiTimeToUiSlot(time: ApiMealTime): HomeMealSlot {
  if (time === "lunch") return "afternoon";
  if (time === "dinner") return "evening";
  return "morning";
}

export type HomeEffort = "quick" | "medium" | "high";

function effortToApi(e: HomeEffort): MealEffort {
  return e;
}

export type BuildSuggestInput = {
  profile: HealthProfileDoc;
  servings: number;
  mealOn: Record<HomeMealSlot, boolean>;
  effort: Record<HomeMealSlot, HomeEffort>;
  /** Selected pantry ids → labels resolved via presets + custom map */
  selectedIngredientLabels: string[];
  /** When set (e.g. Random flow), overrides selectedIngredientLabels for the API payload */
  ingredientLabelsOverride?: string[];
  tasteContext?: TasteContext;
};

export function buildHealthProfilePayload(profile: HealthProfileDoc): SuggestMealsRequest["health_profile"] {
  const avoid: string[] = [];
  for (const id of profile.avoidFoodPresetIds) {
    const lab = getAvoidFoodLabel(id);
    if (lab) avoid.push(lab);
  }
  avoid.push(...profile.customAvoidLabels);
  return {
    avoid,
    goal: primaryNutritionGoalKey(profile.nutritionGoalIds),
    supplements: profile.supplements.map((x) => x.label),
  };
}

export function buildSuggestMealsRequest(input: BuildSuggestInput): SuggestMealsRequest {
  const {
    profile,
    servings,
    mealOn,
    effort,
    selectedIngredientLabels,
    ingredientLabelsOverride,
    tasteContext,
  } = input;

  const meals: { time: ApiMealTime; effort: MealEffort }[] = [];
  const slots: HomeMealSlot[] = ["morning", "afternoon", "evening"];
  for (const s of slots) {
    if (mealOn[s]) {
      meals.push({
        time: uiSlotToApiTime(s),
        effort: effortToApi(effort[s]),
      });
    }
  }

  const ingredientLines =
    ingredientLabelsOverride !== undefined
      ? ingredientLabelsOverride
      : selectedIngredientLabels;

  return {
    ingredients:
      ingredientLines.length > 0 ? ingredientLines : ["(chưa chọn — gợi ý món linh hoạt)"],
    meals,
    servings: Math.max(1, Math.min(99, servings)),
    health_profile: buildHealthProfilePayload(profile),
    ...(tasteContext &&
    (tasteContext.liked_meal_names.length > 0 || tasteContext.disliked_meal_names.length > 0)
      ? { taste_context: tasteContext }
      : {}),
  };
}

export function buildSuggestMealPrepRequest(
  input: BuildSuggestInput & { prepDayCount: number },
): SuggestMealPrepRequest {
  const base = buildSuggestMealsRequest(input);
  const n = Math.max(2, Math.min(7, Math.floor(input.prepDayCount)));
  return {
    ...base,
    prep_day_count: n,
  };
}

/** Resolve labels from selected ids (preset + custom id→label map). */
export function labelsFromPantrySelection(
  selectedIds: Set<string>,
  customTags: { id: string; label: string }[],
): string[] {
  const customById = new Map(customTags.map((c) => [c.id, c.label]));
  const out: string[] = [];
  for (const id of selectedIds) {
    const preset = getPantryPreset(id);
    const lab = preset?.label ?? customById.get(id);
    if (lab) out.push(lab);
  }
  return out;
}
