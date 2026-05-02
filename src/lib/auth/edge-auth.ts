import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { AUTH_SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";

export { AUTH_SESSION_COOKIE_NAME };

type FirebaseTokenPayload = JWTPayload & {
  user_id?: string;
  email?: string;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? "";
const allowedUid =
  process.env.ALLOWED_USER_UID?.trim() || process.env.NEXT_PUBLIC_ALLOWED_USER_UID?.trim() || "";
const allowedEmail = norm(
  process.env.ALLOWED_USER_EMAIL || process.env.NEXT_PUBLIC_ALLOWED_EMAIL || "",
);

const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export function hasEdgeAllowlistConfig(): boolean {
  return Boolean(allowedUid || allowedEmail);
}

export function isEdgeAllowedUser(payload: FirebaseTokenPayload): boolean {
  const uid = (payload.user_id ?? payload.sub ?? "").trim();
  if (allowedUid && uid === allowedUid) return true;
  if (allowedEmail && norm(payload.email) === allowedEmail) return true;
  return false;
}

export async function verifyFirebaseJwt(token: string): Promise<FirebaseTokenPayload | null> {
  if (!projectId || !token) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    return payload as FirebaseTokenPayload;
  } catch {
    return null;
  }
}

export function readBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}
