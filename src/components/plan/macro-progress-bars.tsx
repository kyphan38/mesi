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
      <div className={cn("space-y-2", className)}>
        {ROWS.map(({ key, label, unit }) => {
          const current = totals[key];
          const valueStr = unit === "kcal" ? `${Math.round(current)} kcal` : `${Math.round(current)}g`;
          return (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium tabular-nums">{valueStr}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {ROWS.map(({ key, label, color, unit }) => {
        const current = totals[key];
        const target = Math.max(1, targets[key]);
        const pct = Math.min(100, (current / target) * 100);
        const low = target > 0 && current / target < 0.7;
        const valueStr =
          unit === "kcal"
            ? `${Math.round(current)}/${Math.round(target)} kcal`
            : `${Math.round(current)}/${Math.round(target)}g`;
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className={cn("font-medium", low && "text-amber-600 dark:text-amber-500")}>{valueStr}</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
