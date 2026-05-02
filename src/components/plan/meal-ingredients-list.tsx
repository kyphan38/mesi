"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Nguyên liệu / thiếu — dùng chung Today + History (dữ liệu đã có trong MealOption). */
export function MealIngredientsList({
  ingredients,
  missingIngredients,
  className,
}: {
  ingredients: string[];
  missingIngredients?: string[];
  className?: string;
}) {
  const hasIn = ingredients.length > 0;
  const hasMiss = (missingIngredients?.length ?? 0) > 0;
  if (!hasIn && !hasMiss) return null;

  return (
    <div className={cn("mt-3 space-y-2", className)}>
      {hasIn ? (
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">Nguyên liệu</p>
          <ul className="text-foreground list-inside list-disc space-y-0.5 text-sm leading-snug">
            {ingredients.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasMiss ? (
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">Cần mua thêm</p>
          <ul className="text-muted-foreground list-inside list-disc space-y-0.5 text-sm leading-snug">
            {missingIngredients!.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Mặc định đóng; bấm mới mở nguyên liệu / cần mua. */
export function MealIngredientsCollapsible({
  ingredients,
  missingIngredients,
  className,
}: {
  ingredients: string[];
  missingIngredients?: string[];
  className?: string;
}) {
  const inList = ingredients ?? [];
  const missList = missingIngredients ?? [];
  const hasDetail = inList.length > 0 || missList.length > 0;
  const [open, setOpen] = useState(false);

  if (!hasDetail) return null;

  return (
    <div className={cn(className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-primary hover:text-primary/90 flex w-full min-h-11 items-center justify-between gap-2 py-2 text-left text-sm font-medium"
        aria-expanded={open}
      >
        <span>Nguyên liệu & cần mua</span>
        <ChevronDown
          className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <MealIngredientsList
          ingredients={inList}
          missingIngredients={missList}
          className="border-border mt-0 border-t pt-3"
        />
      ) : null}
    </div>
  );
}
