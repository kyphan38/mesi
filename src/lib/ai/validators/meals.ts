import { z } from "zod";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";

/** Gemini often returns ingredients / missing_ingredients as one Vietnamese sentence; schema expects string[]. */
function coerceToStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((x) => (typeof x === "string" ? x : String(x)))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const parts = value.split(/[,，;、]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts;
    const t = value.trim();
    return t ? [t] : [];
  }
  return [];
}

function normalizeOneMealOption(opt: unknown): unknown {
  if (opt == null || typeof opt !== "object" || Array.isArray(opt)) return opt;
  const o = { ...(opt as Record<string, unknown>) };
  o.ingredients = coerceToStringList(o.ingredients);
  o.missing_ingredients = coerceToStringList(o.missing_ingredients);
  return o;
}

function normalizeSuggestMealsGeminiOutput(parsed: unknown, slots: ApiMealTime[]): unknown {
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const root = { ...(parsed as Record<string, unknown>) };
  const meals = root.meals;
  if (meals == null || typeof meals !== "object" || Array.isArray(meals)) return parsed;
  const mealsOut: Record<string, unknown> = { ...(meals as Record<string, unknown>) };
  for (const slot of slots) {
    const arr = mealsOut[slot];
    if (!Array.isArray(arr)) continue;
    mealsOut[slot] = arr.map((item) => normalizeOneMealOption(item));
  }
  root.meals = mealsOut;
  return root;
}

function normalizeMealPrepGeminiOutput(parsed: unknown): unknown {
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const root = { ...(parsed as Record<string, unknown>) };
  const sched = root.meal_schedule;
  if (!Array.isArray(sched)) return parsed;
  root.meal_schedule = sched.map((row) => {
    if (row == null || typeof row !== "object" || Array.isArray(row)) return row;
    const r = { ...(row as Record<string, unknown>) };
    r.meal = normalizeOneMealOption(r.meal);
    return r;
  });
  return root;
}

function normalizeAdjustMealGeminiOutput(parsed: unknown): unknown {
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const root = { ...(parsed as Record<string, unknown>) };
  if ("meal" in root) root.meal = normalizeOneMealOption(root.meal);
  return root;
}

export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (m?.[1]) return m[1]!.trim();
  return trimmed;
}

export const glycemicLoadSchema = z.enum(["low", "medium", "high"]);
export const insulinSpikeSchema = z.enum(["Thấp", "Trung bình", "Cao"]);

export const mealOptionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  ingredients: z.array(z.string()).min(1),
  calories: z.number().nonnegative(),
  macros: z.object({
    protein_g: z.number().nonnegative(),
    carb_g: z.number().nonnegative(),
    fat_g: z.number().nonnegative(),
  }),
  glycemic_load: glycemicLoadSchema,
  insulin_spike: insulinSpikeSchema,
  prep_time_minutes: z.number().nonnegative(),
  cooking_method: z.string().min(1),
  missing_ingredients: z.array(z.string()),
  fun_fact: z.string().min(1),
});

export type MealOption = z.infer<typeof mealOptionSchema>;

export function buildSuggestMealsResponseSchema(slots: ApiMealTime[]) {
  const mealArrays = Object.fromEntries(
    slots.map((s) => [s, z.array(mealOptionSchema).length(3)]),
  ) as Record<ApiMealTime, z.ZodArray<typeof mealOptionSchema>>;
  return z.object({
    meals: z.object(mealArrays),
    supplement_plan_hint: z.string().optional(),
  });
}

export type SuggestMealsParsed = z.infer<ReturnType<typeof buildSuggestMealsResponseSchema>>;

export type ParseMealsResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function parseSuggestMealsJson(
  raw: string,
  slots: ApiMealTime[],
): ParseMealsResult<SuggestMealsParsed> {
  const stripped = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { success: false, error: "Invalid JSON from model" };
  }
  parsed = normalizeSuggestMealsGeminiOutput(parsed, slots);
  const schema = buildSuggestMealsResponseSchema(slots);
  const out = schema.safeParse(parsed);
  if (!out.success) {
    return { success: false, error: out.error.message };
  }
  return { success: true, data: out.data };
}

const adjustMealResponseSchema = z.object({
  meal: mealOptionSchema,
});

export type AdjustMealParsed = z.infer<typeof adjustMealResponseSchema>;

export function parseAdjustMealJson(raw: string): ParseMealsResult<AdjustMealParsed> {
  const stripped = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { success: false, error: "Invalid JSON from model" };
  }
  parsed = normalizeAdjustMealGeminiOutput(parsed);
  const out = adjustMealResponseSchema.safeParse(parsed);
  if (!out.success) {
    return { success: false, error: out.error.message };
  }
  return { success: true, data: out.data };
}

const shoppingSuggestResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        ingredient: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .min(1)
    .max(4),
  reassurance_note: z.string().min(1),
});

export type ShoppingSuggestParsed = z.infer<typeof shoppingSuggestResponseSchema>;

export function parseShoppingSuggestJson(raw: string): ParseMealsResult<ShoppingSuggestParsed> {
  const stripped = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { success: false, error: "Invalid JSON from model" };
  }
  const out = shoppingSuggestResponseSchema.safeParse(parsed);
  if (!out.success) {
    return { success: false, error: out.error.message };
  }
  return { success: true, data: out.data };
}

const recipeDetailResponseSchema = z.object({
  steps: z.array(z.string().min(1)).min(1),
  tips: z.string().optional(),
});

export type RecipeDetailParsed = z.infer<typeof recipeDetailResponseSchema>;

export function parseRecipeDetailJson(raw: string): ParseMealsResult<RecipeDetailParsed> {
  const stripped = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { success: false, error: "Invalid JSON from model" };
  }
  const out = recipeDetailResponseSchema.safeParse(parsed);
  if (!out.success) {
    return { success: false, error: out.error.message };
  }
  return { success: true, data: out.data };
}

export const mealKindSchema = z.enum(["cook_fresh", "reheat", "from_fridge"]);

const mealPrepScheduleEntrySchema = z.object({
  day_index: z.number().int().min(1).max(14),
  slot: z.enum(["morning", "lunch", "dinner"]),
  meal: mealOptionSchema,
  meal_kind: mealKindSchema,
});

export const suggestMealPrepResponseSchema = z.object({
  prep_instructions: z.string().min(1),
  meal_schedule: z.array(mealPrepScheduleEntrySchema).min(1),
  batch_shopping_list: z.array(z.string()).optional(),
  supplement_plan_hint: z.string().optional(),
});

export type MealPrepScheduleEntry = z.infer<typeof mealPrepScheduleEntrySchema>;
export type SuggestMealPrepParsed = z.infer<typeof suggestMealPrepResponseSchema>;

export function parseSuggestMealPrepJson(
  raw: string,
  prepDayCount: number,
): ParseMealsResult<SuggestMealPrepParsed> {
  const stripped = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { success: false, error: "Invalid JSON from model" };
  }
  parsed = normalizeMealPrepGeminiOutput(parsed);
  const out = suggestMealPrepResponseSchema.safeParse(parsed);
  if (!out.success) {
    return { success: false, error: out.error.message };
  }
  const n = Math.max(2, Math.min(7, prepDayCount));
  for (const row of out.data.meal_schedule) {
    if (row.day_index < 1 || row.day_index > n) {
      return {
        success: false,
        error: `meal_schedule day_index ${row.day_index} out of range 1..${n}`,
      };
    }
  }
  return { success: true, data: out.data };
}
