"use client";

import type { MacroTargets } from "@/types/health-profile";
import { cn } from "@/lib/utils";

export type DayMacroTotals = {
  calories: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
};

const ROWS: {
  key: keyof Pick<MacroTargets, "calories" | "protein_g" | "carb_g" | "fat_g">;
  label: string;
  color: string;
  unit: "kcal" | "g";
}[] = [
  { key: "calories", label: "Calo", color: "bg-primary", unit: "kcal" },
  { key: "protein_g", label: "Protein", color: "bg-teal-500", unit: "g" },
  { key: "carb_g", label: "Carb", color: "bg-amber-500", unit: "g" },
  { key: "fat_g", label: "Fat", color: "bg-rose-400", unit: "g" },
];

export function MacroProgressBars({
  totals,
  targets,
  mode = "fullDayTargets",
  className,
}: {
  totals: DayMacroTotals;
  targets: MacroTargets;
  mode?: "fullDayTargets" | "totalsOnly";
  className?: string;
}) {
  if (mode === "totalsOnly") {
    return (
      <div className={cn("divide-y divide-border/50", className)}>
        {ROWS.map(({ key, label, unit }) => {
          const current = totals[key];
          const valueStr = unit === "kcal" ? `${Math.round(current)} kcal` : `${Math.round(current)}g`;
          return (
            <div key={key} className="flex justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
              <span className="font-normal text-muted-foreground">{label}</span>
              <span className="text-foreground text-right font-medium tabular-nums">{valueStr}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("divide-y divide-border/50", className)}>
      {ROWS.map(({ key, label, color, unit }) => {
        const current = totals[key];
        const target = Math.max(1, targets[key]);
        const ratio = current / target;
        const low = ratio < 0.7;
        const over = ratio > 1 + 1e-6;
        const valueStr =
          unit === "kcal"
            ? `${Math.round(current)}/${Math.round(target)} kcal`
            : `${Math.round(current)}/${Math.round(target)}g`;

        return (
          <div key={key} className="space-y-1 py-2 first:pt-0 last:pb-0">
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-normal text-muted-foreground">{label}</span>
              <span
                className={cn(
                  "text-right font-medium tabular-nums",
                  over && "text-amber-700 dark:text-amber-400",
                  !over && low && "text-amber-600 dark:text-amber-500",
                  !over && !low && "text-foreground",
                )}
              >
                {valueStr}
                {over ? (
                  <span className="text-muted-foreground ml-1 text-xs font-normal">(vượt mục tiêu)</span>
                ) : null}
              </span>
            </div>
            <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
              {over ? (
                <>
                  <div
                    className={cn("h-full rounded-l-full transition-all", color)}
                    style={{ width: `${(target / current) * 100}%` }}
                    title="Trong mục tiêu"
                  />
                  <div
                    className="h-full rounded-r-full bg-amber-500 transition-all dark:bg-amber-600"
                    style={{ width: `${((current - target) / current) * 100}%` }}
                    title="Vượt mục tiêu"
                  />
                </>
              ) : (
                <div
                  className={cn("h-full rounded-full transition-all", color)}
                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
