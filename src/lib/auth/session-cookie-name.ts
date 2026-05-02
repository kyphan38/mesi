/** Shared between Node route handlers and Edge (proxy); no server-only imports. */
export const AUTH_SESSION_COOKIE_NAME =
  process.env.AUTH_SESSION_COOKIE_NAME?.trim() ||
  process.env.AUTH_COOKIE_NAME?.trim() ||
  "mesi_session";
