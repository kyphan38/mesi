import { Check } from "lucide-react";
import type { MealOption } from "@/lib/ai/validators/meals";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { InsulinSpikeBadge } from "@/components/plan/insulin-spike-badge";

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
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("text-left", compact ? "" : "w-full")}
    >
      <Card
        className={cn(
          "transition-colors",
          selected ? "border-primary ring-primary ring-2" : "hover:bg-muted/40",
        )}
      >
        <div className="space-y-2 p-3">
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
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                  <span className="text-foreground font-semibold">{option.name}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    ~{Math.round(option.calories)} kcal
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs leading-snug">{option.description}</p>
              </div>
            </div>
            <InsulinSpikeBadge value={option.insulin_spike} />
          </div>

          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
            <span>P {Math.round(option.macros.protein_g)}g</span>
            <span>C {Math.round(option.macros.carb_g)}g</span>
            <span>F {Math.round(option.macros.fat_g)}g</span>
          </div>

          <p className="text-muted-foreground text-xs">
            {option.prep_time_minutes} phút · {option.cooking_method}
          </p>

          {option.missing_ingredients.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              Cần thêm: {option.missing_ingredients.join(", ")}
            </p>
          ) : null}
        </div>
      </Card>
    </button>
  );
}
