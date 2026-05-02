import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AUTH_SESSION_COOKIE_NAME,
  hasEdgeAllowlistConfig,
  isEdgeAllowedUser,
  readBearerToken as parseBearerToken,
  verifyFirebaseJwt,
} from "@/lib/auth/edge-auth";

function isExcludedPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/api/auth/session") return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/\.[a-z0-9]+$/i.test(pathname)) return true;
  return false;
}

function readBearerToken(request: NextRequest): string | null {
  return parseBearerToken(request.headers.get("authorization"));
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL("/login", req.url);
  const pathname = req.nextUrl.pathname;
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isExcludedPath(pathname)) {
    return NextResponse.next();
  }
  if (!hasEdgeAllowlistConfig()) {
    return NextResponse.next();
  }

  const isApiRequest = pathname.startsWith("/api/");
  const token = readBearerToken(req) ?? req.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value ?? null;
  if (!token) {
    return isApiRequest
      ? NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
      : redirectToLogin(req);
  }

  const payload = await verifyFirebaseJwt(token);
  if (!payload) {
    return isApiRequest
      ? NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
      : redirectToLogin(req);
  }
  if (!isEdgeAllowedUser(payload)) {
    return isApiRequest
      ? NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
      : new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
