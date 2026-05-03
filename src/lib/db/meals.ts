"use client";

import {
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
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
import { sumDayTotals } from "@/lib/plan/day-insulin";

export type MealRating = "good" | "neutral" | "bad" | "skipped";

export type ConfirmedSlotEntry = {
  meal: MealOption;
  recipe?: RecipeDetailParsed;
  is_reheated?: boolean;
  /** Set when slot is saved (merge or first write). */
  confirmedAt?: number;
  /** User marked this meal as eaten (execution check-in). */
  eatenAt?: number;
};

export type ConfirmedPlanDoc = {
  type: "confirmed";
  dateKey: string;
  createdAt: number;
  /** Last merge or full save timestamp. */
  updatedAt?: number;
  servings: number;
  slots: Partial<Record<ApiMealTime, ConfirmedSlotEntry>>;
  dayTotals: { calories: number; protein_g: number; carb_g: number; fat_g: number };
  /** Legacy field on older saves only; new plans omit this. */
  dayInsulin?: InsulinSpikeLabel;
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

/** Firestore `setDoc` rejects `undefined` field values; strip keys recursively. */
function stripUndefinedForFirestore(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((x) => stripUndefinedForFirestore(x));
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v === undefined) continue;
    const cleaned = stripUndefinedForFirestore(v);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

const API_SLOT_ORDER: ApiMealTime[] = ["morning", "lunch", "dinner"];

export function calculateDayTotalsFromSlots(
  slots: Partial<Record<ApiMealTime, ConfirmedSlotEntry>>,
): ConfirmedPlanDoc["dayTotals"] {
  const meals: MealOption[] = [];
  for (const t of API_SLOT_ORDER) {
    const m = slots[t]?.meal;
    if (m) meals.push(m);
  }
  return sumDayTotals(meals);
}

function docScore(data: ConfirmedPlanDoc): number {
  return data.updatedAt ?? data.createdAt;
}

/** One row per calendar day (newest doc when legacy duplicates exist). */
export function dedupeMealDocsByDateKey(rows: MealDocWithId[]): MealDocWithId[] {
  const m = new Map<string, MealDocWithId>();
  for (const row of rows) {
    const dk = row.data.dateKey;
    const prev = m.get(dk);
    if (!prev || docScore(row.data) > docScore(prev.data)) m.set(dk, row);
  }
  return [...m.values()].sort((a, b) => docScore(b.data) - docScore(a.data));
}

/**
 * One Firestore doc per day: document id === dateKey (yyyy-mm-dd).
 * Merges `incoming.slots` into existing slots; recomputes dayTotals; preserves rating.
 */
export async function saveConfirmedPlan(incoming: ConfirmedPlanDoc): Promise<string> {
  const dateKey = incoming.dateKey;
  const ref = userDocRef("meals", dateKey);
  const now = Date.now();
  const snap = await getDoc(ref);

  const mergeSlotWrites = (
    base: Partial<Record<ApiMealTime, ConfirmedSlotEntry>>,
    patch: Partial<Record<ApiMealTime, ConfirmedSlotEntry>>,
  ): Partial<Record<ApiMealTime, ConfirmedSlotEntry>> => {
    const out = { ...base };
    for (const t of API_SLOT_ORDER) {
      const v = patch[t];
      if (!v) continue;
      const prev = base[t];
      out[t] = { ...prev, ...v, confirmedAt: now };
    }
    return out;
  };

  if (snap.exists()) {
    const existing = snap.data() as ConfirmedPlanDoc;
    if (existing.type !== "confirmed") {
      throw new Error("meals: document id collides with non-meal data");
    }
    const mergedSlots = mergeSlotWrites(existing.slots, incoming.slots);
    const dayTotals = calculateDayTotalsFromSlots(mergedSlots);
    const next: ConfirmedPlanDoc = {
      type: "confirmed",
      dateKey,
      createdAt: existing.createdAt,
      updatedAt: now,
      servings: incoming.servings,
      slots: mergedSlots,
      dayTotals,
      supplementReminder: incoming.supplementReminder ?? existing.supplementReminder,
      waterTargetLiters: incoming.waterTargetLiters ?? existing.waterTargetLiters,
      shoppingNote: incoming.shoppingNote ?? existing.shoppingNote,
      rating: existing.rating,
      ratedAt: existing.ratedAt,
    };
    if (incoming.is_meal_prep) {
      next.is_meal_prep = true;
      next.prep_batch_id = incoming.prep_batch_id;
      next.prep_instructions = incoming.prep_instructions ?? existing.prep_instructions;
    } else {
      if (existing.is_meal_prep) {
        next.is_meal_prep = existing.is_meal_prep;
        next.prep_batch_id = existing.prep_batch_id;
        next.prep_instructions = existing.prep_instructions;
      }
    }
    await setDoc(ref, stripUndefinedForFirestore(next) as DocumentData);
    return dateKey;
  }

  const initialSlots = mergeSlotWrites({}, incoming.slots);
  const newDoc: ConfirmedPlanDoc = {
    type: "confirmed",
    dateKey,
    createdAt: now,
    updatedAt: now,
    servings: incoming.servings,
    slots: initialSlots,
    dayTotals: calculateDayTotalsFromSlots(initialSlots),
    supplementReminder: incoming.supplementReminder,
    waterTargetLiters: incoming.waterTargetLiters,
    shoppingNote: incoming.shoppingNote,
    ...(incoming.is_meal_prep ? { is_meal_prep: true } : {}),
    ...(incoming.prep_batch_id ? { prep_batch_id: incoming.prep_batch_id } : {}),
    ...(incoming.prep_instructions ? { prep_instructions: incoming.prep_instructions } : {}),
  };
  await setDoc(ref, stripUndefinedForFirestore(newDoc) as DocumentData);
  return dateKey;
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
  return dedupeMealDocsByDateKey(out);
}

export async function getMealDoc(docId: string): Promise<MealDocWithId | null> {
  const ref = userDocRef("meals", docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data() as ConfirmedPlanDoc;
  if (d.type !== "confirmed") return null;
  return { id: snap.id, data: d };
}

/** Today's plan: direct read `meals/{dateKey}` first; fallback to legacy auto-id docs. */
export async function getTodayConfirmedPlan(): Promise<MealDocWithId | null> {
  const todayKey = localDateKey();
  const ref = userDocRef("meals", todayKey);
  const direct = await getDoc(ref);
  if (direct.exists()) {
    const d = direct.data() as ConfirmedPlanDoc;
    if (d.type === "confirmed") return { id: direct.id, data: d };
  }
  const col = userCollectionRef("meals");
  const q = query(
    col,
    where("type", "==", "confirmed"),
    where("dateKey", "==", todayKey),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0]!;
  const d = docSnap.data() as ConfirmedPlanDoc;
  if (d.type !== "confirmed") return null;
  return { id: docSnap.id, data: d };
}

export async function deleteConfirmedMeal(docId: string): Promise<void> {
  await deleteDoc(userDocRef("meals", docId));
}

/** Remove all confirmed plans for a calendar day (canonical id + legacy duplicates). */
export async function deleteConfirmedPlansForDateKey(dateKey: string): Promise<void> {
  const primary = userDocRef("meals", dateKey);
  const pSnap = await getDoc(primary);
  if (pSnap.exists()) await deleteDoc(primary);
  const col = userCollectionRef("meals");
  const q = query(col, where("type", "==", "confirmed"), where("dateKey", "==", dateKey));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

function confirmedDocHasMeals(d: ConfirmedPlanDoc): boolean {
  return API_SLOT_ORDER.some((t) => d.slots[t]?.meal != null);
}

const FIRESTORE_IN_MAX = 30;

/**
 * Date keys (order preserved = first-seen in `dateKeys`) that have any non–meal-prep
 * confirmed doc, including legacy auto-id rows. Batched `in` queries (≤30 keys each).
 */
export async function listDateKeysWithNonMealPrepPlan(dateKeys: string[]): Promise<string[]> {
  const unique = [...new Set(dateKeys)];
  if (unique.length === 0) return [];
  const col = userCollectionRef("meals");
  const conflicting = new Set<string>();
  for (let i = 0; i < unique.length; i += FIRESTORE_IN_MAX) {
    const chunk = unique.slice(i, i + FIRESTORE_IN_MAX);
    const q = query(col, where("type", "==", "confirmed"), where("dateKey", "in", chunk));
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const d = docSnap.data() as ConfirmedPlanDoc;
      if (d.type !== "confirmed") continue;
      if (confirmedDocHasMeals(d) && !d.is_meal_prep) conflicting.add(d.dateKey);
    }
  }
  return unique.filter((dk) => conflicting.has(dk));
}

/**
 * Whether any confirmed doc for this calendar day has meals and is not meal prep.
 * Includes legacy auto-id docs (same query as delete-by-dateKey).
 */
export async function hasNonMealPrepPlanForDateKey(dateKey: string): Promise<boolean> {
  const hits = await listDateKeysWithNonMealPrepPlan([dateKey]);
  return hits.length > 0;
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

/** Mark a planned meal slot as eaten or clear the flag (Firestore meals/{docId}). */
export async function updateSlotEatenAt(
  docId: string,
  slot: ApiMealTime,
  eaten: boolean,
): Promise<void> {
  const ref = userDocRef("meals", docId);
  await updateDoc(ref, {
    [`slots.${slot}.eatenAt`]: eaten ? Date.now() : deleteField(),
    updatedAt: Date.now(),
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
