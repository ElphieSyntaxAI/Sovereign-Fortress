/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * Service-role / ops admin authentication for MSGF admin API routes (M4 dashboard).
 */

import { timingSafeEqual } from "crypto";

import type { NextRequest } from "next/server";

export class MsgfAdminAuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "MsgfAdminAuthError";
    this.status = status;
  }
}

function bearerToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
}

/** Constant-time secret compare (cron / admin keys). */
export function msgfSecureSecretEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type MsgfOpsCronAuthMethod = "cron_secret" | "admin_key";

export type MsgfOpsCronAuthResult = {
  method: MsgfOpsCronAuthMethod;
};

/**
 * Authenticate scheduled ops callers (Cloud Scheduler, GitHub Actions).
 * Accepts `Authorization: Bearer <MSGF_OPS_CRON_SECRET>` or `X-MSGF-Ops-Cron-Secret`.
 * When `allowAdminKey` is true, also accepts `MSGF_ADMIN_API_KEY` (non-production manual ops only).
 */
export function assertMsgfOpsCron(
  request: NextRequest,
  options?: { allowAdminKey?: boolean }
): MsgfOpsCronAuthResult {
  const cronSecret = process.env.MSGF_OPS_CRON_SECRET?.trim();
  if (!cronSecret) {
    throw new MsgfAdminAuthError(
      "Server missing MSGF_OPS_CRON_SECRET (required for v32-heartbeat).",
      500
    );
  }

  const token =
    bearerToken(request) ?? request.headers.get("x-msgf-ops-cron-secret")?.trim() ?? null;

  if (!token) {
    throw new MsgfAdminAuthError(
      "Missing ops cron credentials (Bearer or X-MSGF-Ops-Cron-Secret).",
      401
    );
  }

  if (msgfSecureSecretEqual(token, cronSecret)) {
    return { method: "cron_secret" };
  }

  if (options?.allowAdminKey) {
    const adminKey = process.env.MSGF_ADMIN_API_KEY?.trim();
    if (adminKey && msgfSecureSecretEqual(token, adminKey)) {
      return { method: "admin_key" };
    }
  }

  throw new MsgfAdminAuthError("Invalid ops cron credentials.", 401);
}

/**
 * Caller must present `Authorization: Bearer <token>` matching
 * `SUPABASE_SERVICE_ROLE_KEY` or `MSGF_ADMIN_API_KEY` (when set).
 */
export function assertMsgfServiceAdmin(request: NextRequest): void {
  const token = bearerToken(request);
  if (!token) {
    throw new MsgfAdminAuthError("Missing Authorization Bearer token.");
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const adminKey = process.env.MSGF_ADMIN_API_KEY?.trim();
  const cronSecret = process.env.MSGF_OPS_CRON_SECRET?.trim();

  const allowed = new Set<string>();
  if (serviceRole) allowed.add(serviceRole);
  if (adminKey) allowed.add(adminKey);
  if (cronSecret) allowed.add(cronSecret);

  if (!allowed.size) {
    throw new MsgfAdminAuthError(
      "Server missing SUPABASE_SERVICE_ROLE_KEY (or MSGF_ADMIN_API_KEY).",
      500
    );
  }

  let valid = false;
  for (const secret of allowed) {
    if (msgfSecureSecretEqual(token, secret)) {
      valid = true;
      break;
    }
  }
  if (!valid) {
    throw new MsgfAdminAuthError("Invalid admin credentials.");
  }
}
