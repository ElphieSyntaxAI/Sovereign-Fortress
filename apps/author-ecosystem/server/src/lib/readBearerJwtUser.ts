import jwt from "jsonwebtoken";
import type { Request, Response } from "express";

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

function normalizeRole(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "AUTHOR";
  const u = raw.trim().toUpperCase();
  if (u === "EDITOR" || u === "AUTHOR" || u === "FAN" || u === "PUBLISHER") return u;
  return "AUTHOR";
}

function roleFromPayload(decoded: JwtUser): string {
  const meta = decoded.user_metadata;
  if (meta && typeof meta === "object") {
    const mr = meta["role"] ?? meta["terms_role"];
    if (typeof mr === "string" && mr.trim()) return normalizeRole(mr);
  }
  const r = decoded.role ?? decoded.terms_role ?? decoded.user_role;
  return normalizeRole(r);
}

export function readBearerUser(req: Request, res: Response): BffAuthUser | null {
  const token = getJwtFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "Missing auth — use httpOnly session cookie or Authorization: Bearer" });
    return null;
  }
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    res.status(500).json({ error: "JWT_SECRET is not configured" });
    return null;
  }
  try {
    const decoded = jwt.verify(token, secret) as JwtUser;
    const userId = decoded.user_id ?? decoded.id;
    if (!userId || String(userId).trim() === "") {
      res.status(403).json({ error: "Token missing user id" });
      return null;
    }
    return { userId: String(userId), role: roleFromPayload(decoded) };
  } catch {
    res.status(403).json({ error: "Invalid or expired token" });
    return null;
  }
}
