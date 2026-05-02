/** UI + seed labels — stable preset IDs stored in Firestore. */

export type AvoidFoodPreset = { id: string; label: string };

export const AVOID_FOOD_PRESETS: AvoidFoodPreset[] = [
  { id: "refined_sugar", label: "Đường tinh luyện" },
  { id: "dairy", label: "Sữa bò / phô mai" },
  { id: "bad_fats", label: "Dầu mỡ xấu (dầu chiên lại, mỡ động vật)" },
  { id: "gluten", label: "Gluten" },
  { id: "peanuts", label: "Đậu phộng" },
  { id: "shellfish", label: "Hải sản có vỏ" },
];

export type NutritionGoalPreset = { id: string; label: string };

export const NUTRITION_GOALS: NutritionGoalPreset[] = [
  { id: "eat_clean_skin", label: "Ăn sạch / kiểm soát mụn" },
  { id: "lose_weight", label: "Giảm cân" },
  { id: "gain_muscle", label: "Tăng cơ" },
  { id: "maintain_weight", label: "Duy trì cân nặng" },
];

export type SupplementPreset = { id: string; label: string; suggestedTime: string };

export const SUPPLEMENT_PRESETS: SupplementPreset[] = [
  { id: "fish_oil", label: "Dầu cá (Omega-3)", suggestedTime: "Sau bữa sáng" },
  { id: "vitamin_c", label: "Vitamin C", suggestedTime: "Sau bữa trưa" },
  { id: "vitamin_d", label: "Vitamin D", suggestedTime: "Sau bữa sáng" },
  { id: "zinc", label: "Kẽm (Zinc)", suggestedTime: "Sau bữa tối" },
  { id: "probiotic", label: "Probiotic", suggestedTime: "Trước khi ngủ" },
];

const avoidMap = new Map(AVOID_FOOD_PRESETS.map((p) => [p.id, p.label]));
const goalMap = new Map(NUTRITION_GOALS.map((p) => [p.id, p.label]));
const supplementPresetMap = new Map(SUPPLEMENT_PRESETS.map((p) => [p.id, p]));

export function getAvoidFoodLabel(id: string): string | undefined {
  return avoidMap.get(id);
}

export function getNutritionGoalLabel(id: string): string | undefined {
  return goalMap.get(id);
}

export function getSupplementPreset(id: string): SupplementPreset | undefined {
  return supplementPresetMap.get(id);
}
