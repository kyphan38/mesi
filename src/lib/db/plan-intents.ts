"use client";

import { getDocs, query } from "firebase/firestore";
import { userCollectionRef, setUserDoc } from "@/lib/db/firestore";

const MEALS = "meals" as const;

export type MealIntentDoc = {
  type: "intent" | "confirmed";
  dateKey: string;
  createdAt: number;
};

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Stub / daily tap marker — Prompt 5 may merge same doc id with `type: "confirmed"` + meal payload. */
export async function recordPlanIntentForToday(): Promise<void> {
  const dateKey = localDateKey();
  const docId = `${dateKey}_intent`;
  await setUserDoc(MEALS, docId, {
    type: "intent" as const,
    dateKey,
    createdAt: Date.now(),
  });
}

/** Distinct calendar days with at least one intent doc (by dateKey or doc id suffix). */
export async function countDistinctIntentDays(): Promise<number> {
  const col = userCollectionRef(MEALS);
  const snap = await getDocs(query(col));
  const days = new Set<string>();
  snap.forEach((s) => {
    const d = s.data() as Record<string, unknown>;
    if (typeof d.dateKey === "string" && d.dateKey) {
      days.add(d.dateKey);
      return;
    }
    const m = s.id.match(/^(\d{4}-\d{2}-\d{2})_intent$/);
    if (m) days.add(m[1]!);
  });
  return days.size;
}

export async function recordQuickPlanIntentStub(): Promise<void> {
  await recordPlanIntentForToday();
}
