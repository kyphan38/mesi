"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PantryCategory, PantryPreset } from "@/lib/constants/pantry-presets";

export type AddIngredientSheetProps = {
  open: boolean;
  categoryId: PantryCategory | null;
  categoryLabel: string;
  existingLabelsLower: Set<string>;
  onAdd: (categoryId: PantryCategory, item: PantryPreset) => void;
  onClose: () => void;
};

export function AddIngredientSheet({
  open,
  categoryId,
  categoryLabel,
  existingLabelsLower,
  onAdd,
  onClose,
}: AddIngredientSheetProps) {
  const [value, setValue] = useState("");
  const [dupError, setDupError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      startTransition(() => {
        setValue("");
        setDupError(false);
      });
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open, categoryId]);

  const normalized = value.trim();
  const normalizedLower = normalized.toLowerCase();
  const canSubmit =
    normalized.length > 0 &&
    categoryId !== null &&
    !existingLabelsLower.has(normalizedLower);

  const submit = () => {
    if (!categoryId || !canSubmit) return;
    if (existingLabelsLower.has(normalizedLower)) {
      setDupError(true);
      return;
    }
    const id = `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    onAdd(categoryId, { id, label: normalized });
    onClose();
  };

  if (!open || categoryId === null) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/40"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        className="fixed right-0 bottom-0 left-0 z-[60] mx-auto flex max-h-[50vh] max-w-[430px] flex-col rounded-t-2xl border border-border bg-background p-4 shadow-lg"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-ingredient-title"
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartY.current;
          touchStartY.current = null;
          const end = e.changedTouches[0]?.clientY;
          if (start != null && end != null && end - start > 80) onClose();
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 id="add-ingredient-title" className="text-foreground pr-6 text-base font-medium">
            Thêm vào: {categoryLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 shrink-0 rounded-md p-1"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder="Tên nguyên liệu…"
          autoComplete="off"
          className="border-input bg-background text-foreground mb-2 min-h-11 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(e) => {
            setValue(e.target.value);
            setDupError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        {dupError ? (
          <p className="text-destructive mb-2 text-xs">Đã có nguyên liệu này trong nhóm.</p>
        ) : null}
        <Button type="button" className="min-h-11 w-full" disabled={!canSubmit} onClick={submit}>
          Thêm
        </Button>
      </div>
    </>
  );
}
