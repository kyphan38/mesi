/** When set, home shows the plan form even if today's confirmed plan still exists (user chose "Lên plan mới" without deleting). */
const KEY = "mesi:homeComposeNewPlan";

export function setHomeComposeNewPlanActive(active: boolean): void {
  if (typeof window === "undefined") return;
  if (active) sessionStorage.setItem(KEY, "1");
  else sessionStorage.removeItem(KEY);
}

export function getHomeComposeNewPlanActive(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KEY) === "1";
}
