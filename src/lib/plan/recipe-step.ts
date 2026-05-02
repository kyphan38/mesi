/** Strip leading "1. " / "2) " so <ol> does not double-number Gemini output. */
export function stripLeadingStepNumber(step: string): string {
  return step.replace(/^\d+[\.\)]\s*/, "").trim();
}
