import type { Request } from "express";

import { loadMonorepoRootEnv } from "./database/loadRootEnv.js";
import { withBffSupabaseCookieOptions } from "./bffSupabaseCookieOptions.js";

/**
 * HttpOnly cookie mirroring the Supabase **access token** after BFF login (optional compatibility
 * for `readBearerUser` + `SUPABASE_JWT_SECRET`). Supabase SSR chunk cookies remain canonical for `@supabase/ssr`.
 */
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

/**
 * JWT / access token for the BFF: `Authorization: Bearer` first (Supabase access token or CLI),
 * then httpOnly `author_bff_jwt` (legacy bridge cookie). Bearer wins so a Supabase session is not
 * overridden by a stale legacy cookie.
 */
export function getJwtFromRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  const fromCookie = cookies[BFF_AUTH_COOKIE_NAME]?.trim();
  return fromCookie || null;
}

/**
 * `author_bff_jwt` uses the same **domain / path / sameSite / secure** defaults as Supabase SSR
 * cookies (`withBffSupabaseCookieOptions` → root `MSGF_AUTH_COOKIE_DOMAIN`, `MSGF_AUTH_COOKIE_SECURE`)
 * so a session minted on the BFF (e.g. `localhost:3002`) is visible to Next (`localhost:3000`) when
 * the host is shared (`localhost` cookies are not port-scoped in the cookie domain).
 *
 * Optional: `BFF_COOKIE_SAMESITE` (`lax` | `strict` | `none`). `none` forces `secure: true`.
 */
export function bffCookieBaseOptions(): {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  path: string;
  maxAge: number;
  domain?: string;
} {
  loadMonorepoRootEnv();
  const sameSiteRaw = (process.env.BFF_COOKIE_SAMESITE ?? "lax").toLowerCase().trim();
  const sameSite: "lax" | "strict" | "none" =
    sameSiteRaw === "none" || sameSiteRaw === "strict" ? (sameSiteRaw as "none" | "strict") : "lax";
  const days = Number(process.env.BFF_AUTH_COOKIE_MAX_DAYS ?? "7");
  const maxAge = Math.max(1, Number.isFinite(days) ? days : 7) * 24 * 60 * 60 * 1000;
  const secure =
    sameSite === "none" ||
    process.env.MSGF_AUTH_COOKIE_SECURE === "1" ||
    process.env.NODE_ENV === "production";

  const merged = withBffSupabaseCookieOptions({
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge,
  }) as {
    httpOnly?: boolean;
    sameSite: "lax" | "strict" | "none";
    secure: boolean;
    path: string;
    domain?: string;
  };

  const out: {
    httpOnly: boolean;
    sameSite: "lax" | "strict" | "none";
    secure: boolean;
    path: string;
    maxAge: number;
    domain?: string;
  } = {
    httpOnly: true,
    sameSite: merged.sameSite,
    secure: merged.secure,
    path: merged.path,
    maxAge,
  };
  if (merged.domain) out.domain = merged.domain;
  return out;
}
