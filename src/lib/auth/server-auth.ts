import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";

export { AUTH_SESSION_COOKIE_NAME } from "./session-cookie-name";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export const AUTH_SESSION_MAX_AGE_SECONDS = Number.parseInt(
  process.env.AUTH_COOKIE_MAX_AGE_SECONDS?.trim() || "",
  10,
);
export const AUTH_SESSION_TTL_SECONDS =
  Number.isFinite(AUTH_SESSION_MAX_AGE_SECONDS) && AUTH_SESSION_MAX_AGE_SECONDS > 0
    ? AUTH_SESSION_MAX_AGE_SECONDS
    : 55 * 60;

const allowedUid =
  process.env.ALLOWED_USER_UID?.trim() || process.env.NEXT_PUBLIC_ALLOWED_USER_UID?.trim() || "";
const allowedEmail = norm(
  process.env.ALLOWED_USER_EMAIL || process.env.NEXT_PUBLIC_ALLOWED_EMAIL || "",
);

export function hasServerAllowlist(): boolean {
  return Boolean(allowedUid || allowedEmail);
}

export function isDecodedTokenAllowedUser(token: Pick<DecodedIdToken, "uid" | "email">): boolean {
  if (allowedUid && token.uid === allowedUid) return true;
  if (allowedEmail && norm(token.email) === allowedEmail) return true;
  return false;
}
