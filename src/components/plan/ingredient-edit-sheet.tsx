"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MealOption } from "@/lib/ai/validators/meals";

type Props = {
  open: boolean;
  meal: MealOption | null;
  slotLabel: string;
  onClose: () => void;
  onRemoveIngredient: (line: string) => Promise<void>;
  onSwap: () => Promise<void>;
  loading: boolean;
};

export function IngredientEditSheet({
  open,
  meal,
  slotLabel,
  onClose,
  onRemoveIngredient,
  onSwap,
  loading,
}: Props) {
  if (!open || !meal) return null;

  const canRemoveLine = meal.ingredients.length > 1;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        className={cn(
          "border-border bg-background fixed right-0 bottom-0 left-0 z-50 flex max-h-[70vh] flex-col rounded-t-2xl border shadow-lg",
        )}
      >
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-muted-foreground text-xs">{slotLabel}</p>
            <p className="text-foreground text-base font-medium leading-snug">{meal.name}</p>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-2"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="text-muted-foreground mb-2 text-xs">
            Nguyên liệu - chạm X để bỏ (AI tính lại món, không chỉnh gram tay)
          </p>
          <ul className="space-y-2">
            {meal.ingredients.map((line, i) => (
              <li
                key={`${i}-${line.slice(0, 48)}`}
                className="flex items-start justify-between gap-2 rounded-lg bg-muted/40 px-2 py-2 text-sm"
              >
                <span className="text-foreground min-w-0 flex-1 leading-snug">{line}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground shrink-0 p-1 disabled:pointer-events-none disabled:opacity-40"
                  disabled={loading || !canRemoveLine}
                  title={
                    canRemoveLine
                      ? "Bỏ nguyên liệu này"
                      : "Giữ ít nhất một dòng - dùng Đổi món nếu cần thay đổi lớn"
                  }
                  aria-label={`Bỏ: ${line.slice(0, 80)}`}
                  onClick={() => void onRemoveIngredient(line)}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-border border-t p-4">
          <Button type="button" className="min-h-12 w-full text-sm font-medium" disabled={loading} onClick={() => void onSwap()}>
            {loading ? "Đang đổi…" : "Đổi món khác"}
          </Button>
        </div>
      </div>
    </>
  );
}
