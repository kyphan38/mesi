"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MealOption } from "@/lib/ai/validators/meals";

type Props = {
  open: boolean;
  meal: MealOption | null;
  slotLabel: string;
  onClose: () => void;
  onApplyAdjust: (changes: { add?: string[]; remove?: string[] }) => Promise<void>;
  onSwap: () => Promise<void>;
  loading: boolean;
};

export function IngredientEditSheet({
  open,
  meal,
  slotLabel,
  onClose,
  onApplyAdjust,
  onSwap,
  loading,
}: Props) {
  const [lines, setLines] = useState<string[]>(() => meal?.ingredients ?? []);
  const [addInput, setAddInput] = useState("");

  const removedFromOriginal = useMemo(() => {
    if (!meal) return [];
    return meal.ingredients.filter((x) => !lines.includes(x));
  }, [meal, lines]);

  const addedNew = useMemo(() => {
    if (!meal) return [];
    return lines.filter((x) => !meal.ingredients.includes(x));
  }, [meal, lines]);

  if (!open || !meal) return null;

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLine = () => {
    const t = addInput.trim();
    if (!t) return;
    setLines((prev) => [...prev, t]);
    setAddInput("");
  };

  const handleUpdate = async () => {
    await onApplyAdjust({
      remove: removedFromOriginal,
      add: addedNew,
    });
  };

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
          "border-border bg-background fixed right-0 bottom-0 left-0 z-50 flex max-h-[60vh] flex-col rounded-t-2xl border shadow-lg",
        )}
      >
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-muted-foreground text-xs">{slotLabel}</p>
            <p className="text-foreground font-medium">{meal.name}</p>
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
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <p className="text-muted-foreground text-xs">Nguyên liệu — xóa dòng hoặc thêm mới</p>
          <ul className="space-y-2">
            {lines.map((line, idx) => (
              <li
                key={`${idx}-${line.slice(0, 20)}`}
                className="bg-muted/50 flex items-start justify-between gap-2 rounded-lg px-2 py-2 text-sm"
              >
                <span className="min-w-0 flex-1">{line}</span>
                <button
                  type="button"
                  className="text-muted-foreground shrink-0 p-1"
                  onClick={() => removeLine(idx)}
                  aria-label="Xóa"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              placeholder="Thêm nguyên liệu…"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLine();
                }
              }}
              className="text-base"
            />
            <Button type="button" variant="secondary" onClick={addLine}>
              Thêm
            </Button>
          </div>
        </div>
        <div className="border-border flex flex-col gap-2 border-t p-4">
          <Button type="button" className="w-full" disabled={loading} onClick={() => void handleUpdate()}>
            {loading ? "Đang cập nhật…" : "Cập nhật món"}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={() => void onSwap()}>
            {loading ? "Đang đổi…" : "Swap món khác"}
          </Button>
        </div>
      </div>
    </>
  );
}
