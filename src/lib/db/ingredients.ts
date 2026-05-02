"use client";

import { deleteDoc, getDocs, increment, query, setDoc } from "firebase/firestore";
import type { PantryCategory, PantryPreset } from "@/lib/constants/pantry-presets";
import { getPantryPreset } from "@/lib/constants/pantry-presets";
import { userCollectionRef, userDocRef } from "@/lib/db/firestore";

const INGREDIENTS = "ingredients" as const;

export type IngredientStat = {
  id: string;
  label: string;
  useCount: number;
  lastUsedAt: number | null;
  category?: PantryCategory;
  isCustom?: boolean;
};

export type IncrementIngredientOpts = {
  category: PantryCategory;
  isCustom: boolean;
};

/**
 * Atomic counter - Firestore `increment(1)` + merge (no transaction).
 * When `opts` is set, persists category + isCustom for pantry UX / hydrate.
 */
export async function incrementIngredientUse(
  docId: string,
  label: string,
  opts?: IncrementIngredientOpts,
): Promise<void> {
  const payload: Record<string, unknown> = {
    label,
    useCount: increment(1),
    lastUsedAt: Date.now(),
  };
  if (opts) {
    payload.category = opts.category;
    payload.isCustom = opts.isCustom;
  }
  await setDoc(userDocRef(INGREDIENTS, docId), payload, { merge: true });
}

export async function deleteUserIngredient(docId: string): Promise<void> {
  await deleteDoc(userDocRef(INGREDIENTS, docId));
}

export async function listIngredientStats(): Promise<IngredientStat[]> {
  const col = userCollectionRef(INGREDIENTS);
  const snap = await getDocs(query(col));
  const rows: IngredientStat[] = [];
  snap.forEach((s) => {
    const d = s.data() as Record<string, unknown>;
    const label = typeof d.label === "string" ? d.label : s.id;
    const useCount =
      typeof d.useCount === "number" && Number.isFinite(d.useCount) ? d.useCount : 0;
    const lastUsedAt =
      typeof d.lastUsedAt === "number" && Number.isFinite(d.lastUsedAt) ? d.lastUsedAt : null;
    const categoryRaw = d.category;
    const category =
      categoryRaw === "protein" ||
      categoryRaw === "vegetable" ||
      categoryRaw === "carb" ||
      categoryRaw === "fruit" ||
      categoryRaw === "other"
        ? categoryRaw
        : undefined;
    const isCustom = typeof d.isCustom === "boolean" ? d.isCustom : undefined;
    rows.push({ id: s.id, label, useCount, lastUsedAt, category, isCustom });
  });
  rows.sort((a, b) => b.useCount - a.useCount || (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
  return rows;
}

/** Build custom chip lists from Firestore rows (legacy docs without isCustom → other if not a preset id). */
export function hydrateCustomItemsFromStats(rows: IngredientStat[]): Record<PantryCategory, PantryPreset[]> {
  const out: Record<PantryCategory, PantryPreset[]> = {
    protein: [],
    vegetable: [],
    carb: [],
    fruit: [],
    other: [],
  };
  const seen = new Set<string>();

  for (const r of rows) {
    if (seen.has(r.id)) continue;

    const preset = getPantryPreset(r.id);
    if (preset && r.isCustom !== true) {
      continue;
    }

    if (r.isCustom === true && r.category && out[r.category]) {
      out[r.category].push({ id: r.id, label: r.label });
      seen.add(r.id);
      continue;
    }

    if (!preset) {
      out.other.push({ id: r.id, label: r.label });
      seen.add(r.id);
    }
  }

  return out;
}

export function topIngredientIds(stats: IngredientStat[], n: number): string[] {
  return stats.slice(0, n).map((r) => r.id);
}
