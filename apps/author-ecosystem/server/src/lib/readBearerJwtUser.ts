import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import type { Request, Response } from "express";

import { loadMonorepoRootEnv } from "./database/loadRootEnv.js";
import { getJwtFromRequest } from "./bffAuthCookies.js";

type JwtUser = {
  user_id?: string;
  id?: string;
  role?: string;
  terms_role?: string;
  user_role?: string;
  user_metadata?: Record<string, unknown>;
};

export type BffAuthUser = {
  userId: string;
  /**
   * Uppercased lane for RBAC (`AUTHOR`, `EDITOR`, `FAN`, `PUBLISHER`).
   * Defaults to `AUTHOR` when the legacy JWT omits role claims.
   */
  role: string;
};

export function normalizeRole(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "AUTHOR";
  const u = raw.trim().toUpperCase();
  if (u === "EDITOR" || u === "AUTHOR" || u === "FAN" || u === "PUBLISHER" || u === "HELPER") return u;
  return "AUTHOR";
}

function roleFromPayload(decoded: JwtUser): string {
  const meta = decoded.user_metadata;
  if (meta && typeof meta === "object") {
    const mr = meta["role"] ?? meta["terms_role"] ?? meta["user_role"];
    if (typeof mr === "string" && mr.trim()) return normalizeRole(mr);
  }
  const r = decoded.role ?? decoded.terms_role ?? decoded.user_role;
  return normalizeRole(r);
}

/**
 * Supabase-issued access tokens (HS256) verified with Dashboard → Settings → API → JWT Secret
 * (`SUPABASE_JWT_SECRET`). Prefer over legacy `JWT_SECRET` when both could apply.
 *
 * `user_metadata.legacy_user_id` is set by `migrate-legacy-users.ts` so BFF row keys stay aligned
 * with `msgf_legacy_users.user_id` until data is fully re-keyed to `auth.users.id`.
 */
function expectedSupabaseAuthIssuer(): string | null {
  loadMonorepoRootEnv();
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return `${u.origin}/auth/v1`;
  } catch {
    return null;
  }
}

function trySupabaseAccessToken(token: string): BffAuthUser | null {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as JwtPayload & JwtUser;

    const iss = decoded.iss;
    const expectedIss = expectedSupabaseAuthIssuer();
    if (expectedIss && typeof iss === "string" && iss !== expectedIss) {
      return null;
    }

    const sub = decoded.sub;
    if (!sub || String(sub).trim() === "") return null;
    const meta =
      decoded.user_metadata && typeof decoded.user_metadata === "object" && !Array.isArray(decoded.user_metadata)
        ? (decoded.user_metadata as Record<string, unknown>)
        : {};
    const legacyRaw = meta["legacy_user_id"];
    const userId =
      typeof legacyRaw === "string" && legacyRaw.trim()
        ? legacyRaw.trim()
        : typeof legacyRaw === "number"
          ? String(legacyRaw)
          : String(sub);
    return { userId, role: roleFromPayload({ ...decoded, user_metadata: meta }) };
  } catch {
    return null;
  }
}

function tryLegacyJwt(token: string): BffAuthUser | null {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret) as JwtUser;
    const userId = decoded.user_id ?? decoded.id;
    if (!userId || String(userId).trim() === "") return null;
    return { userId: String(userId), role: roleFromPayload(decoded) };
  } catch {
    return null;
  }
}

export function readBearerUser(req: Request, res: Response): BffAuthUser | null {
  const token = getJwtFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "Missing auth — use httpOnly session cookie or Authorization: Bearer" });
    return null;
  }

  const fromSupabase = trySupabaseAccessToken(token);
  if (fromSupabase) return fromSupabase;

  const fromLegacy = tryLegacyJwt(token);
  if (fromLegacy) return fromLegacy;

  res.status(403).json({ error: "Invalid or expired token" });
  return null;
}
