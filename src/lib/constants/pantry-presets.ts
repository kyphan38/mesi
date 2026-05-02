export type PantryPreset = { id: string; label: string };

export const PROTEIN_PRESETS: PantryPreset[] = [
  { id: "chicken_breast", label: "Ức gà" },
  { id: "egg", label: "Trứng" },
  { id: "pork", label: "Thịt heo" },
  { id: "fish", label: "Cá" },
  { id: "shrimp", label: "Tôm" },
  { id: "tofu", label: "Đậu hủ" },
];

export const VEG_PRESETS: PantryPreset[] = [
  { id: "tomato", label: "Cà chua" },
  { id: "broccoli", label: "Bông cải" },
  { id: "spinach", label: "Cải bó xôi" },
  { id: "cucumber", label: "Dưa leo" },
  { id: "mushroom", label: "Nấm" },
  { id: "sweet_potato", label: "Khoai lang" },
  { id: "pumpkin", label: "Bí đỏ" },
];

export const CARB_PRESETS: PantryPreset[] = [
  { id: "rice", label: "Cơm" },
  { id: "bread", label: "Bánh mì" },
  { id: "noodles", label: "Bún/Phở" },
  { id: "oats", label: "Yến mạch" },
];

export const FRUIT_PRESETS: PantryPreset[] = [
  { id: "banana", label: "Chuối" },
  { id: "avocado", label: "Bơ" },
  { id: "apple", label: "Táo" },
  { id: "orange", label: "Cam" },
  { id: "lemon", label: "Chanh" },
];

/** Empty — only user-added items appear under "Khác". */
export const OTHER_PRESETS: PantryPreset[] = [];

export type PantryCategory = "protein" | "vegetable" | "carb" | "fruit" | "other";

export const PANTRY_CATEGORIES: {
  id: PantryCategory;
  label: string;
  presets: PantryPreset[];
  alwaysVisible: boolean;
}[] = [
  { id: "protein", label: "Protein", presets: PROTEIN_PRESETS, alwaysVisible: true },
  { id: "vegetable", label: "Rau / củ", presets: VEG_PRESETS, alwaysVisible: true },
  { id: "carb", label: "Tinh bột", presets: CARB_PRESETS, alwaysVisible: true },
  { id: "fruit", label: "Trái cây", presets: FRUIT_PRESETS, alwaysVisible: true },
  { id: "other", label: "Khác", presets: OTHER_PRESETS, alwaysVisible: false },
];

export const ALL_PANTRY_PRESETS: PantryPreset[] = [
  ...PROTEIN_PRESETS,
  ...VEG_PRESETS,
  ...CARB_PRESETS,
  ...FRUIT_PRESETS,
];

const pantryMap = new Map(ALL_PANTRY_PRESETS.map((p) => [p.id, p]));

const presetCategoryById = new Map<string, PantryCategory>();
for (const { id, presets } of PANTRY_CATEGORIES) {
  if (id === "other") continue;
  for (const p of presets) {
    presetCategoryById.set(p.id, id);
  }
}

export function getPantryPreset(id: string): PantryPreset | undefined {
  return pantryMap.get(id);
}

/** Category for built-in presets (not user custom docs). */
export function getPresetCategoryById(id: string): PantryCategory | null {
  return presetCategoryById.get(id) ?? null;
}
