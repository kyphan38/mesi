import type { MealOption } from "@/lib/ai/validators/meals";

export type InsulinSpikeLabel = "Thấp" | "Trung bình" | "Cao";

const INSULIN_ORDER: Record<InsulinSpikeLabel, number> = {
  Thấp: 0,
  "Trung bình": 1,
  Cao: 2,
};

const ORDER_TO_LABEL: InsulinSpikeLabel[] = ["Thấp", "Trung bình", "Cao"];

function ordinalToLabel(x: number): InsulinSpikeLabel {
  const clamped = Math.max(0, Math.min(2, Math.round(x)));
  return ORDER_TO_LABEL[clamped]!;
}

/**
 * Plurality wins; if tie → median ordinal (so 2 Thấp + 1 Cao → Thấp; 1+1+1 → TB;
 * 2 meals Thấp+Cao → TB). Tune here only if product feedback changes.
 */
export function aggregateDayInsulin(spikes: InsulinSpikeLabel[]): InsulinSpikeLabel {
  if (spikes.length === 0) return "Thấp";
  const counts: Record<InsulinSpikeLabel, number> = { Thấp: 0, "Trung bình": 0, Cao: 0 };
  for (const s of spikes) counts[s]++;
  const max = Math.max(counts["Thấp"], counts["Trung bình"], counts["Cao"]);
  const winners = (["Thấp", "Trung bình", "Cao"] as const).filter((k) => counts[k] === max);
  if (winners.length === 1) return winners[0]!;

  const ordinals = spikes.map((s) => INSULIN_ORDER[s]).sort((a, b) => a - b);
  const n = ordinals.length;
  const medianOrdinal =
    n % 2 === 1 ? ordinals[(n - 1) / 2]! : Math.round((ordinals[n / 2 - 1]! + ordinals[n / 2]!) / 2);
  return ordinalToLabel(medianOrdinal);
}

export function aggregateFromMeals(meals: MealOption[]): InsulinSpikeLabel {
  return aggregateDayInsulin(meals.map((m) => m.insulin_spike));
}

export type GlycemicLoadLevel = "low" | "medium" | "high";

/** True if any meal has high GL - drives mild starch warning on summary. */
export function anyHighGlycemicLoad(meals: MealOption[]): boolean {
  return meals.some((m) => m.glycemic_load === "high");
}

export function sumDayTotals(meals: MealOption[]) {
  let calories = 0;
  let protein_g = 0;
  let carb_g = 0;
  let fat_g = 0;
  for (const m of meals) {
    calories += m.calories;
    protein_g += m.macros.protein_g;
    carb_g += m.macros.carb_g;
    fat_g += m.macros.fat_g;
  }
  return {
    calories,
    protein_g,
    carb_g,
    fat_g,
  };
}

/** Macro calories for stacked bar (approximate). */
export function macroCaloriePercents(macros: { protein_g: number; carb_g: number; fat_g: number }) {
  const pCals = macros.protein_g * 4;
  const cCals = macros.carb_g * 4;
  const fCals = macros.fat_g * 9;
  const t = pCals + cCals + fCals;
  if (t <= 0) return { p: 0, c: 0, f: 0 };
  return {
    p: (100 * pCals) / t,
    c: (100 * cCals) / t,
    f: (100 * fCals) / t,
  };
}
