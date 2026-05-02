"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  ALL_PANTRY_PRESETS,
  CARB_PRESETS,
  PROTEIN_PRESETS,
  type PantryPreset,
  VEG_PRESETS,
} from "@/lib/constants/pantry-presets";
import {
  incrementIngredientUse,
  listIngredientStats,
  topIngredientIds,
  type IngredientStat,
} from "@/lib/db/ingredients";
import {
  countDistinctIntentDays,
  recordPlanIntentForToday,
} from "@/lib/db/plan-intents";

type MealSlot = "morning" | "afternoon" | "evening";
type Effort = "quick" | "medium" | "high";

const MEAL_LABELS: Record<MealSlot, string> = {
  morning: "Sáng",
  afternoon: "Trưa",
  evening: "Tối",
};

const EFFORT_OPTIONS: { id: Effort; label: string }[] = [
  { id: "quick", label: "Nhanh (<15 phút)" },
  { id: "medium", label: "Vừa (15–30 phút)" },
  { id: "high", label: "Kỳ công (>30 phút)" },
];

function customIngredientDocId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return `c_${base || "x"}`;
}

export function HomeScreen() {
  const { show } = useToast();
  const [stats, setStats] = useState<IngredientStat[]>([]);
  const [intentDays, setIntentDays] = useState(0);

  const [dinerPreset, setDinerPreset] = useState<"1" | "2" | "3" | "other">("1");
  const [dinerOther, setDinerOther] = useState("4");

  const [mealOn, setMealOn] = useState<Record<MealSlot, boolean>>({
    morning: true,
    afternoon: false,
    evening: false,
  });
  const [effort, setEffort] = useState<Record<MealSlot, Effort>>({
    morning: "quick",
    afternoon: "quick",
    evening: "quick",
  });

  const [selectedPantry, setSelectedPantry] = useState<Set<string>>(() => new Set());
  const [customTags, setCustomTags] = useState<{ id: string; label: string }[]>([]);
  const [customInput, setCustomInput] = useState("");

  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingQuick, setLoadingQuick] = useState(false);

  const refreshMeta = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([listIngredientStats(), countDistinctIntentDays()]);
      setStats(s);
      setIntentDays(c);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [s, c] = await Promise.all([listIngredientStats(), countDistinctIntentDays()]);
        if (cancelled) return;
        setStats(s);
        setIntentDays(c);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const topIds = useMemo(() => topIngredientIds(stats, 5), [stats]);
  const topIdSet = useMemo(() => new Set(topIds), [topIds]);

  const effectiveDiners = useMemo(() => {
    if (dinerPreset === "other") {
      const n = Number.parseInt(dinerOther, 10);
      if (Number.isFinite(n) && n >= 1) return Math.min(99, n);
      return 1;
    }
    return Number.parseInt(dinerPreset, 10) as 1 | 2 | 3;
  }, [dinerPreset, dinerOther]);

  const toggleMeal = (slot: MealSlot) => {
    setMealOn((m) => ({ ...m, [slot]: !m[slot] }));
  };

  const setEffortFor = (slot: MealSlot, e: Effort) => {
    setEffort((x) => ({ ...x, [slot]: e }));
  };

  const togglePantry = (id: string, label: string) => {
    setSelectedPantry((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        void incrementIngredientUse(id, label).catch((err) => console.error(err));
      }
      return next;
    });
  };

  const addCustomPantry = () => {
    const t = customInput.trim();
    if (!t) return;
    const id = customIngredientDocId(t);
    if (customTags.some((c) => c.id === id) || selectedPantry.has(id)) {
      setCustomInput("");
      return;
    }
    setCustomTags((c) => [...c, { id, label: t }]);
    setSelectedPantry((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    void incrementIngredientUse(id, t).catch((e) => console.error(e));
    setCustomInput("");
  };

  const toggleCustomTag = (id: string, label: string) => {
    setSelectedPantry((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        void incrementIngredientUse(id, label).catch((e) => console.error(e));
      }
      return next;
    });
  };

  const runMenuStub = async (fromQuick: boolean) => {
    if (fromQuick) setLoadingQuick(true);
    else setLoadingMenu(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      await recordPlanIntentForToday();
      await refreshMeta();
      show(fromQuick ? "Plan nhanh (bản thử) — AI sắp tới." : "Đang chuẩn bị thực đơn (bản thử).", "info");
    } finally {
      setLoadingMenu(false);
      setLoadingQuick(false);
    }
  };

  const renderChip = (p: PantryPreset, isFrequent: boolean) => {
    const on = selectedPantry.has(p.id);
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => togglePantry(p.id, p.label)}
        className={cn(
          "relative rounded-full border px-3 py-2 text-left text-sm transition-colors",
          on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted",
          isFrequent && !on && "border-primary/50 ring-1 ring-primary/30",
        )}
      >
        {isFrequent ? (
          <span className="bg-primary/15 text-primary absolute -top-1.5 -right-1 rounded px-1 text-[10px] font-medium">
            Hay dùng
          </span>
        ) : null}
        {p.label}
      </button>
    );
  };

  const orderedPresets = useMemo(() => {
    const frequent: PantryPreset[] = [];
    const byId = new Map(ALL_PANTRY_PRESETS.map((p) => [p.id, p]));
    for (const id of topIds) {
      const p = byId.get(id);
      if (p) frequent.push(p);
    }
    const frequentIdSet = new Set(frequent.map((p) => p.id));
    return { frequent, frequentIdSet };
  }, [topIds]);

  const proteinRows = useMemo(
    () => PROTEIN_PRESETS.filter((p) => !orderedPresets.frequentIdSet.has(p.id)),
    [orderedPresets.frequentIdSet],
  );
  const vegRows = useMemo(
    () => VEG_PRESETS.filter((p) => !orderedPresets.frequentIdSet.has(p.id)),
    [orderedPresets.frequentIdSet],
  );
  const carbRows = useMemo(
    () => CARB_PRESETS.filter((p) => !orderedPresets.frequentIdSet.has(p.id)),
    [orderedPresets.frequentIdSet],
  );

  return (
    <div className="bg-background min-h-0 flex-1">
      <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <span className="text-foreground text-lg font-semibold tracking-tight">Mesi</span>
        <div className="flex items-center gap-1">
          <Link
            href="/profile"
            className="text-muted-foreground hover:text-foreground inline-flex h-10 w-10 items-center justify-center rounded-lg"
            aria-label="Hồ sơ"
          >
            <User className="size-5" />
          </Link>
          <Link
            href="/settings"
            className="text-muted-foreground hover:text-foreground inline-flex h-10 w-10 items-center justify-center rounded-lg"
            aria-label="Cài đặt"
          >
            <Settings className="size-5" />
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[430px] space-y-6 px-4 py-4 pb-10">
        {intentDays >= 3 ? (
          <div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              disabled={loadingQuick}
              onClick={() => void runMenuStub(true)}
            >
              {loadingQuick ? "Đang chuẩn bị…" : "Plan nhanh"}
            </Button>
            <p className="text-muted-foreground mt-1.5 text-center text-xs">
              Dùng gợi ý từ lịch sử (AI sắp tới)
            </p>
          </div>
        ) : null}

        <section className="space-y-2">
          <h2 className="text-foreground text-sm font-medium">Số người ăn</h2>
          <div className="flex flex-wrap gap-2">
            {(["1", "2", "3"] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDinerPreset(n)}
                className={cn(
                  "min-h-11 min-w-[3.5rem] rounded-xl border px-3 text-sm font-medium",
                  dinerPreset === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card",
                )}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDinerPreset("other")}
              className={cn(
                "min-h-11 rounded-xl border px-3 text-sm font-medium",
                dinerPreset === "other"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card",
              )}
            >
              Khác
            </button>
          </div>
          {dinerPreset === "other" ? (
            <Input
              type="number"
              min={1}
              max={99}
              className="min-h-11 max-w-[8rem] text-base"
              value={dinerOther}
              onChange={(e) => setDinerOther(e.target.value)}
              aria-label="Số người (nhập tay)"
            />
          ) : null}
          <p className="text-muted-foreground mt-1 text-xs tabular-nums" aria-live="polite">
            Tổng: {effectiveDiners} người ăn
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">Lên plan cho buổi nào?</h2>
          {(Object.keys(MEAL_LABELS) as MealSlot[]).map((slot) => (
            <div key={slot} className="border-border rounded-xl border p-3">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={mealOn[slot]}
                  onChange={() => toggleMeal(slot)}
                  className="border-input size-5 rounded"
                />
                <span className="text-foreground font-medium">{MEAL_LABELS[slot]}</span>
              </label>
              {mealOn[slot] ? (
                <div className="mt-3 flex flex-col gap-2">
                  <span className="text-muted-foreground text-xs">Mức effort</span>
                  <div className="flex flex-wrap gap-2">
                    {EFFORT_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setEffortFor(slot, o.id)}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-left text-xs",
                          effort[slot] === o.id
                            ? "border-primary bg-primary/10 ring-ring ring-1"
                            : "border-border bg-muted/40",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">Nhà đang có gì?</h2>

          {orderedPresets.frequent.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium">Lần trước bạn có…</p>
              <div className="flex flex-wrap gap-2">{orderedPresets.frequent.map((p) => renderChip(p, true))}</div>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">Protein</p>
            <div className="flex flex-wrap gap-2">{proteinRows.map((p) => renderChip(p, topIdSet.has(p.id)))}</div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">Rau / củ</p>
            <div className="flex flex-wrap gap-2">{vegRows.map((p) => renderChip(p, topIdSet.has(p.id)))}</div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">Tinh bột</p>
            <div className="flex flex-wrap gap-2">{carbRows.map((p) => renderChip(p, topIdSet.has(p.id)))}</div>
          </div>

          {customTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {customTags.map((c) => {
                const on = selectedPantry.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCustomTag(c.id, c.label)}
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Input
              placeholder="Thêm nguyên liệu khác…"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomPantry();
                }
              }}
              className="min-h-11 flex-1 text-base"
            />
            <Button type="button" variant="secondary" className="min-h-11 shrink-0" onClick={addCustomPantry}>
              Thêm
            </Button>
          </div>
        </section>

        <Button
          type="button"
          className="min-h-12 w-full text-base font-semibold"
          disabled={loadingMenu}
          onClick={() => void runMenuStub(false)}
        >
          {loadingMenu ? "Đang nghĩ món…" : "Lên thực đơn"}
        </Button>
      </div>
    </div>
  );
}
