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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
/**
 * Actor resolution for POST /api/msgf/dev-event (license / API key / session).
 */

import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

import {
  isTenantApiKeyConfigured,
  resolveTenantIdFromApiKey,
} from "@/lib/api-key-tenant";
import { logIdentityViolation } from "@/lib/identity-violation-log";
import { MSGF_ENTITY_ID_HEADER } from "@/lib/msgf-http-headers";
import { DevEventValidationError } from "@/lib/schemas/dev-event";
import {
  assertPulseLicense,
  extractLicenseKeyFromRequest,
} from "@/lib/services/pulse-license";
import { PulseHttpError } from "@/lib/services/pulse-http-error";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  createClient as createSupabaseServerClient,
  requestHostFromRequest,
} from "@/utils/supabase/server";

function getApiKey(req: NextRequest): string | null {
  const h = req.headers.get("x-msgf-api-key");
  if (h?.trim()) return h.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

export async function resolveDevEventActor(
  req: NextRequest,
  tenantId: string
): Promise<{ admin: ReturnType<typeof createAdminClient>; entityId: string }> {
  const admin = createAdminClient();
  const tid = tenantId.trim();

  const contractLicense = extractLicenseKeyFromRequest(req);
  if (contractLicense?.startsWith("msgf_live_")) {
    try {
      const license = await assertPulseLicense({ adminSupabase: admin, request: req });
      if (license.tenantId.trim() !== tid) {
        await logIdentityViolation({
          source: "dev_event_api",
          reason: "license_tenant_mismatch",
          claimed_tenant_id: tid,
          resolved_tenant_id: license.tenantId,
        });
        throw new DevEventValidationError(
          "Identity violation: tenantId does not match contract license.",
          [{ path: "tenantId", message: "License tenant mismatch" }],
          403
        );
      }
      const entityId =
        req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() ||
        process.env.MSGF_SOLO_ENTITY_ID?.trim() ||
        tid;
      return { admin, entityId };
    } catch (e) {
      if (e instanceof DevEventValidationError) throw e;
      if (e instanceof PulseHttpError) {
        throw new DevEventValidationError(
          e.message,
          [{ path: "authorization", message: String(e.body.error ?? e.message) }],
          e.status
        );
      }
      throw e;
    }
  }

  const apiKey = getApiKey(req);
  if (isTenantApiKeyConfigured() && apiKey) {
    const resolved = resolveTenantIdFromApiKey(apiKey);
    if (!resolved || resolved !== tid) {
      await logIdentityViolation({
        source: "dev_event_api",
        reason: "tenant_api_key_mismatch",
        claimed_tenant_id: tid,
        resolved_tenant_id: resolved ?? null,
      });
      throw new DevEventValidationError(
        "Identity violation: tenantId does not match API key.",
        [{ path: "tenantId", message: "API key tenant mismatch" }],
        403
      );
    }
    const entityId = req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() || tid;
    return { admin, entityId };
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore, requestHostFromRequest(req));
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new DevEventValidationError(
      "Unauthorized — sign in or provide contract license / tenant API key.",
      [{ path: "authorization", message: "Missing session" }],
      401
    );
  }

  return { admin, entityId: user.id };
}
