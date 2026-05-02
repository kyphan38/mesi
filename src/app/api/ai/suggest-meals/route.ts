import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGeminiJson } from "@/lib/ai/gemini";
import { GEMINI_JSON_RETRY_SUFFIX } from "@/lib/ai/prompts/json-retry";
import {
  buildSuggestMealsSystemInstruction,
  buildSuggestMealsUserMessage,
  mealTimesFromRequest,
} from "@/lib/ai/prompts/mesi-meals";
import type { SuggestMealsRequest } from "@/lib/ai/types/meal-api";
import { healthProfileApiSchema } from "@/lib/ai/validators/health-profile-api";
import { parseSuggestMealsJson } from "@/lib/ai/validators/meals";
import { requireAuthenticatedRouteUser } from "@/lib/auth/server-route-auth";

export const maxDuration = 60;

const bodySchema = z.object({
  ingredients: z.array(z.string()).min(1),
  meals: z
    .array(
      z.object({
        time: z.enum(["morning", "lunch", "dinner"]),
        effort: z.enum(["quick", "medium", "high"]),
      }),
    )
    .min(1),
  servings: z.number().int().min(1).max(99),
  health_profile: healthProfileApiSchema,
  taste_context: z
    .object({
      liked_meal_names: z.array(z.string()),
      disliked_meal_names: z.array(z.string()),
    })
    .optional(),
  user_note: z.string().max(600).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthenticatedRouteUser(req);
  if (!auth.ok) return auth.response;

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Server is missing GEMINI_API_KEY" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const data: SuggestMealsRequest = parsed.data;
  const slots = mealTimesFromRequest(data.meals);
  const system = buildSuggestMealsSystemInstruction(
    data.health_profile,
    data.servings,
    data.taste_context,
  );
  const userMsg = buildSuggestMealsUserMessage(data);

  try {
    let raw = await generateGeminiJson(system, userMsg);
    let out = parseSuggestMealsJson(raw, slots);
    if (!out.success) {
      raw = await generateGeminiJson(system, userMsg + GEMINI_JSON_RETRY_SUFFIX);
      out = parseSuggestMealsJson(raw, slots);
    }
    if (!out.success) {
      return NextResponse.json(
        { ok: false, error: out.error, rawSnippet: raw.slice(0, 500) },
        { status: 422 },
      );
    }
    return NextResponse.json({ ok: true, data: out.data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
