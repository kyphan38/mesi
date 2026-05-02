import { cn } from "@/lib/utils";
import type { InsulinSpikeLabel } from "@/lib/plan/day-insulin";

const STYLES: Record<InsulinSpikeLabel, string> = {
  Thấp: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40",
  "Trung bình": "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/40",
  Cao: "bg-red-500/15 text-red-900 dark:text-red-100 border-red-500/40",
};

export function InsulinSpikeBadge({
  value,
  className,
  size = "sm",
}: {
  value: InsulinSpikeLabel;
  className?: string;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs",
        STYLES[value],
        className,
      )}
    >
      Đường huyết: {value}
    </span>
  );
}
