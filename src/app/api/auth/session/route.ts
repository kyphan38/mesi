import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebaseAdmin";
import {
  AUTH_SESSION_COOKIE_NAME,
  AUTH_SESSION_TTL_SECONDS,
  hasServerAllowlist,
  isDecodedTokenAllowedUser,
} from "@/lib/auth/server-auth";

type SessionBody = { idToken?: unknown };

export async function POST(req: Request) {
  let body: SessionBody;
  try {
    body = (await req.json()) as SessionBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";
  if (!idToken) {
    return NextResponse.json({ ok: false, error: "idToken is required" }, { status: 400 });
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
    if (hasServerAllowlist() && !isDecodedTokenAllowedUser(decoded)) {
      return NextResponse.json({ ok: false, error: "Unauthorized user" }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_SESSION_COOKIE_NAME, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_SESSION_TTL_SECONDS,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid Firebase token" }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
