/** UI + seed labels - stable preset IDs stored in Firestore. */

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

export type SupplementPreset = { id: string; label: string };

export const SUPPLEMENT_PRESETS: SupplementPreset[] = [
  { id: "fish_oil", label: "Dầu cá (Omega-3)" },
  { id: "vitamin_c", label: "Vitamin C" },
  { id: "vitamin_d", label: "Vitamin D" },
  { id: "zinc", label: "Kẽm (Zinc)" },
  { id: "probiotic", label: "Probiotic" },
];

/** Shown on plan + AI context - not user-editable in profile (chips only). */
const SUPPLEMENT_TIMING_BY_ID: Record<string, string> = {
  fish_oil: "Uống sau bữa có chất béo (sáng hoặc trưa)",
  vitamin_c: "Uống giữa buổi sáng hoặc sau bữa trưa",
  vitamin_d: "Uống sau bữa có chất béo",
  zinc: "Uống trước bữa tối 30 phút hoặc trước ngủ",
  probiotic: "Uống lúc bụng đói, sáng sớm trước bữa",
};

export function getSupplementTimingHint(supplementId: string): string | undefined {
  return SUPPLEMENT_TIMING_BY_ID[supplementId];
}

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
