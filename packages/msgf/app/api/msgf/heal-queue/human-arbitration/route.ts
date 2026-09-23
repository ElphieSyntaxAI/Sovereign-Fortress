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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import {
  isTenantApiKeyConfigured,
  resolveTenantIdFromApiKey,
} from "@/lib/api-key-tenant";
import { logIdentityViolation } from "@/lib/identity-violation-log";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  HealQueueValidationError,
  parseHealQueueHumanArbitrationBody,
} from "@/lib/schemas/heal-queue";
import { executeHealQueueHumanArbitration } from "@/lib/services/heal-queue-service";
import { sessionIsDashboardOperator } from "@/lib/services/resolve-dashboard-operator";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  createClient as createSupabaseServerClient,
  requestHostFromRequest,
} from "@/utils/supabase/server";

function healJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

function getApiKey(req: NextRequest): string | null {
  const h = req.headers.get("x-msgf-api-key");
  if (h?.trim()) return h.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

async function resolveHealQueueActor(
  req: NextRequest,
  tenantId: string
): Promise<{ admin: ReturnType<typeof createAdminClient>; entityId: string }> {
  const admin = createAdminClient();

  const apiKey = getApiKey(req);
  if (isTenantApiKeyConfigured() && apiKey) {
    const resolved = resolveTenantIdFromApiKey(apiKey);
    if (!resolved || resolved !== tenantId) {
      await logIdentityViolation({
        source: "heal_queue_human_arbitration_api",
        reason: "tenant_api_key_mismatch",
        claimed_tenant_id: tenantId,
        resolved_tenant_id: resolved ?? null,
      });
      throw new HealQueueValidationError(
        "Identity violation: tenant_id does not match API key.",
        [{ path: "tenant_id", message: "API key tenant mismatch" }],
        403
      );
    }
    return { admin, entityId: tenantId };
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore, requestHostFromRequest(req));
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new HealQueueValidationError(
      "Unauthorized — sign in or provide a tenant API key.",
      [{ path: "authorization", message: "Missing session" }],
      401
    );
  }

  return { admin, entityId: user.id };
}

const HumanArbitrationOkSchema = z
  .object({
    ok: z.literal(true),
    action: z.enum(["APPROVE_BYPASS", "DENY_PURGE"]),
    file_path: z.string(),
    remediation_state: z.string(),
    message: z.string(),
    security_clean_signal: z.boolean(),
  })
    .strict();

function arbitrationPayload(result: {
  ok: true;
  action: "APPROVE_BYPASS" | "DENY_PURGE";
  file_path: string;
  remediation_state: string;
  message: string;
  security_clean_signal: boolean;
}) {
  return HumanArbitrationOkSchema.parse({
    ok: true,
    action: result.action,
    file_path: result.file_path,
    remediation_state: result.remediation_state,
    message: result.message,
    security_clean_signal: result.security_clean_signal,
  });
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return healJson(
        req,
        {
          ok: false,
          error: "HEAL_QUEUE_VALIDATION_ERROR",
          message: "Invalid JSON body.",
          issues: [{ path: "body", message: "Expected JSON object" }],
        },
        { status: 400 }
      );
    }

    const body = parseHealQueueHumanArbitrationBody(raw);
    const apiKey = getApiKey(req);
    const { admin, entityId } = await resolveHealQueueActor(req, body.tenant_id);

    if (!apiKey) {
      const cookieStore = await cookies();
      const supabase = createSupabaseServerClient(cookieStore, requestHostFromRequest(req));
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !(await sessionIsDashboardOperator(admin, user))) {
        throw new HealQueueValidationError(
          "Human arbitration (Big Brain) requires GLOBAL_ADMIN or COMPANY_ADMIN.",
          [{ path: "authorization", message: "Operator role required" }],
          403
        );
      }
    }

    const result = await executeHealQueueHumanArbitration({ admin, entityId, body });
    const payload = arbitrationPayload(result);

    return healJson(req, payload);
  } catch (e) {
    if (e instanceof HealQueueValidationError) {
      return healJson(
        req,
        { ok: false, error: e.code, message: e.message, issues: e.issues },
        { status: e.status }
      );
    }
    if (e instanceof MsgfAdminAuthError) {
      return healJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "human-arbitration POST failed";
    console.error("[heal-queue/human-arbitration] POST", e);
    return healJson(req, { ok: false, error: message }, { status: 500 });
  }
}
