import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGeminiJson } from "@/lib/ai/gemini";
import { GEMINI_JSON_RETRY_SUFFIX } from "@/lib/ai/prompts/json-retry";
import {
  buildSuggestMealPrepSystemInstruction,
  buildSuggestMealPrepUserMessage,
} from "@/lib/ai/prompts/mesi-meals";
import type { SuggestMealPrepRequest } from "@/lib/ai/types/meal-api";
import { parseSuggestMealPrepJson } from "@/lib/ai/validators/meals";
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
  health_profile: z.object({
    avoid: z.array(z.string()),
    goal: z.enum(["clear_skin", "lose_weight", "gain_muscle", "maintain_weight"]),
    supplements: z.array(z.string()),
  }),
  prep_day_count: z.number().int().min(2).max(7),
  taste_context: z
    .object({
      liked_meal_names: z.array(z.string()),
      disliked_meal_names: z.array(z.string()),
    })
    .optional(),
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

  const data: SuggestMealPrepRequest = parsed.data;
  const prepN = data.prep_day_count;
  const system = buildSuggestMealPrepSystemInstruction(data.health_profile, prepN, data.taste_context);
  const userMsg = buildSuggestMealPrepUserMessage(data);

  try {
    let raw = await generateGeminiJson(system, userMsg);
    let out = parseSuggestMealPrepJson(raw, prepN);
    if (!out.success) {
      raw = await generateGeminiJson(system, userMsg + GEMINI_JSON_RETRY_SUFFIX);
      out = parseSuggestMealPrepJson(raw, prepN);
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
