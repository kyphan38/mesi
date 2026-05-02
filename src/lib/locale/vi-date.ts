/** Display a YYYY-MM-DD key in Vietnamese (local calendar day). */
export function formatDateKeyVi(dateKey: string): string {
  const parts = dateKey.split("-").map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(dt);
}
