import type { ApiNutritionGoalKey } from "@/lib/meal-plan/nutrition-baseline";

export type ApiMealTime = "morning" | "lunch" | "dinner";

export type MealEffort = "quick" | "medium" | "high";

/** User taste hints from meal ratings (client → API). */
export type TasteContext = {
  liked_meal_names: string[];
  disliked_meal_names: string[];
};

/** POST /api/ai/suggest-meals — request shape */
export type SuggestMealsRequest = {
  ingredients: string[];
  meals: { time: ApiMealTime; effort: MealEffort }[];
  servings: number;
  health_profile: {
    avoid: string[];
    goal: ApiNutritionGoalKey;
    supplements: string[];
    macro_targets: {
      calories: number;
      protein_g: number;
      carb_g: number;
      fat_g: number;
    };
  };
  taste_context?: TasteContext;
};

/** POST /api/ai/suggest-meal-prep */
export type SuggestMealPrepRequest = SuggestMealsRequest & {
  prep_day_count: number;
};
