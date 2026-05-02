/**
 * Vietnam seasonal hints for meal AI prompts.
 * Month MUST be derived with Intl + Asia/Ho_Chi_Minh — never `Date.getMonth()` alone on server.
 */

export type VietnamSeasonPeriod = "dry_cool" | "hot_buildup" | "rainy_hot";

const TZ = "Asia/Ho_Chi_Minh";

/** Calendar month 1–12 in Vietnam local date (same instant as `when`). */
export function getMonthInHoChiMinh(when: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "numeric",
  });
  return Number.parseInt(fmt.format(when), 10);
}

export function getVietnamSeasonPeriod(month: number): VietnamSeasonPeriod {
  if (month === 11 || month === 12 || month === 1 || month === 2) return "dry_cool";
  if (month >= 3 && month <= 5) return "hot_buildup";
  return "rainy_hot";
}

const SEASON_LABELS: Record<VietnamSeasonPeriod, string> = {
  dry_cool: "mùa khô mát (thường tháng 11–2)",
  hot_buildup: "giai đoạn nóng dần (thường tháng 3–5)",
  rainy_hot: "mùa mưa nóng ẩm (thường tháng 6–10)",
};

const SEASON_GUIDANCE: Record<VietnamSeasonPeriod, string> = {
  dry_cool:
    "Ưu tiên gợi ý canh/nước dùng, soup ấm, món nóng vừa phải, dễ tiêu — phù hợp thời tiết mát và hanh khô.",
  hot_buildup:
    "Ưu tiên salad/món mát, nhiều rau xanh, nấu nhanh — tránh quá nặng dầu mỡ khi trời nóng dần.",
  rainy_hot:
    "Ưu tiên món nhẹ, dễ tiêu, đủ nước/hydrating (canh thanh, rau luộc, cháo/ súp loãng khi hợp) — trời mưa nóng dễ mệt.",
};

/** Nguyên liệu “đang có” phổ biến theo mùa — gợi ý khi khớp pantry. */
const SEASONAL_INGREDIENT_HINTS: Record<VietnamSeasonPeriod, string[]> = {
  dry_cool: ["cải thảo", "su hào", "củ cải", "bí đỏ", "khoai lang"],
  hot_buildup: ["dưa chuột", "cà chua", "rau muống", "giá đỗ", "đậu bắp"],
  rainy_hot: ["bí đỏ", "rau muống", "mướp", "nấm", "đậu hũ"],
};

/**
 * Text block appended to core Gemini system instruction (Vietnamese).
 */
export function seasonContextPromptBlock(now: Date = new Date()): string {
  const month = getMonthInHoChiMinh(now);
  const period = getVietnamSeasonPeriod(month);
  const label = SEASON_LABELS[period];
  const guide = SEASON_GUIDANCE[period];
  const ingredients = SEASONAL_INGREDIENT_HINTS[period].join(", ");

  return [
    "",
    "THỜI TIẾT / MÙA (Việt Nam — dùng giờ Hồ Chí Minh):",
    `Hiện tại là tháng ${month}, ${label}.`,
    guide,
    `Nguyên liệu theo mùa có thể ưu tiên khi phù hợp nguyên liệu user có: ${ingredients}.`,
    "Không bắt buộc chỉ các nguyên liệu trên — vẫn tuân avoid/supplement của user.",
    "",
  ].join("\n");
}
