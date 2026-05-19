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
 * Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
 */
/**
 * Service-role / ops admin authentication for MSGF admin API routes (M4 dashboard).
 */

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

  const allowed = new Set<string>();
  if (serviceRole) allowed.add(serviceRole);
  if (adminKey) allowed.add(adminKey);

  if (!allowed.size) {
    throw new MsgfAdminAuthError(
      "Server missing SUPABASE_SERVICE_ROLE_KEY (or MSGF_ADMIN_API_KEY).",
      500
    );
  }

  if (!allowed.has(token)) {
    throw new MsgfAdminAuthError("Invalid admin credentials.");
  }
}
