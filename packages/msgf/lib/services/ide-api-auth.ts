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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * IDE bearer (msgf_ide_*) resolution for dev-event, verify-result, report-issue.
 */

import type { NextRequest } from "next/server";

import { MSGF_ENTITY_ID_HEADER, MSGF_TENANT_KEY_HEADER } from "@/lib/msgf-http-headers";
import { verifyIdeToken } from "@/lib/services/ide-token-service";
import { createAdminClient } from "@/utils/supabase/admin";

export class IdeApiAuthError extends Error {
  constructor(
    message: string,
    readonly status: number = 401
  ) {
    super(message);
    this.name = "IdeApiAuthError";
  }
}

function getBearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const apiKey = req.headers.get("x-msgf-api-key");
  return apiKey?.trim() || null;
}

/**
 * Resolve actor when Authorization bearer is msgf_ide_*.
 * Returns null when bearer is absent or not an IDE token (caller may try other auth).
 */
export async function tryResolveIdeTokenActor(
  req: NextRequest,
  tenantKey: string
): Promise<{
  admin: ReturnType<typeof createAdminClient>;
  entityId: string;
  userId: string | null;
} | null> {
  const bearer = getBearer(req);
  if (!bearer?.startsWith("msgf_ide_")) return null;

  const admin = createAdminClient();
  const headerTenant = req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim();
  const tid = (headerTenant || tenantKey).trim();
  const verified = await verifyIdeToken(admin, bearer, tid);
  if (!verified) {
    throw new IdeApiAuthError("IDE token rejected for tenant scope.", 403);
  }

  const entityId =
    req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() ||
    process.env.MSGF_SOLO_ENTITY_ID?.trim() ||
    verified.user_id;

  return { admin, entityId, userId: verified.user_id };
}
