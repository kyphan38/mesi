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

const WATER_OPTIONS = [1.5, 2, 2.5, 3] as const;

export type HealthProfileFormProps = {
  redirectAfterSave?: boolean;
  /** Hide top title block (e.g. Settings embed). */
  showIntro?: boolean;
};

type CustomSuppRow = { id: string; label: string; userTime: string };

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
  const [nutritionGoal, setNutritionGoal] = useState("eat_clean_skin");
  const [presetSuppIds, setPresetSuppIds] = useState<string[]>([]);
  const [userTimeById, setUserTimeById] = useState<Record<string, string>>({});
  const [customSupps, setCustomSupps] = useState<CustomSuppRow[]>([]);
  const [customSuppLabel, setCustomSuppLabel] = useState("");
  const [waterLiters, setWaterLiters] = useState(2);

  const applyDoc = useCallback((doc: HealthProfileDoc) => {
    setExistingSetupAt(doc.setupCompletedAt);
    setAvoidIds([...doc.avoidFoodPresetIds]);
    setCustomAvoid([...doc.customAvoidLabels]);
    setNutritionGoal(doc.nutritionGoal);
    setWaterLiters(doc.waterTargetLiters);

    const presets: string[] = [];
    const times: Record<string, string> = {};
    const customs: CustomSuppRow[] = [];

    for (const row of doc.supplements) {
      if (getSupplementPreset(row.id)) {
        presets.push(row.id);
        if (row.userTime) times[row.id] = row.userTime;
      } else {
        customs.push({
          id: row.id,
          label: row.label,
          userTime: row.userTime ?? "",
        });
      }
    }
    setPresetSuppIds(presets);
    setUserTimeById(times);
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

  const togglePresetSupp = (id: string) => {
    setPresetSuppIds((prev) => {
      if (prev.includes(id)) {
        setUserTimeById((m) => {
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
    setCustomSupps((prev) => [...prev, { id, label, userTime: "" }]);
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
      rows.push({
        id: p.id,
        label: p.label,
        suggestedTime: p.suggestedTime,
        ...(ut ? { userTime: ut } : {}),
      });
    }
    for (const c of customSupps) {
      rows.push({
        id: c.id,
        label: c.label,
        suggestedTime: "Theo gợi ý bác sĩ",
        ...(c.userTime.trim() ? { userTime: c.userTime.trim() } : {}),
      });
    }
    return rows;
  }, [presetSuppIds, userTimeById, customSupps]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const now = Date.now();
      const doc: HealthProfileDoc = {
        version: 1,
        setupCompletedAt: existingSetupAt ?? now,
        updatedAt: now,
        avoidFoodPresetIds: avoidIds,
        customAvoidLabels: customAvoid,
        nutritionGoal,
        supplements: buildSupplements(),
        waterTargetLiters: waterLiters,
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {NUTRITION_GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setNutritionGoal(g.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                nutritionGoal === g.id
                  ? "border-primary bg-primary/10 ring-ring ring-2"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
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
            <div
              key={id}
              className="border-border bg-card/50 space-y-1 rounded-xl border p-3"
            >
              <p className="text-foreground text-sm font-medium">{p.label}</p>
              <p className="text-muted-foreground text-xs">Gợi ý: {p.suggestedTime}</p>
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
              <li
                key={c.id}
                className="border-border bg-card/50 space-y-2 rounded-xl border p-3"
              >
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WATER_OPTIONS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWaterLiters(w)}
              className={cn(
                "rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
                waterLiters === w
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              {w} L
            </button>
          ))}
        </div>
      </section>

      <Button type="submit" className="min-h-12 w-full text-base sm:min-h-9" disabled={saving}>
        {saving ? "Đang lưu…" : "Lưu hồ sơ"}
      </Button>
    </form>
  );
}
