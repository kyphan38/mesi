import { Check } from "lucide-react";
import type { MealOption } from "@/lib/ai/validators/meals";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { insulinSpikeAbbrev, insulinSpikeTextClass } from "@/lib/plan/day-insulin";

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
  const iShort = insulinSpikeAbbrev(option.insulin_spike);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("text-left", compact ? "" : "w-full")}
    >
      <Card
        className={cn(
          "rounded-2xl transition-colors",
          selected
            ? "border-primary bg-primary/5 ring-primary ring-2 dark:bg-primary/10"
            : "border-border bg-card hover:bg-muted/40",
        )}
      >
        <div className="space-y-1.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <span
                className={cn(
                  "border-border mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-primary bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {selected ? <Check className="size-4" /> : null}
              </span>
              <div className="min-w-0">
                <span className="text-foreground block text-base font-medium leading-snug line-clamp-2">
                  {option.name}
                </span>
                <p className="text-muted-foreground mt-1.5 text-sm font-normal tabular-nums">
                  ~{Math.round(option.calories)} kcal · P {Math.round(option.macros.protein_g)}g · C{" "}
                  {Math.round(option.macros.carb_g)}g · F {Math.round(option.macros.fat_g)}g · I{" "}
                  <span className={cn("font-normal", insulinSpikeTextClass(option.insulin_spike))}>{iShort}</span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-muted-foreground mt-1 text-xs font-normal">
            {option.prep_time_minutes} phút · {option.cooking_method}
          </p>

          {option.missing_ingredients.length > 0 ? (
            <p className="text-muted-foreground mt-1 line-clamp-1 text-xs font-normal" title={missingText}>
              Cần thêm: {missingText}
            </p>
          ) : null}
        </div>
      </Card>
    </button>
  );
}
