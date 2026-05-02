import type { MealDocWithId } from "@/lib/db/meals";

export type HistoryListItem =
  | { kind: "single"; doc: MealDocWithId }
  | { kind: "prep_batch"; batchId: string; docs: MealDocWithId[] };

function sortKey(item: HistoryListItem): number {
  if (item.kind === "single") return item.doc.data.createdAt;
  return Math.max(...item.docs.map((d) => d.data.createdAt));
}

/**
 * Group meal-prep docs by `prep_batch_id`. Singles are one card each.
 * Input should be `createdAt` desc from Firestore.
 */
export function buildHistoryListItems(rows: MealDocWithId[]): HistoryListItem[] {
  const byBatch = new Map<string, MealDocWithId[]>();
  const singles: MealDocWithId[] = [];

  for (const r of rows) {
    const bid = r.data.prep_batch_id;
    if (r.data.is_meal_prep && bid) {
      const arr = byBatch.get(bid) ?? [];
      arr.push(r);
      byBatch.set(bid, arr);
    } else {
      singles.push(r);
    }
  }

  for (const [, arr] of byBatch) {
    arr.sort((a, b) => a.data.dateKey.localeCompare(b.data.dateKey));
  }

  const batchItems: HistoryListItem[] = [...byBatch.entries()].map(([batchId, docs]) => ({
    kind: "prep_batch",
    batchId,
    docs,
  }));

  const singleItems: HistoryListItem[] = singles.map((doc) => ({ kind: "single", doc }));

  return [...batchItems, ...singleItems].sort((a, b) => sortKey(b) - sortKey(a));
}
