import { Check } from "lucide-react";
import type { MealOption } from "@/lib/ai/validators/meals";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { insulinSpikeAbbrev } from "@/lib/plan/day-insulin";

export function MealOptionCard({
  option,
  selected,
  onSelect,
  compact,
}: {
  option: MealOption;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const missingText = option.missing_ingredients.join(", ");
  const pickReason = option.pick_reason?.trim();
  const iShort = insulinSpikeAbbrev(option.insulin_spike);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("text-left", compact ? "" : "w-full")}
    >
      <Card
        className={cn(
          "transition-colors",
          selected
            ? "border-primary bg-primary/5 ring-primary ring-2 dark:bg-primary/10"
            : "hover:bg-muted/40",
        )}
      >
        <div className="space-y-1.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <span
                className={cn(
                  "border-border mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-primary bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {selected ? <Check className="size-3.5" /> : null}
              </span>
              <div className="min-w-0">
                <span className="text-foreground block font-semibold">{option.name}</span>
                {pickReason ? (
                  <p className="text-muted-foreground mt-0.5 text-sm leading-snug line-clamp-1" title={pickReason}>
                    {pickReason}
                  </p>
                ) : null}
                <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">
                  ~{Math.round(option.calories)} kcal · P {Math.round(option.macros.protein_g)}g · C{" "}
                  {Math.round(option.macros.carb_g)}g · F {Math.round(option.macros.fat_g)}g · I {iShort}
                </p>
              </div>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            {option.prep_time_minutes} phút · {option.cooking_method}
          </p>

          {option.missing_ingredients.length > 0 ? (
            <p className="text-muted-foreground line-clamp-1 text-xs" title={missingText}>
              Cần thêm: {missingText}
            </p>
          ) : null}
        </div>
      </Card>
    </button>
  );
}
