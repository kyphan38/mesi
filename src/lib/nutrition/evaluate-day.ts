import type { MealOption } from "@/lib/ai/validators/meals";
import { baselineTargets, type ApiNutritionGoalKey } from "@/lib/meal-plan/nutrition-baseline";

export type NutritionGapDetail = {
  nutrient: string;
  current_g?: number;
  current_kcal?: number;
  target_g?: number;
  target_kcal_min?: number;
  target_kcal_max?: number;
  suggestion: string;
};

export type NutritionGaps = {
  has_gaps: boolean;
  details: NutritionGapDetail[];
  shopping_suggestion?: string;
};

function sumMeals(meals: MealOption[]) {
  let protein = 0;
  let carb = 0;
  let fat = 0;
  let kcal = 0;
  for (const m of meals) {
    protein += m.macros.protein_g;
    carb += m.macros.carb_g;
    fat += m.macros.fat_g;
    kcal += m.calories;
  }
  return { protein, carb, fat, kcal };
}

/**
 * Deterministic day totals vs baseline — call after user picks one option per meal.
 * Does not call AI.
 */
export function evaluateDayNutrition(
  selectedMeals: MealOption[],
  primaryGoal: ApiNutritionGoalKey,
): NutritionGaps {
  const t = baselineTargets(primaryGoal);
  const { protein, fat, kcal } = sumMeals(selectedMeals);
  const details: NutritionGapDetail[] = [];

  if (protein < t.proteinMinG) {
    details.push({
      nutrient: "protein",
      current_g: Math.round(protein * 10) / 10,
      target_g: t.proteinMinG,
      suggestion:
        "Thêm nguồn đạm gọn: trứng luộc, đậu hủ, ức gà nướng, hoặc cá hấp vào bữa sáng hoặc tối.",
    });
  }

  if (t.fatMinG != null && fat < t.fatMinG) {
    details.push({
      nutrient: "fat_lanh",
      current_g: Math.round(fat * 10) / 10,
      target_g: t.fatMinG,
      suggestion: "Bổ sung thêm dầu olive/dầu mè vừa đủ hoặc bơ thực vật/omega-3 trong bữa.",
    });
  }

  if (t.calorieMin != null && kcal < t.calorieMin) {
    details.push({
      nutrient: "calories",
      current_kcal: Math.round(kcal),
      target_kcal_min: t.calorieMin,
      target_kcal_max: t.calorieMax,
      suggestion: "Tăng nhẹ khẩu phần carb lành hoặc thêm một món phụ giàu đạm/bơ đậu.",
    });
  }

  if (t.calorieMax != null && kcal > t.calorieMax) {
    details.push({
      nutrient: "calories",
      current_kcal: Math.round(kcal),
      target_kcal_min: t.calorieMin,
      target_kcal_max: t.calorieMax,
      suggestion: "Giảm nhẹ dầu/tinh bột tinh chế hoặc chia nhỏ khẩu phần cho khớp calo mục tiêu.",
    });
  }

  const shopping =
    details.length > 0
      ? "Nếu tiện, có thể mua thêm đậu hủ, trứng hoặc rau xanh để lấp các khoản thiếu — không bắt buộc."
      : undefined;

  return {
    has_gaps: details.length > 0,
    details,
    shopping_suggestion: shopping,
  };
}
