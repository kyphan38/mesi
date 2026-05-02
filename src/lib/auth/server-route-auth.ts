import "server-only";

import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebaseAdmin";
import {
  AUTH_SESSION_COOKIE_NAME,
  hasServerAllowlist,
  isDecodedTokenAllowedUser,
} from "@/lib/auth/server-auth";

type RouteAuthSuccess = {
  ok: true;
  user: {
    uid: string;
    email: string | null;
  };
  idToken: string;
};

type RouteAuthFailure = {
  ok: false;
  response: NextResponse;
};

export type RouteAuthResult = RouteAuthSuccess | RouteAuthFailure;

function readBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]!.trim() : null;
}

function readCookieToken(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    if (key !== cookieName) continue;
    const value = part.slice(eq + 1).trim();
    return value ? decodeURIComponent(value) : null;
  }
  return null;
}

export async function requireAuthenticatedRouteUser(req: Request): Promise<RouteAuthResult> {
  const token =
    readBearerToken(req.headers.get("authorization")) ??
    readCookieToken(req.headers.get("cookie"), AUTH_SESSION_COOKIE_NAME);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Missing auth token" }, { status: 401 }),
    };
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    if (hasServerAllowlist() && !isDecodedTokenAllowedUser(decoded)) {
      return {
        ok: false,
        response: NextResponse.json({ ok: false, error: "Unauthorized user" }, { status: 403 }),
      };
    }
    return {
      ok: true,
      user: {
        uid: decoded.uid,
        email: decoded.email ?? null,
      },
      idToken: token,
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Invalid Firebase token" }, { status: 401 }),
    };
  }
}
