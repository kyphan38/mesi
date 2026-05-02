import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGeminiJson } from "@/lib/ai/gemini";
import { GEMINI_JSON_RETRY_SUFFIX } from "@/lib/ai/prompts/json-retry";
import {
  buildSwapMealSystemInstruction,
  buildSwapMealUserMessage,
  type HealthProfilePayload,
} from "@/lib/ai/prompts/mesi-meals";
import { mealOptionSchema, parseAdjustMealJson } from "@/lib/ai/validators/meals";
import { requireAuthenticatedRouteUser } from "@/lib/auth/server-route-auth";

export const maxDuration = 60;

const healthProfileSchema = z.object({
  avoid: z.array(z.string()),
  goal: z.enum(["clear_skin", "lose_weight", "gain_muscle", "maintain_weight"]),
  supplements: z.array(z.string()),
});

const bodySchema = z.object({
  health_profile: healthProfileSchema,
  ingredients: z.array(z.string()).min(1),
  servings: z.number().int().min(1).max(99),
  slot: z.enum(["morning", "lunch", "dinner"]),
  effort: z.enum(["quick", "medium", "high"]),
  current_meal: mealOptionSchema,
  exclude_meals: z.array(z.string()),
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

  const data = parsed.data;
  const hp = data.health_profile as HealthProfilePayload;
  const system = buildSwapMealSystemInstruction(hp);
  const userMsg = buildSwapMealUserMessage({
    health_profile: hp,
    ingredients: data.ingredients,
    servings: data.servings,
    slot: data.slot,
    effort: data.effort,
    current_meal: data.current_meal,
    exclude_meals: data.exclude_meals,
  });

  try {
    let raw = await generateGeminiJson(system, userMsg);
    let out = parseAdjustMealJson(raw);
    if (!out.success) {
      raw = await generateGeminiJson(system, userMsg + GEMINI_JSON_RETRY_SUFFIX);
      out = parseAdjustMealJson(raw);
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
