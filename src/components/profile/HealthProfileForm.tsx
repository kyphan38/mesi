"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  AVOID_FOOD_PRESETS,
  getSupplementPreset,
  NUTRITION_GOALS,
  SUPPLEMENT_PRESETS,
} from "@/lib/constants/health-presets";
import { getFirebaseAuth } from "@/lib/auth/firebase-client";
import {
  getDefaultHealthProfile,
  getHealthProfile,
  saveHealthProfile,
} from "@/lib/db/firestore";
import { getUserFriendlyFirestoreMessage } from "@/lib/db/firestore-errors";
import type { HealthProfileDoc, SupplementEntry } from "@/types/health-profile";

const WATER_MIN = 1.5;
const WATER_MAX = 4;
const WATER_STEP = 0.5;
const WATER_QUICK_PRESETS = [2, 2.5, 3, 3.5] as const;

function isQuickWaterLiters(v: number): boolean {
  return WATER_QUICK_PRESETS.some((w) => Math.abs(w - v) < 0.001);
}

function clampWaterLiters(v: number): number {
  const snapped = Math.round((v - WATER_MIN) / WATER_STEP) * WATER_STEP + WATER_MIN;
  const x = Math.round(snapped * 10) / 10;
  return Math.min(WATER_MAX, Math.max(WATER_MIN, x));
}

export type HealthProfileFormProps = {
  redirectAfterSave?: boolean;
  /** Hide top title block (e.g. Settings embed). */
  showIntro?: boolean;
};

type CustomSuppRow = { id: string; label: string };

export function HealthProfileForm({
  redirectAfterSave,
  showIntro = true,
}: HealthProfileFormProps) {
  const router = useRouter();
  const { show } = useToast();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingSetupAt, setExistingSetupAt] = useState<number | null>(null);

  const [avoidIds, setAvoidIds] = useState<string[]>([]);
  const [customAvoid, setCustomAvoid] = useState<string[]>([]);
  const [customAvoidInput, setCustomAvoidInput] = useState("");
  const [nutritionGoalIds, setNutritionGoalIds] = useState<string[]>(["eat_clean_skin"]);
  const [customNutritionLabels, setCustomNutritionLabels] = useState<string[]>([]);
  const [customNutritionInput, setCustomNutritionInput] = useState("");
  const [presetSuppIds, setPresetSuppIds] = useState<string[]>([]);
  const [customSupps, setCustomSupps] = useState<CustomSuppRow[]>([]);
  const [customSuppLabel, setCustomSuppLabel] = useState("");
  const [waterLiters, setWaterLiters] = useState(2);
  const [waterOtherOpen, setWaterOtherOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const applyDoc = useCallback((doc: HealthProfileDoc) => {
    setExistingSetupAt(doc.setupCompletedAt);
    setAvoidIds([...doc.avoidFoodPresetIds]);
    setCustomAvoid([...doc.customAvoidLabels]);
    setNutritionGoalIds(
      doc.nutritionGoalIds.length > 0 ? [...doc.nutritionGoalIds] : ["eat_clean_skin"],
    );
    setCustomNutritionLabels([...doc.customNutritionLabels]);
    const w = clampWaterLiters(doc.waterTargetLiters);
    setWaterLiters(w);
    setWaterOtherOpen(!isQuickWaterLiters(w));

    const presets: string[] = [];
    const customs: CustomSuppRow[] = [];

    for (const row of doc.supplements) {
      if (getSupplementPreset(row.id)) {
        presets.push(row.id);
      } else {
        customs.push({
          id: row.id,
          label: row.label,
        });
      }
    }
    setPresetSuppIds(presets);
    setCustomSupps(customs);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      try {
        const doc = await getHealthProfile();
        if (cancelled) return;
        if (doc) applyDoc(doc);
        else applyDoc(getDefaultHealthProfile());
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setLoadError(getUserFriendlyFirestoreMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyDoc]);

  const toggleAvoid = (id: string) => {
    setAvoidIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const addCustomAvoid = () => {
    const t = customAvoidInput.trim();
    if (!t) return;
    setCustomAvoid((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setCustomAvoidInput("");
  };

  const removeCustomAvoid = (label: string) => {
    setCustomAvoid((prev) => prev.filter((x) => x !== label));
  };

  const toggleNutritionGoal = (id: string) => {
    setNutritionGoalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const addCustomNutrition = () => {
    const t = customNutritionInput.trim();
    if (!t) return;
    setCustomNutritionLabels((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setCustomNutritionInput("");
  };

  const removeCustomNutrition = (label: string) => {
    setCustomNutritionLabels((prev) => prev.filter((x) => x !== label));
  };

  const togglePresetSupp = (id: string) => {
    setPresetSuppIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const addCustomSupp = () => {
    const label = customSuppLabel.trim();
    if (!label) return;
    const id = `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    setCustomSupps((prev) => [...prev, { id, label }]);
    setCustomSuppLabel("");
  };

  const removeCustomSupp = (id: string) => {
    setCustomSupps((prev) => prev.filter((r) => r.id !== id));
  };

  const buildSupplements = useCallback((): SupplementEntry[] => {
    const rows: SupplementEntry[] = [];
    for (const id of presetSuppIds) {
      const p = getSupplementPreset(id);
      if (!p) continue;
      rows.push({ id: p.id, label: p.label });
    }
    for (const c of customSupps) {
      rows.push({ id: c.id, label: c.label });
    }
    return rows;
  }, [presetSuppIds, customSupps]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const now = Date.now();
      const goals =
        nutritionGoalIds.length > 0 ? nutritionGoalIds : ["eat_clean_skin"];
      const doc: HealthProfileDoc = {
        version: 1,
        setupCompletedAt: existingSetupAt ?? now,
        updatedAt: now,
        avoidFoodPresetIds: avoidIds,
        customAvoidLabels: customAvoid,
        nutritionGoalIds: goals,
        customNutritionLabels: customNutritionLabels,
        supplements: buildSupplements(),
        waterTargetLiters: clampWaterLiters(waterLiters),
      };
      await saveHealthProfile(doc);
      setExistingSetupAt(doc.setupCompletedAt);
      show("Đã lưu hồ sơ.", "success");
      if (redirectAfterSave) {
        router.replace("/");
        router.refresh();
      }
    } catch (err) {
      show(err instanceof Error ? err.message : "Lưu thất bại.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm("Đăng xuất khỏi Mesi?")) return;
    setLoggingOut(true);
    try {
      await signOut(getFirebaseAuth());
      router.replace("/login");
      router.refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "Không đăng xuất được.", "error");
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-[30vh] items-center justify-center text-sm">
        Đang tải hồ sơ…
      </div>
    );
  }

  return (
    <>
      <form
        id="cai-dat"
        onSubmit={(e) => void onSubmit(e)}
        className="mx-auto w-full max-w-lg space-y-8 px-4 py-6"
      >
      {showIntro ? (
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Hồ sơ sức khỏe</h1>
          <p className="text-muted-foreground text-sm">
            Điền một lần — chỉnh lại bất cứ lúc trong tab Hồ sơ.
          </p>
        </div>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Không tải được dữ liệu</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{loadError}</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => {
                setLoading(true);
                setLoadError(null);
                void (async () => {
                  try {
                    const doc = await getHealthProfile();
                    if (doc) applyDoc(doc);
                    else applyDoc(getDefaultHealthProfile());
                  } catch (e) {
                    console.error(e);
                    setLoadError(getUserFriendlyFirestoreMessage(e));
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
            >
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-foreground text-base font-medium">Thực phẩm cần tránh</h2>
        <div className="flex flex-wrap gap-2">
          {AVOID_FOOD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleAvoid(p.id)}
              className={cn(
                "rounded-full border px-3 py-2 text-left text-sm transition-colors",
                avoidIds.includes(p.id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Thêm mục tùy chỉnh…"
            value={customAvoidInput}
            onChange={(e) => setCustomAvoidInput(e.target.value)}
            className="min-h-11 flex-1 text-base sm:min-h-8"
            aria-label="Thực phẩm tránh tùy chỉnh"
          />
          <Button type="button" variant="secondary" className="min-h-11 shrink-0 sm:min-h-8" onClick={addCustomAvoid}>
            Thêm
          </Button>
        </div>
        {customAvoid.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {customAvoid.map((l) => (
              <li
                key={l}
                className="bg-muted text-foreground flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm"
              >
                {l}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground rounded-full px-2 py-1 text-lg leading-none"
                  onClick={() => removeCustomAvoid(l)}
                  aria-label={`Xóa ${l}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground text-base font-medium">Mục tiêu dinh dưỡng</h2>
        <p className="text-muted-foreground text-xs">Chọn một hoặc nhiều mục tiêu có sẵn.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {NUTRITION_GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => toggleNutritionGoal(g.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                nutritionGoalIds.includes(g.id)
                  ? "border-primary bg-primary/10 ring-ring ring-2"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Thêm mục tiêu tùy chỉnh…"
            value={customNutritionInput}
            onChange={(e) => setCustomNutritionInput(e.target.value)}
            className="min-h-11 flex-1 text-base sm:min-h-8"
            aria-label="Mục tiêu dinh dưỡng tùy chỉnh"
          />
          <Button type="button" variant="secondary" className="min-h-11 shrink-0 sm:min-h-8" onClick={addCustomNutrition}>
            Thêm
          </Button>
        </div>
        {customNutritionLabels.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {customNutritionLabels.map((l) => (
              <li
                key={l}
                className="bg-muted text-foreground flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm"
              >
                {l}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground rounded-full px-2 py-1 text-lg leading-none"
                  onClick={() => removeCustomNutrition(l)}
                  aria-label={`Xóa ${l}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground text-base font-medium">Supplement đang dùng</h2>
        <p className="text-muted-foreground text-xs">
          Chọn bổ sung — thời điểm uống sẽ được gợi ý trên màn hình thực đơn.
        </p>
        <div className="flex flex-wrap gap-2">
          {SUPPLEMENT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePresetSupp(p.id)}
              className={cn(
                "rounded-full border px-3 py-2 text-left text-sm transition-colors",
                presetSuppIds.includes(p.id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Thêm supplement tùy chỉnh…"
            value={customSuppLabel}
            onChange={(e) => setCustomSuppLabel(e.target.value)}
            className="min-h-11 flex-1 text-base sm:min-h-8"
            aria-label="Supplement tùy chỉnh"
          />
          <Button type="button" variant="secondary" className="min-h-11 shrink-0 sm:min-h-8" onClick={addCustomSupp}>
            Thêm
          </Button>
        </div>
        {customSupps.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {customSupps.map((c) => (
              <li
                key={c.id}
                className="bg-muted text-foreground flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm"
              >
                {c.label}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground rounded-full px-2 py-1 text-lg leading-none"
                  onClick={() => removeCustomSupp(c.id)}
                  aria-label={`Xóa ${c.label}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground text-base font-medium">Lượng nước mục tiêu / ngày</h2>
        <div className="flex flex-wrap items-center gap-2">
          {WATER_QUICK_PRESETS.map((v) => (
            <Button
              key={v}
              type="button"
              variant={isQuickWaterLiters(waterLiters) && Math.abs(waterLiters - v) < 0.001 ? "default" : "outline"}
              className="min-h-11 min-w-[3.5rem] flex-1"
              onClick={() => {
                setWaterLiters(v);
                setWaterOtherOpen(false);
              }}
            >
              {v} L
            </Button>
          ))}
          <Button
            type="button"
            variant={waterOtherOpen || !isQuickWaterLiters(waterLiters) ? "default" : "outline"}
            className="min-h-11 shrink-0"
            onClick={() => setWaterOtherOpen(true)}
          >
            Khác
          </Button>
        </div>
        {waterOtherOpen || !isQuickWaterLiters(waterLiters) ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">
              {WATER_MIN}–{WATER_MAX} L (bước {WATER_STEP} L)
            </p>
            <Input
              type="number"
              min={WATER_MIN}
              max={WATER_MAX}
              step={WATER_STEP}
              className="min-h-11 max-w-[8rem] text-base sm:min-h-8"
              value={Number.isFinite(waterLiters) ? waterLiters : WATER_MIN}
              onChange={(e) => setWaterLiters(clampWaterLiters(Number.parseFloat(e.target.value)))}
              aria-label="Lượng nước tùy chỉnh (lít)"
            />
          </div>
        ) : null}
        <p className="text-foreground text-sm font-medium tabular-nums">Đang chọn: {waterLiters.toFixed(1)} L</p>
      </section>

        <Button type="submit" className="min-h-12 w-full text-base sm:min-h-9" disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu hồ sơ"}
        </Button>
      </form>

      <div className="border-border mx-auto mt-12 w-full max-w-lg border-t px-4 pt-8 pb-10">
        <Button
          type="button"
          variant="destructive"
          className="min-h-12 w-full text-base"
          disabled={loggingOut}
          onClick={() => void handleLogout()}
        >
          {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
        </Button>
      </div>
    </>
  );
}
