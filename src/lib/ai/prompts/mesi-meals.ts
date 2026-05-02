import { baselinePromptBlock, type ApiNutritionGoalKey } from "@/lib/meal-plan/nutrition-baseline";
import type {
  ApiMealTime,
  MealEffort,
  SuggestMealPrepRequest,
  SuggestMealsRequest,
  TasteContext,
} from "@/lib/ai/types/meal-api";
import type { MealOption } from "@/lib/ai/validators/meals";
import { seasonContextPromptBlock } from "@/lib/season/vietnam-season";

export type HealthProfilePayload = SuggestMealsRequest["health_profile"];

export function tasteContextPromptBlock(ctx: TasteContext): string {
  const liked = ctx.liked_meal_names.filter(Boolean);
  const disliked = ctx.disliked_meal_names.filter(Boolean);
  if (liked.length === 0 && disliked.length === 0) return "";
  const lines = [
    "",
    "PHẢN HỒI KHẨU VỊ (theo đánh giá trước — ưu tiên phù hợp, không bắt buộc trùng món):",
  ];
  if (liked.length > 0) {
    lines.push(`User gần đây đánh giá TÍCH CỰC các món kiểu: ${liked.join(", ")}.`);
  }
  if (disliked.length > 0) {
    lines.push(`User gần đây đánh giá CHƯA HỢP / tiêu cực (tránh lặp lại nếu có thể): ${disliked.join(", ")}.`);
  }
  return lines.join("\n");
}

function avoidLine(avoid: string[]): string {
  const joined = avoid.filter(Boolean).join(", ");
  return joined ? `TUYỆT ĐỐI KHÔNG dùng: ${joined}` : "Không có danh sách tránh cụ thể — vẫn tuân thủ nguyên tắc dưới đây.";
}

/** Shared dietary rules + profile — prepended to task-specific instructions. */
export function buildCoreHealthSystemInstruction(hp: HealthProfilePayload): string {
  const baseline = baselinePromptBlock(hp.goal as ApiNutritionGoalKey);
  const supp =
    hp.supplements.length > 0
      ? hp.supplements.join(", ")
      : "Không khai báo supplement";

  return [
    "Bạn là chuyên gia dinh dưỡng Việt Nam. Chỉ trả lời bằng JSON đúng schema user yêu cầu. Không markdown. Tiếng Việt cho các trường văn bản.",
    "",
    "NGUYÊN TẮC BẮT BUỘC — KHÔNG ĐƯỢC VI PHẠM:",
    avoidLine(hp.avoid),
    "KHÔNG gợi ý món chiên ngập dầu, dầu tái sử dụng, hoặc chứa trans fat.",
    "KHÔNG dùng sữa bò, bơ sữa, phô mai, cream, whey từ sữa bò.",
    "KHÔNG dùng đường trắng, đường nâu, syrup; mật ong tối đa ~1 muỗng cà phê nếu có.",
    "Ưu tiên: hấp, luộc, áp chảo ít dầu olive hoặc dầu mè.",
    "Ưu tiên thực phẩm giàu omega-3, kẽm, vitamin A, chất chống viêm.",
    "Ưu tiên carb chỉ số đường huyết thấp (khoai lang, yến mạch, gạo lứt hơn gạo trắng) khi phù hợp.",
    "",
    "## NGUYÊN TẮC KẾT HỢP NGUYÊN LIỆU:",
    "- Danh sách nguyên liệu user cung cấp là NHỮNG GÌ CÓ SẴN TRONG NHÀ, KHÔNG PHẢI yêu cầu dùng hết.",
    "- Mỗi món chỉ dùng 2-4 nguyên liệu chính. KHÔNG nhồi nhét tất cả nguyên liệu vào một món.",
    "- Ưu tiên kết hợp tự nhiên theo ẩm thực Việt Nam và thực tế nấu ăn hàng ngày.",
    "- Trái cây (ổi, chuối, táo...) mặc định là ĂN RIÊNG hoặc làm món tráng miệng/snack, KHÔNG trộn vào món mặn trừ khi là công thức truyền thống phổ biến (ví dụ: canh chua có thơm/dứa thì OK).",
    "- Các món gợi ý phải là món mà người Việt bình thường sẽ nấu ở nhà, không phải fusion thử nghiệm.",
    "- 3 options nên đa dạng: mỗi option dùng combo nguyên liệu KHÁC NHAU, không phải 3 biến thể của cùng một nhóm nguyên liệu.",
    "",
    baseline,
    "",
    `MỤC TIÊU DINH DƯỠNG (khóa API): ${hp.goal}`,
    `ĐANG UỐNG SUPPLEMENT: ${supp} — gợi ý timing uống hợp lý trong plan (có thể tóm tắt trong supplement_plan_hint nếu có).`,
    "",
    "QUY TẮC GỢI Ý UỐNG SUPPLEMENT (khi viết supplement_plan_hint hoặc nhắc user):",
    "Dầu cá (Omega-3): uống sau bữa có chất béo (sáng hoặc trưa).",
    "Vitamin C: uống giữa buổi sáng hoặc sau bữa trưa.",
    "Vitamin D: uống sau bữa có chất béo.",
    "Kẽm: uống trước bữa tối 30 phút hoặc trước ngủ.",
    "Probiotic: uống lúc bụng đói, sáng sớm trước bữa.",
    seasonContextPromptBlock(),
  ].join("\n");
}

export function buildSuggestMealsSystemInstruction(
  hp: HealthProfilePayload,
  taste?: TasteContext | undefined,
): string {
  return (
    buildCoreHealthSystemInstruction(hp) +
    tasteContextPromptBlock(taste ?? { liked_meal_names: [], disliked_meal_names: [] }) +
    [
      "NHIỆM VỤ: Gợi ý MÓN ĂN tiếng Việt từ nguyên liệu có sẵn và effort từng buổi.",
      "Không tính nutrition_gaps tổng ngày trong response — chỉ gợi ý từng món/bữa.",
      "Với MỖI buổi trong request, trả đúng 3 options.",
      "Mỗi option gồm: name, description (1 câu), ingredients (chuỗi có khối lượng, VD \"ức gà 150g\"), calories (ước lượng cho số khẩu phần servings), macros { protein_g, carb_g, fat_g }, glycemic_load (low|medium|high), insulin_spike (Thấp|Trung bình|Cao), prep_time_minutes, cooking_method, missing_ingredients (chính hoặc gia vị lớn), fun_fact (\"Có thể bạn chưa biết\" — liên quan sức khỏe/da/dinh dưỡng).",
      'Root JSON: { "meals": { "<morning|lunch|dinner>": [option, option, option], ... }, "supplement_plan_hint"?: string }.',
      "Chỉ include keys trong meals cho các buổi được request.",
    ].join("\n")
  );
}

export function buildSuggestMealsUserMessage(body: SuggestMealsRequest): string {
  return [
    "Payload JSON — tuân thủ và sinh output JSON:",
    JSON.stringify(body, null, 2),
  ].join("\n\n");
}

export function buildSuggestMealPrepSystemInstruction(
  hp: HealthProfilePayload,
  prepDayCount: number,
  taste?: TasteContext | undefined,
): string {
  return (
    buildCoreHealthSystemInstruction(hp) +
    tasteContextPromptBlock(taste ?? { liked_meal_names: [], disliked_meal_names: [] }) +
    [
      `NHIỆM VỤ: Lập kế hoạch MEAL PREP cho đúng ${prepDayCount} ngày liên tiếp (day_index 1..${prepDayCount}), dùng nguyên liệu có sẵn và effort từng buổi trong request.`,
      "Tối ưu: một lần nấu nhiều phần, bữa sau có thể hâm / lấy từ tủ lạnh / nấu mới tùy meal_kind.",
      "Mỗi entry trong meal_schedule phải có: day_index (1..N), slot (morning|lunch|dinner), meal (cùng schema option suggest-meals), meal_kind (cook_fresh|reheat|from_fridge).",
      "prep_instructions: hướng dẫn ngắn gọn prep batch (luộc/chia khẩu phần/bảo quản).",
      "batch_shopping_list: danh sách string nguyên liệu cần mua thêm cho cả batch (có thể rỗng).",
      'Root JSON: { "prep_instructions": string, "meal_schedule": [ ... ], "batch_shopping_list"?: string[], "supplement_plan_hint"?: string }.',
      "meal_schedule phải cover các buổi được bật trong request.meals cho mỗi ngày (đủ slot theo từng ngày).",
    ].join("\n")
  );
}

export function buildSuggestMealPrepUserMessage(body: SuggestMealPrepRequest): string {
  return [
    "Payload JSON — tuân thủ và sinh output JSON:",
    JSON.stringify(body, null, 2),
  ].join("\n\n");
}

export function buildAdjustMealSystemInstruction(hp: HealthProfilePayload): string {
  return (
    buildCoreHealthSystemInstruction(hp) +
    [
      "NHIỆM VỤ: User chỉnh nguyên liệu món đã chọn. Trả về MỘT object meal đã cập nhật.",
      "Tính lại calories, macros, glycemic_load, insulin_spike, missing_ingredients, description ngắn cho phù hợp.",
      'Root JSON: { "meal": { ...same shape as một option trong suggest-meals... } }.',
    ].join("\n")
  );
}

export type AdjustMealRequestBody = {
  meal: MealOption;
  changes: { add?: string[]; remove?: string[] };
  health_profile: HealthProfilePayload;
};

export function buildAdjustMealUserMessage(body: AdjustMealRequestBody): string {
  return JSON.stringify(body, null, 2);
}

export function buildShoppingSuggestSystemInstruction(hp: HealthProfilePayload): string {
  return (
    buildCoreHealthSystemInstruction(hp) +
    [
      "NHIỆM VỤ: Gợi ý 2–3 nguyên liệu nên mua thêm để bữa đủ chất (không vi phạm avoid).",
      "Giải thích ngắn tại sao (VD đủ protein buổi tối).",
      "Nếu bữa đã đủ chất, reassurance_note nêu rõ \"Không mua cũng OK, bữa ăn vẫn ổn\" hoặc tương đương.",
      'Root JSON: { "suggestions": [ { "ingredient", "reason" } ], "reassurance_note": string }.',
      "Tối đa 3 suggestions (có thể 2).",
    ].join("\n")
  );
}

export type ShoppingSuggestRequestBody = {
  meal: MealOption;
  available_ingredients: string[];
  health_profile: HealthProfilePayload;
};

export function buildShoppingSuggestUserMessage(body: ShoppingSuggestRequestBody): string {
  return JSON.stringify(body, null, 2);
}

/** Slots derived from request — stable order for validation. */
export function mealTimesFromRequest(meals: { time: ApiMealTime }[]): ApiMealTime[] {
  const seen = new Set<ApiMealTime>();
  const out: ApiMealTime[] = [];
  for (const m of meals) {
    if (!seen.has(m.time)) {
      seen.add(m.time);
      out.push(m.time);
    }
  }
  return out;
}

export function buildRecipeDetailSystemInstruction(hp: HealthProfilePayload): string {
  return (
    buildCoreHealthSystemInstruction(hp) +
    [
      "NHIỆM VỤ: Viết công thức nấu tiếng Việt cho một món đã định.",
      "Nguyên liệu trong payload là danh sách chuỗi — giữ đúng tinh thần porportion cho số khẩu phần servings.",
      'Root JSON: { "steps": string[] (đánh số trong nội dung hoặc thứ tự mảng), "tips"?: string }.',
      "Không markdown JSON ngoài schema.",
    ].join("\n")
  );
}

export type RecipeDetailRequestBody = {
  meal: MealOption;
  servings: number;
};

export function buildRecipeDetailUserMessage(body: RecipeDetailRequestBody): string {
  return JSON.stringify(body, null, 2);
}

export function buildSwapMealSystemInstruction(hp: HealthProfilePayload): string {
  return (
    buildCoreHealthSystemInstruction(hp) +
    [
      "NHIỆM VỤ: Gợi ý MỘT món thay thế (swap) cho buổi ăn đã cho — khác rõ ràng so với món cũ và với MỌI tên trong exclude_meals.",
      "Không được trùng hoặc gần trùng (cùng tên hoặc biến thể) bất kỳ món trong exclude_meals.",
      "Vẫn dùng nguyên liệu có sẵn (ingredients) và effort; tuân tránh avoid.",
      'Root JSON: { "meal": { ...cùng schema một option suggest-meals... } }.',
    ].join("\n")
  );
}

export type SwapMealRequestBody = {
  health_profile: HealthProfilePayload;
  ingredients: string[];
  servings: number;
  slot: ApiMealTime;
  effort: MealEffort;
  current_meal: MealOption;
  exclude_meals: string[];
};

export function buildSwapMealUserMessage(body: SwapMealRequestBody): string {
  return JSON.stringify(body, null, 2);
}
