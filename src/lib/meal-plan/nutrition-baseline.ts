/**
 * API / baseline keys for prompts and client-side day evaluation.
 *
 * primaryNutritionGoalKey — deliberate simplification: first Firestore id only;
 * blending multi-goal baselines is TBD.
 */

export type ApiNutritionGoalKey =
  | "clear_skin"
  | "lose_weight"
  | "gain_muscle"
  | "maintain_weight";

const FIRESTORE_TO_API: Record<string, ApiNutritionGoalKey> = {
  eat_clean_skin: "clear_skin",
  lose_weight: "lose_weight",
  gain_muscle: "gain_muscle",
  maintain_weight: "maintain_weight",
};

/** Pick primary goal from Firestore `nutritionGoalIds` — see module comment above. */
export function primaryNutritionGoalKey(nutritionGoalIds: string[]): ApiNutritionGoalKey {
  const first = nutritionGoalIds[0]?.trim();
  if (first && FIRESTORE_TO_API[first]) return FIRESTORE_TO_API[first]!;
  return "clear_skin";
}

/** Vietnamese baseline copy injected into Gemini system prompts. */
export function baselinePromptBlock(goal: ApiNutritionGoalKey): string {
  switch (goal) {
    case "clear_skin":
      return [
        "MỤC TIÊU BASELINE (da/sạch — tham chiếu khi thiết kế bữa):",
        "- Protein tổng ngày ≥ 60g",
        "- Chất béo lành (ưu tiên olive/dầu cá/mè, tránh trans) ≥ 30g tổng",
        "- Calo ngày khoảng 1800–2200 kcal (ước lượng theo khẩu phần)",
        "Ưu tiên thực phẩm giàu omega-3, kẽm, vitamin A, chất chống viêm.",
      ].join("\n");
    case "lose_weight":
      return [
        "MỤC TIÊU BASELINE (giảm cân):",
        "- Protein tổng ngày ≥ 70g",
        "- Calo ngày khoảng 1500–1800 kcal",
      ].join("\n");
    case "gain_muscle":
      return [
        "MỤC TIÊU BASELINE (tăng cơ):",
        "- Protein tổng ngày ≥ 100g",
        "- Calo ngày khoảng 2200–2800 kcal",
      ].join("\n");
    case "maintain_weight":
      return [
        "MỤC TIÊU BASELINE (duy trì):",
        "- Protein tổng ngày khoảng 60–80g",
        "- Calo ngày khoảng 1800–2400 kcal",
      ].join("\n");
    default:
      return baselinePromptBlock("clear_skin");
  }
}

/** Numeric targets for client-side `evaluateDayNutrition` (approximate). */
export type DayBaselineTargets = {
  proteinMinG: number;
  fatMinG?: number;
  calorieMin?: number;
  calorieMax?: number;
};

export function baselineTargets(goal: ApiNutritionGoalKey): DayBaselineTargets {
  switch (goal) {
    case "clear_skin":
      return { proteinMinG: 60, fatMinG: 30, calorieMin: 1800, calorieMax: 2200 };
    case "lose_weight":
      return { proteinMinG: 70, calorieMin: 1500, calorieMax: 1800 };
    case "gain_muscle":
      return { proteinMinG: 100, calorieMin: 2200, calorieMax: 2800 };
    case "maintain_weight":
      return { proteinMinG: 60, calorieMin: 1800, calorieMax: 2400 };
    default:
      return baselineTargets("clear_skin");
  }
}
