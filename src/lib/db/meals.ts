"use client";

import {
  addDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import type { RecipeDetailParsed } from "@/lib/ai/validators/meals";
import type { MealOption } from "@/lib/ai/validators/meals";
import { ingredientLineDocId } from "@/lib/meal-plan/ingredient-id";
import type { InsulinSpikeLabel } from "@/lib/plan/day-insulin";
import { userCollectionRef, userDocRef } from "@/lib/db/firestore";
import { incrementIngredientUse } from "@/lib/db/ingredients";
import { localDateKey } from "@/lib/db/plan-intents";

export type MealRating = "good" | "neutral" | "bad" | "skipped";

export type ConfirmedSlotEntry = {
  meal: MealOption;
  recipe?: RecipeDetailParsed;
  is_reheated?: boolean;
};

export type ConfirmedPlanDoc = {
  type: "confirmed";
  dateKey: string;
  createdAt: number;
  servings: number;
  slots: Partial<Record<ApiMealTime, ConfirmedSlotEntry>>;
  dayTotals: { calories: number; protein_g: number; carb_g: number; fat_g: number };
  dayInsulin: InsulinSpikeLabel;
  supplementReminder?: string;
  waterTargetLiters: number;
  shoppingNote?: string;
  rating?: MealRating;
  ratedAt?: number;
  is_meal_prep?: boolean;
  prep_batch_id?: string;
  prep_instructions?: string;
};

const FINAL_RATINGS: MealRating[] = ["good", "neutral", "bad", "skipped"];

function hasFinalRating(rating: unknown): boolean {
  return typeof rating === "string" && FINAL_RATINGS.includes(rating as MealRating);
}

export async function saveConfirmedPlan(doc: ConfirmedPlanDoc): Promise<string> {
  const ref = await addDoc(userCollectionRef("meals"), doc as DocumentData);
  return ref.id;
}

export async function mergeRecipeIntoPlanDoc(
  docId: string,
  slot: ApiMealTime,
  recipe: RecipeDetailParsed,
): Promise<void> {
  const ref = userDocRef("meals", docId);
  await updateDoc(ref, {
    [`slots.${slot}.recipe`]: recipe,
  } as DocumentData);
}

/** Bump ingredient stats from confirmed meals (best-effort per ingredient line). */
export async function incrementIngredientsFromMeals(meals: MealOption[]): Promise<void> {
  for (const m of meals) {
    for (const line of m.ingredients) {
      const lab = line.trim().slice(0, 200);
      if (!lab) continue;
      await incrementIngredientUse(ingredientLineDocId(lab), lab);
    }
  }
}

export function buildConfirmedPlanPayload(input: {
  slots: Partial<Record<ApiMealTime, ConfirmedSlotEntry>>;
  servings: number;
  dayTotals: ConfirmedPlanDoc["dayTotals"];
  dayInsulin: InsulinSpikeLabel;
  supplementReminder?: string;
  waterTargetLiters: number;
  shoppingNote?: string;
  dateKey?: string;
  is_meal_prep?: boolean;
  prep_batch_id?: string;
  prep_instructions?: string;
}): ConfirmedPlanDoc {
  return {
    type: "confirmed",
    dateKey: input.dateKey ?? localDateKey(),
    createdAt: Date.now(),
    servings: input.servings,
    slots: input.slots,
    dayTotals: input.dayTotals,
    dayInsulin: input.dayInsulin,
    supplementReminder: input.supplementReminder,
    waterTargetLiters: input.waterTargetLiters,
    shoppingNote: input.shoppingNote,
    ...(input.is_meal_prep ? { is_meal_prep: true } : {}),
    ...(input.prep_batch_id ? { prep_batch_id: input.prep_batch_id } : {}),
    ...(input.prep_instructions ? { prep_instructions: input.prep_instructions } : {}),
  };
}

export type MealDocWithId = { id: string; data: ConfirmedPlanDoc };

/** Confirmed meals ordered newest first. */
export async function listConfirmedMealsForHistory(opts: { limit: number }): Promise<MealDocWithId[]> {
  const col = userCollectionRef("meals");
  const q = query(
    col,
    where("type", "==", "confirmed"),
    orderBy("createdAt", "desc"),
    limit(Math.min(200, Math.max(1, opts.limit))),
  );
  const snap = await getDocs(q);
  const out: MealDocWithId[] = [];
  snap.forEach((s) => {
    const d = s.data() as ConfirmedPlanDoc;
    if (d.type === "confirmed") out.push({ id: s.id, data: d });
  });
  return out;
}

export async function getMealDoc(docId: string): Promise<MealDocWithId | null> {
  const ref = userDocRef("meals", docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data() as ConfirmedPlanDoc;
  if (d.type !== "confirmed") return null;
  return { id: snap.id, data: d };
}

export async function listMealsByPrepBatchId(batchId: string): Promise<MealDocWithId[]> {
  const col = userCollectionRef("meals");
  const q = query(col, where("prep_batch_id", "==", batchId), where("type", "==", "confirmed"));
  const snap = await getDocs(q);
  const out: MealDocWithId[] = [];
  snap.forEach((s) => {
    const d = s.data() as ConfirmedPlanDoc;
    if (d.type === "confirmed") out.push({ id: s.id, data: d });
  });
  out.sort((a, b) => a.data.dateKey.localeCompare(b.data.dateKey));
  return out;
}

export async function updateMealRating(docId: string, rating: MealRating): Promise<void> {
  const ref = userDocRef("meals", docId);
  await updateDoc(ref, {
    rating,
    ratedAt: Date.now(),
  } as DocumentData);
}

/**
 * Single doc to prompt rating: newest confirmed meal for a past calendar day that has no final rating yet.
 */
export async function getLatestUnratedConfirmedDoc(): Promise<MealDocWithId | null> {
  const today = localDateKey();
  const rows = await listConfirmedMealsForHistory({ limit: 80 });
  for (const row of rows) {
    if (row.data.dateKey >= today) continue;
    if (hasFinalRating(row.data.rating)) continue;
    return row;
  }
  return null;
}

export function extractMealNamesFromDoc(doc: ConfirmedPlanDoc): string[] {
  const names: string[] = [];
  for (const slot of Object.keys(doc.slots) as ApiMealTime[]) {
    const e = doc.slots[slot];
    if (e?.meal?.name) names.push(e.meal.name);
  }
  return names;
}

export type TasteContextPayload = {
  liked_meal_names: string[];
  disliked_meal_names: string[];
};

/** Build taste hints from recently rated confirmed docs (client-side filter). */
export function buildTasteContextFromHistory(rows: MealDocWithId[], maxRatedDocs = 10): TasteContextPayload {
  const liked: string[] = [];
  const disliked: string[] = [];
  let used = 0;
  for (const row of rows) {
    const r = row.data.rating;
    if (r !== "good" && r !== "bad") continue;
    const names = extractMealNamesFromDoc(row.data);
    if (names.length === 0) continue;
    if (r === "good") liked.push(...names);
    else disliked.push(...names);
    used += 1;
    if (used >= maxRatedDocs) break;
  }
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  return {
    liked_meal_names: uniq(liked).slice(0, 40),
    disliked_meal_names: uniq(disliked).slice(0, 40),
  };
}
