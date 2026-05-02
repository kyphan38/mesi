"use client";

import type { ApiMealTime } from "@/lib/ai/types/meal-api";
import { ALL_PANTRY_PRESETS } from "@/lib/constants/pantry-presets";
import type { ConfirmedPlanDoc } from "@/lib/db/meals";
import { ingredientLineDocId } from "@/lib/meal-plan/ingredient-id";
import type { HomeEffort, HomeMealSlot } from "@/lib/meal-plan/build-suggest-request";
import { apiTimeToUiSlot } from "@/lib/meal-plan/build-suggest-request";

export const MESI_COOK_AGAIN_KEY = "mesi_cook_again_v1";

export type CookAgainPayloadV1 = {
  version: 1;
  sourceDocId: string;
  servings: number;
  mealOn: Record<HomeMealSlot, boolean>;
  effort: Record<HomeMealSlot, HomeEffort>;
  selectedPantryIds: string[];
  customTags: { id: string; label: string }[];
};

function normalizeVi(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .trim();
}

function matchIngredientLineToPresetId(line: string): string | null {
  const n = normalizeVi(line);
  if (n.length < 2) return null;
  for (const p of ALL_PANTRY_PRESETS) {
    const pl = normalizeVi(p.label);
    if (n.includes(pl) || pl.split(/\s+/).some((w) => w.length >= 3 && n.includes(w))) {
      return p.id;
    }
  }
  return null;
}

export function buildCookAgainPayloadFromDoc(docId: string, doc: ConfirmedPlanDoc): CookAgainPayloadV1 {
  const mealOn: Record<HomeMealSlot, boolean> = {
    morning: false,
    afternoon: false,
    evening: false,
  };
  const effort: Record<HomeMealSlot, HomeEffort> = {
    morning: "quick",
    afternoon: "quick",
    evening: "quick",
  };

  const selectedIds = new Set<string>();
  const customs: { id: string; label: string }[] = [];
  const customSeen = new Set<string>();

  for (const slot of Object.keys(doc.slots) as ApiMealTime[]) {
    const entry = doc.slots[slot];
    if (!entry?.meal) continue;
    const ui = apiTimeToUiSlot(slot);
    mealOn[ui] = true;
    for (const line of entry.meal.ingredients) {
      const presetId = matchIngredientLineToPresetId(line);
      if (presetId) {
        selectedIds.add(presetId);
        continue;
      }
      const lab = line.trim().slice(0, 120);
      if (!lab) continue;
      const id = ingredientLineDocId(lab);
      if (customSeen.has(id)) continue;
      customSeen.add(id);
      customs.push({ id, label: lab });
      selectedIds.add(id);
    }
  }

  const anyMeal = Object.values(mealOn).some(Boolean);
  if (!anyMeal) {
    mealOn.morning = true;
  }

  return {
    version: 1,
    sourceDocId: docId,
    servings: Math.max(1, Math.min(99, doc.servings)),
    mealOn,
    effort,
    selectedPantryIds: [...selectedIds],
    customTags: customs,
  };
}

export function writeCookAgainPayload(payload: CookAgainPayloadV1): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(MESI_COOK_AGAIN_KEY, JSON.stringify(payload));
}

export function readCookAgainPayload(): CookAgainPayloadV1 | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(MESI_COOK_AGAIN_KEY);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as CookAgainPayloadV1;
    if (o.version !== 1 || !o.mealOn || !o.effort || !Array.isArray(o.selectedPantryIds)) return null;
    return o;
  } catch {
    return null;
  }
}

export function clearCookAgainPayload(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(MESI_COOK_AGAIN_KEY);
}
