import type { Request } from "express";

/** HttpOnly cookie carrying the same JWT the legacy stack signs (`JWT_SECRET`). */
export const BFF_AUTH_COOKIE_NAME = "author_bff_jwt";

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader?.trim()) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

/** JWT from httpOnly cookie first, then `Authorization: Bearer` (CLI / extension / migration). */
export function getJwtFromRequest(req: Request): string | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const fromCookie = cookies[BFF_AUTH_COOKIE_NAME]?.trim();
  if (fromCookie) return fromCookie;

  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    return t || null;
  }
  return null;
}

export function bffCookieBaseOptions(): {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  const sameSiteRaw = (process.env.BFF_COOKIE_SAMESITE ?? "lax").toLowerCase().trim();
  const sameSite: "lax" | "strict" | "none" =
    sameSiteRaw === "none" || sameSiteRaw === "strict" ? (sameSiteRaw as "none" | "strict") : "lax";
  const secure =
    process.env.BFF_COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production" ||
    sameSite === "none";
  const days = Number(process.env.BFF_AUTH_COOKIE_MAX_DAYS ?? "7");
  const maxAge = Math.max(1, Number.isFinite(days) ? days : 7) * 24 * 60 * 60 * 1000;
  return { httpOnly: true, sameSite, secure, path: "/", maxAge };
}
