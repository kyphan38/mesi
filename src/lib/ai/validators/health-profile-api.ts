import { z } from "zod";

export const macroTargetsApiSchema = z.object({
  calories: z.number(),
  protein_g: z.number(),
  carb_g: z.number(),
  fat_g: z.number(),
});

export const healthProfileApiSchema = z.object({
  avoid: z.array(z.string()),
  goal: z.enum(["clear_skin", "lose_weight", "gain_muscle", "maintain_weight"]),
  supplements: z.array(z.string()),
  macro_targets: macroTargetsApiSchema,
});
