import { cn } from "@/lib/utils";
import type { InsulinSpikeLabel } from "@/lib/plan/day-insulin";

const STYLES: Record<InsulinSpikeLabel, string> = {
  Thấp: "bg-green-600/15 text-green-600 dark:text-green-500 border-green-600/40",
  "Trung bình": "bg-amber-500/15 text-amber-600 dark:text-amber-500 border-amber-500/40",
  Cao: "bg-red-500/15 text-red-600 dark:text-red-500 border-red-500/40",
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
        "inline-flex items-center rounded-full border font-normal",
        size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs",
        STYLES[value],
        className,
      )}
    >
      Đường huyết: {value}
    </span>
  );
}
