"use client";

import { getDocs, increment, query, setDoc } from "firebase/firestore";
import { userCollectionRef, userDocRef } from "@/lib/db/firestore";

const INGREDIENTS = "ingredients" as const;

export type IngredientStat = {
  id: string;
  label: string;
  useCount: number;
  lastUsedAt: number | null;
};

/**
 * Atomic counter — Firestore `increment(1)` + merge (no transaction).
 */
export async function incrementIngredientUse(docId: string, label: string): Promise<void> {
  await setDoc(
    userDocRef(INGREDIENTS, docId),
    {
      label,
      useCount: increment(1),
      lastUsedAt: Date.now(),
    },
    { merge: true },
  );
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
    rows.push({ id: s.id, label, useCount, lastUsedAt });
  });
  rows.sort((a, b) => b.useCount - a.useCount || (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
  return rows;
}

export function topIngredientIds(stats: IngredientStat[], n: number): string[] {
  return stats.slice(0, n).map((r) => r.id);
}
