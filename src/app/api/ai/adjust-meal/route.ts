import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGeminiJson } from "@/lib/ai/gemini";
import { GEMINI_JSON_RETRY_SUFFIX } from "@/lib/ai/prompts/json-retry";
import {
  buildAdjustMealSystemInstruction,
  buildAdjustMealUserMessage,
  type HealthProfilePayload,
} from "@/lib/ai/prompts/mesi-meals";
import { healthProfileApiSchema } from "@/lib/ai/validators/health-profile-api";
import { mealOptionSchema, parseAdjustMealJson } from "@/lib/ai/validators/meals";
import { requireAuthenticatedRouteUser } from "@/lib/auth/server-route-auth";

export const maxDuration = 60;

const bodySchema = z.object({
  health_profile: healthProfileApiSchema,
  meal: mealOptionSchema,
  servings: z.number().int().min(1).max(99),
  changes: z.object({
    remove: z.array(z.string()).min(1),
  }),
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
  const system = buildAdjustMealSystemInstruction(hp, data.servings);
  const userMsg = buildAdjustMealUserMessage({
    meal: data.meal,
    health_profile: hp,
    servings: data.servings,
    changes: data.changes,
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
