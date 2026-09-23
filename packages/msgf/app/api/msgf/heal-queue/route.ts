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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * GET  /api/msgf/heal-queue?tenant_id=<silo|uuid> — list remediation_tasks (brain + pillar_vectors)
 * POST /api/msgf/heal-queue — BULK | INDIVIDUAL | SCHEDULED remediation actions
 */

import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import {
  isTenantApiKeyConfigured,
  resolveTenantIdFromApiKey,
} from "@/lib/api-key-tenant";
import { logIdentityViolation } from "@/lib/identity-violation-log";
import { MSGF_ENTITY_ID_HEADER, MSGF_TENANT_KEY_HEADER } from "@/lib/msgf-http-headers";
import {
  assertPulseLicense,
  extractLicenseKeyFromRequest,
} from "@/lib/services/pulse-license";
import { PulseHttpError } from "@/lib/services/pulse-http-error";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  HealQueueGetResponseSchema,
  HealQueueValidationError,
  parseHealQueueTenantQuery,
  parseIngestRemediationAction,
} from "@/lib/schemas/heal-queue";
import { applyHealQueueAudienceScope } from "@/lib/services/heal-queue-audience";
import {
  endTenantCreditReservation,
  resolveHealCreditReserveAmount,
  shouldReserveForHealAction,
  startTenantCreditReservation,
} from "@/lib/credit-reservation";
import { fetchDevHandoffForTenant } from "@/lib/services/dev-handoff-service";
import { verifyIdeToken } from "@/lib/services/ide-token-service";
import { recordSavingsFeatureCount } from "@/lib/services/savings-features-stats";
import {
  executeHealQueueRemediation,
  listHealQueueRemediationTasks,
} from "@/lib/services/heal-queue-service";
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

  const contractLicense = extractLicenseKeyFromRequest(req);
  if (contractLicense?.startsWith("msgf_live_")) {
    try {
      const license = await assertPulseLicense({ adminSupabase: admin, request: req });
      if (license.tenantId.trim() !== tenantId.trim()) {
        await logIdentityViolation({
          source: "heal_queue_api",
          reason: "license_tenant_mismatch",
          claimed_tenant_id: tenantId,
          resolved_tenant_id: license.tenantId,
        });
        throw new HealQueueValidationError(
          "Identity violation: tenant_id does not match contract license.",
          [{ path: "tenant_id", message: "License tenant mismatch" }],
          403
        );
      }
      const entityId =
        req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() ||
        process.env.MSGF_SOLO_ENTITY_ID?.trim() ||
        tenantId;
      return { admin, entityId };
    } catch (e) {
      if (e instanceof HealQueueValidationError) throw e;
      if (e instanceof PulseHttpError) {
        throw new HealQueueValidationError(
          e.message,
          [{ path: "authorization", message: String(e.body.error ?? e.message) }],
          e.status
        );
      }
      throw e;
    }
  }

  const apiKey = getApiKey(req);
  if (apiKey?.startsWith("msgf_ide_")) {
    const tenantKeyForVerify =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() || tenantId;
    const verified = await verifyIdeToken(admin, apiKey, tenantKeyForVerify);
    if (!verified) {
      throw new HealQueueValidationError(
        "Invalid or expired IDE token.",
        [{ path: "authorization", message: "msgf_ide_* rejected" }],
        401
      );
    }
    return { admin, entityId: verified.user_id };
  }

  if (isTenantApiKeyConfigured() && apiKey) {
    const resolved = resolveTenantIdFromApiKey(apiKey);
    if (!resolved || resolved !== tenantId) {
      await logIdentityViolation({
        source: "heal_queue_api",
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

  try {
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
  } catch (e) {
    if (e instanceof HealQueueValidationError) throw e;
    throw new HealQueueValidationError(
      "Unauthorized.",
      [{ path: "authorization", message: "Auth failed" }],
      401
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function GET(req: NextRequest) {
  try {
    const { tenant_id: tenantId } = parseHealQueueTenantQuery(
      req.nextUrl.searchParams.get("tenant_id")
    );
    const { admin, entityId } = await resolveHealQueueActor(req, tenantId);

    const { brain_readiness, remediation_tasks, human_arbitration_packages, heal_token_summary } =
      await listHealQueueRemediationTasks(admin, tenantId, entityId);
    const dev_handoff = await fetchDevHandoffForTenant(admin, tenantId);

    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore, requestHostFromRequest(req));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isOperator =
      user != null ? await sessionIsDashboardOperator(admin, user) : false;

    const base = HealQueueGetResponseSchema.parse({
      ok: true,
      tenant_id: tenantId,
      brain_readiness: {
        readiness_score: brain_readiness.readiness_score,
        missing_pillars: brain_readiness.missing_pillars,
        baseline_training_required: brain_readiness.baseline_training_required,
        baseline_training_remaining: brain_readiness.baseline_training_remaining,
        is_pillar_baseline_set: brain_readiness.is_pillar_baseline_set,
        brain_fully_initialized: brain_readiness.brain_fully_initialized,
      },
      remediation_tasks,
      human_arbitration_packages,
      heal_token_summary,
      dev_handoff,
    });

    const payload = applyHealQueueAudienceScope(base, isOperator ? "admin" : "user");

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
    const message = e instanceof Error ? e.message : "heal-queue GET failed";
    console.error("[heal-queue] GET", e);
    return healJson(req, { ok: false, error: message }, { status: 500 });
  }
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

    const body = parseIngestRemediationAction(raw);
    const { admin, entityId } = await resolveHealQueueActor(req, body.tenant_id);
    const tenantKey =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get("x-msgf-tenant-id")?.trim() ||
      null;

    const taskCount = body.file_paths?.length ?? 0;
    let creditStart: Awaited<ReturnType<typeof startTenantCreditReservation>> = {
      enabled: false,
    };

    if (shouldReserveForHealAction(body.action_type)) {
      const amount = resolveHealCreditReserveAmount({
        action_type: body.action_type,
        taskCount: taskCount || undefined,
      });
      creditStart = await startTenantCreditReservation(
        admin,
        body.tenant_id,
        `heal:${body.action_type}:${body.tenant_id}:${randomUUID()}`,
        amount
      );
      if (creditStart.enabled && creditStart.insufficient) {
        void recordSavingsFeatureCount(body.tenant_id, "credit_reserve_denied");
        return healJson(
          req,
          {
            ok: false,
            error: "INSUFFICIENT_CREDITS",
            message:
              "Insufficient token credits for cloud heal. Use Fix Myself (0-token context pack) or add credits.",
          },
          { status: 402 }
        );
      }
      if (creditStart.enabled && !creditStart.insufficient) {
        void recordSavingsFeatureCount(body.tenant_id, "credit_reserve_ok");
      }
    }

    try {
      const result = await executeHealQueueRemediation({
        admin,
        entityId,
        body,
        tenantKey,
      });
      if (creditStart.enabled && !creditStart.insufficient) {
        await endTenantCreditReservation(admin, creditStart, 200);
      }
      return healJson(req, result);
    } catch (healError) {
      if (creditStart.enabled && !creditStart.insufficient) {
        await endTenantCreditReservation(admin, creditStart, 500);
      }
      throw healError;
    }
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
    const message = e instanceof Error ? e.message : "heal-queue POST failed";
    console.error("[heal-queue] POST", e);
    return healJson(req, { ok: false, error: message }, { status: 500 });
  }
}
