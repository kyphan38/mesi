/** UI + seed labels - stable preset IDs stored in Firestore. */

import type { HealthProfileDoc, MacroTargets } from "@/types/health-profile";

export type AvoidFoodPreset = { id: string; label: string };

/** Default daily macro targets by Firestore nutrition goal id (~65kg male, moderately active). */
export const MACRO_TARGETS_BY_GOAL: Record<string, MacroTargets> = {
  eat_clean_skin: { calories: 1900, protein_g: 100, carb_g: 150, fat_g: 55 },
  lose_weight: { calories: 1600, protein_g: 110, carb_g: 120, fat_g: 45 },
  gain_muscle: { calories: 2400, protein_g: 130, carb_g: 250, fat_g: 65 },
  maintain_weight: { calories: 2000, protein_g: 100, carb_g: 200, fat_g: 55 },
};

function macroTargetsValid(m: MacroTargets): boolean {
  return (
    Number.isFinite(m.calories) &&
    m.calories > 0 &&
    Number.isFinite(m.protein_g) &&
    m.protein_g >= 0 &&
    Number.isFinite(m.carb_g) &&
    m.carb_g >= 0 &&
    Number.isFinite(m.fat_g) &&
    m.fat_g >= 0
  );
}

export function resolveMacroTargets(
  profile: Pick<HealthProfileDoc, "nutritionGoalIds" | "macroTargets">,
): MacroTargets {
  if (profile.macroTargets && macroTargetsValid(profile.macroTargets)) {
    return profile.macroTargets;
  }
  const id = profile.nutritionGoalIds[0]?.trim() || "eat_clean_skin";
  return MACRO_TARGETS_BY_GOAL[id] ?? MACRO_TARGETS_BY_GOAL.eat_clean_skin!;
}

/** Per-person daily targets × servings = household day targets for UI / prompts. */
export function scaleMacroTargetsByServings(t: MacroTargets, servings: number): MacroTargets {
  const s = Math.max(1, Math.min(99, Math.floor(servings)));
  return {
    calories: Math.round(t.calories * s),
    protein_g: Math.round(t.protein_g * s),
    carb_g: Math.round(t.carb_g * s),
    fat_g: Math.round(t.fat_g * s),
  };
}

const PLANNED_MEALS_MAX = 3;

/**
 * Scale household **full-day** targets to the share of the day covered by planned meals.
 * Uses an even split: one meal ≈ 1/3 of daily macros (simple, guideline-friendly).
 * - 1 slot filled → targets × (1/3)
 * - 2 slots → × (2/3)
 * - 3 slots → × 1
 * If `plannedMealSlotCount` is 0, returns full-day targets (denominator 1).
 */
export function scaleMacroTargetsByPlannedMealSlots(
  householdFullDayTargets: MacroTargets,
  plannedMealSlotCount: number,
): MacroTargets {
  const n =
    plannedMealSlotCount <= 0
      ? PLANNED_MEALS_MAX
      : Math.min(PLANNED_MEALS_MAX, Math.max(1, Math.floor(plannedMealSlotCount)));
  const factor = n / PLANNED_MEALS_MAX;
  return {
    calories: Math.round(householdFullDayTargets.calories * factor),
    protein_g: Math.round(householdFullDayTargets.protein_g * factor),
    carb_g: Math.round(householdFullDayTargets.carb_g * factor),
    fat_g: Math.round(householdFullDayTargets.fat_g * factor),
  };
}

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
