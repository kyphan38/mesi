"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  getDefaultHealthProfile,
  getHealthProfile,
  saveHealthProfile,
} from "@/lib/db/firestore";
import type { HealthProfileDoc, SupplementEntry } from "@/types/health-profile";

const WATER_MIN = 1.5;
const WATER_MAX = 4;
const WATER_STEP = 0.5;

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

type CustomSuppRow = { id: string; label: string; userTime: string; dosageNote: string };

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
  const [userTimeById, setUserTimeById] = useState<Record<string, string>>({});
  const [dosageNoteByPresetId, setDosageNoteByPresetId] = useState<Record<string, string>>({});
  const [customSupps, setCustomSupps] = useState<CustomSuppRow[]>([]);
  const [customSuppLabel, setCustomSuppLabel] = useState("");
  const [waterLiters, setWaterLiters] = useState(2);

  const applyDoc = useCallback((doc: HealthProfileDoc) => {
    setExistingSetupAt(doc.setupCompletedAt);
    setAvoidIds([...doc.avoidFoodPresetIds]);
    setCustomAvoid([...doc.customAvoidLabels]);
    setNutritionGoalIds(
      doc.nutritionGoalIds.length > 0 ? [...doc.nutritionGoalIds] : ["eat_clean_skin"],
    );
    setCustomNutritionLabels([...doc.customNutritionLabels]);
    setWaterLiters(clampWaterLiters(doc.waterTargetLiters));

    const presets: string[] = [];
    const times: Record<string, string> = {};
    const dosage: Record<string, string> = {};
    const customs: CustomSuppRow[] = [];

    for (const row of doc.supplements) {
      if (getSupplementPreset(row.id)) {
        presets.push(row.id);
        if (row.userTime) times[row.id] = row.userTime;
        if (row.dosageNote) dosage[row.id] = row.dosageNote;
      } else {
        customs.push({
          id: row.id,
          label: row.label,
          userTime: row.userTime ?? "",
          dosageNote: row.dosageNote ?? "",
        });
      }
    }
    setPresetSuppIds(presets);
    setUserTimeById(times);
    setDosageNoteByPresetId(dosage);
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
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Không tải được hồ sơ.");
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
    setPresetSuppIds((prev) => {
      if (prev.includes(id)) {
        setUserTimeById((m) => {
          const next = { ...m };
          delete next[id];
          return next;
        });
        setDosageNoteByPresetId((m) => {
          const next = { ...m };
          delete next[id];
          return next;
        });
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const addCustomSupp = () => {
    const label = customSuppLabel.trim();
    if (!label) return;
    const id = `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    setCustomSupps((prev) => [...prev, { id, label, userTime: "", dosageNote: "" }]);
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
      const ut = userTimeById[id]?.trim();
      const dn = dosageNoteByPresetId[id]?.trim();
      rows.push({
        id: p.id,
        label: p.label,
        suggestedTime: p.suggestedTime,
        ...(ut ? { userTime: ut } : {}),
        ...(dn ? { dosageNote: dn } : {}),
      });
    }
    for (const c of customSupps) {
      const ut = c.userTime.trim();
      const dn = c.dosageNote.trim();
      rows.push({
        id: c.id,
        label: c.label,
        suggestedTime: "Theo gợi ý bác sĩ",
        ...(ut ? { userTime: ut } : {}),
        ...(dn ? { dosageNote: dn } : {}),
      });
    }
    return rows;
  }, [presetSuppIds, userTimeById, dosageNoteByPresetId, customSupps]);

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

  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-[30vh] items-center justify-center text-sm">
        Đang tải hồ sơ…
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto w-full max-w-lg space-y-8 px-4 py-6">
      {showIntro ? (
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Hồ sơ sức khỏe</h1>
          <p className="text-muted-foreground text-sm">
            Điền một lần — có thể chỉnh lại trong Cài đặt bất cứ lúc nào.
          </p>
        </div>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Lỗi</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
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
        {presetSuppIds.map((id) => {
          const p = getSupplementPreset(id);
          if (!p) return null;
          return (
            <div key={id} className="border-border bg-card/50 space-y-2 rounded-xl border p-3">
              <p className="text-foreground text-sm font-medium">{p.label}</p>
              <p className="text-muted-foreground text-xs">Gợi ý: {p.suggestedTime}</p>
              <label className="text-muted-foreground block text-xs font-medium">
                Liều uống / ghi chú
                <Input
                  className="mt-1 min-h-11 text-base sm:min-h-8"
                  placeholder="vd. 2 viên/ngày, 500mg/viên"
                  value={dosageNoteByPresetId[id] ?? ""}
                  onChange={(e) =>
                    setDosageNoteByPresetId((m) => ({ ...m, [id]: e.target.value }))
                  }
                />
              </label>
              <label className="text-muted-foreground block text-xs font-medium">
                Giờ uống (tuỳ chỉnh)
                <Input
                  className="mt-1 min-h-11 text-base sm:min-h-8"
                  placeholder="vd. 8:00"
                  value={userTimeById[id] ?? ""}
                  onChange={(e) =>
                    setUserTimeById((m) => ({ ...m, [id]: e.target.value }))
                  }
                />
              </label>
            </div>
          );
        })}

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
          <ul className="space-y-3">
            {customSupps.map((c) => (
              <li key={c.id} className="border-border bg-card/50 space-y-2 rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-foreground text-sm font-medium">{c.label}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive text-sm"
                    onClick={() => removeCustomSupp(c.id)}
                  >
                    Xóa
                  </button>
                </div>
                <label className="text-muted-foreground block text-xs font-medium">
                  Liều uống / ghi chú
                  <Input
                    className="mt-1 min-h-11 text-base sm:min-h-8"
                    placeholder="vd. 1 gói sau ăn"
                    value={c.dosageNote}
                    onChange={(e) =>
                      setCustomSupps((prev) =>
                        prev.map((r) =>
                          r.id === c.id ? { ...r, dosageNote: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
                <label className="text-muted-foreground block text-xs font-medium">
                  Giờ uống (tuỳ chỉnh)
                  <Input
                    className="mt-1 min-h-11 text-base sm:min-h-8"
                    placeholder="vd. sau ăn tối"
                    value={c.userTime}
                    onChange={(e) =>
                      setCustomSupps((prev) =>
                        prev.map((r) =>
                          r.id === c.id ? { ...r, userTime: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground text-base font-medium">Lượng nước mục tiêu / ngày</h2>
        <div className="space-y-2">
          <input
            type="range"
            min={WATER_MIN}
            max={WATER_MAX}
            step={WATER_STEP}
            value={waterLiters}
            onChange={(e) => setWaterLiters(clampWaterLiters(Number.parseFloat(e.target.value)))}
            className="accent-primary h-2 w-full cursor-pointer"
            aria-label="Lượng nước (lít)"
          />
          <p className="text-foreground text-center text-lg font-medium tabular-nums">
            {waterLiters.toFixed(1)} L
          </p>
          <p className="text-muted-foreground text-center text-xs">
            {WATER_MIN}–{WATER_MAX} L (bước {WATER_STEP} L)
          </p>
        </div>
      </section>

      <Button type="submit" className="min-h-12 w-full text-base sm:min-h-9" disabled={saving}>
        {saving ? "Đang lưu…" : "Lưu hồ sơ"}
      </Button>
    </form>
  );
}
