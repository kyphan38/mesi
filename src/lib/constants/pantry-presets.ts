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

export const ALL_PANTRY_PRESETS: PantryPreset[] = [
  ...PROTEIN_PRESETS,
  ...VEG_PRESETS,
  ...CARB_PRESETS,
];

const pantryMap = new Map(ALL_PANTRY_PRESETS.map((p) => [p.id, p]));

export function getPantryPreset(id: string): PantryPreset | undefined {
  return pantryMap.get(id);
}
