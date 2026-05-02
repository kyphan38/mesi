/** Stable doc id under users/{uid}/ingredients for a free-text ingredient line. */
export function ingredientLineDocId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return `c_${base || "x"}`;
}
