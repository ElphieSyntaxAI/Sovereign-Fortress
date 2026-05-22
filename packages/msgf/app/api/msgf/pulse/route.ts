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
 * Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
 */
import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { assertServiceAccountPresent } from "@/lib/msgf-vertex";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import { resolveCreditGuardGeminiModelId } from "@/lib/creditGuard";
import {
  endTenantCreditReservation,
  resolvePulseCreditReserveAmount,
  startTenantCreditReservation,
} from "@/lib/credit-reservation";
import { incrementUsageMonitorTokens } from "@/lib/usage-monitor";
import {
  getPulseIdempotencyCache,
  setPulseIdempotencyCache,
} from "@/lib/services/pulse-idempotency";
import { estimatePulseRoutingTokenSavings } from "@/lib/services/pulse-eco-savings";
import { insertPulseAdminVaultForensic } from "@/lib/services/pulse-admin-vault";
import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import {
  assertOperatorMayActAsEntity,
  MsgfOperatorGateError,
  resolveDashboardOperator,
} from "@/lib/msgf-operator-access";
import { lomTestHarnessEnabled, pulseEngine } from "@/lib/services/PulseEngine";
import { PulseHttpError } from "@/lib/services/pulse-http-error";
import { assertPulseLicense, type PulseLicenseContext } from "@/lib/services/pulse-license";
import { parseLogicDriftThresholdFromHeaders } from "@/lib/services/logic-drift";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_IDE_PULSE_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
  MSGF_ALLOWANCE_STATE_HEADER,
  MSGF_AUTHOR_HAL_HEADER,
} from "@/lib/msgf-http-headers";
import { parseAuthorHalTelemetryHeader } from "@/lib/hal-author-telemetry";
import { resolveTenantIdForPillars } from "@/lib/services/msgf-metadata-scope";
import { extractPulseByokFromRequest } from "@/lib/services/pulse-byok-from-request";
import { runWithPulseTrace } from "@/lib/runtime/pulse-trace-context";
import {
  peekPulseTextSeed,
  preparePulseHotLayer,
  pulseHotLayerDiagnostics,
  type PulseHotSession,
} from "@/lib/services/pulse-hot-session";
import {
  inferV32FromPulseForensic,
  isRedisRequiredForPulse,
} from "@/lib/v32-ultra-directive";

function pulseJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyPulseCorsHeaders(req, res);
}

function pulseJsonWithTrace(
  req: NextRequest,
  traceId: string,
  data: unknown,
  init?: ResponseInit
) {
  const body =
    data !== null && typeof data === "object" && !Array.isArray(data)
      ? { ...(data as Record<string, unknown>), trace_id: traceId }
      : data;
  return pulseJson(req, body, init);
}

function isAdminTiebreakRequest(req: NextRequest): boolean {
  return (
    req.headers.get("x-msgf-admin-tiebreak")?.trim() === "1" &&
    Boolean(req.headers.get("x-msgf-act-as-user")?.trim())
  );
}

function isIdePulseRequest(req: NextRequest): boolean {
  return req.headers.get(MSGF_IDE_PULSE_HEADER)?.trim() === "1";
}

async function runPulsePipelineWithHotLayer(params: {
  hotSession: PulseHotSession;
  supabase: SupabaseClient;
  adminSupabase: SupabaseClient;
  entityId: string;
  tenantId: string;
  traceId: string;
  rawBody: unknown;
  geminiModelId: string;
  forceLomMismatch: boolean;
  lomHarnessEnabled: boolean;
  license: PulseLicenseContext;
  logicDriftEscalationThreshold: number | undefined;
  byokGeminiKey: string | null;
  byokAnthropicKey: string | null;
  isIdePulse?: boolean;
  authorHalTelemetry?: ReturnType<typeof parseAuthorHalTelemetryHeader>;
}) {
  return pulseEngine.runFullPipeline({
    supabase: params.supabase,
    adminSupabase: params.adminSupabase,
    entityId: params.entityId,
    tenantId: params.tenantId,
    traceId: params.traceId,
    rawBody: params.rawBody,
    authorHalTelemetry: params.authorHalTelemetry ?? null,
    geminiModelId: params.geminiModelId,
    forceLomMismatch: params.forceLomMismatch,
    lomHarnessEnabled: params.lomHarnessEnabled,
    license: params.license,
    logicDriftEscalationThreshold: params.logicDriftEscalationThreshold,
    hotSession: params.hotSession,
    byokGeminiKey: params.byokGeminiKey,
    byokAnthropicKey: params.byokAnthropicKey,
    isIdePulse: params.isIdePulse,
  });
}

export async function OPTIONS(req: NextRequest) {
  return pulseCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    assertServiceAccountPresent();

    const gcpTraceHeader = req.headers.get("X-Cloud-Trace-Context")?.trim() || undefined;

    return await runWithPulseTrace({ traceId, gcpTraceHeader }, async () => {
      const geminiModelId = resolveCreditGuardGeminiModelId(req);
      const idePulse = isIdePulseRequest(req);
      const adminTiebreak = !idePulse && isAdminTiebreakRequest(req);
      const adminSupabase = createAdminClient();

      let entityId: string;
      let userMetadata: Record<string, unknown> | undefined;
      let supabase;
      let license: PulseLicenseContext;

      if (idePulse) {
        const ideEntityId = req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim();
        if (!ideEntityId) {
          return pulseJsonWithTrace(
            req,
            traceId,
            { error: "x-msgf-entity-id is required for IDE pulse." },
            { status: 400 }
          );
        }
        entityId = ideEntityId;
        supabase = adminSupabase;
        try {
          license = await assertPulseLicense({ adminSupabase, request: req });
        } catch (e) {
          if (e instanceof PulseHttpError) {
            return pulseJsonWithTrace(req, traceId, e.body, { status: e.status });
          }
          throw e;
        }
      } else if (adminTiebreak) {
        try {
          const op = await resolveDashboardOperator(req, adminSupabase);
          if (op.role === "DEVELOPER") {
            return pulseJsonWithTrace(
              req,
              traceId,
              { error: "Pulse admin tie-break requires company or global operator." },
              { status: 403 }
            );
          }
          entityId = req.headers.get("x-msgf-act-as-user")!.trim();
          await assertOperatorMayActAsEntity(adminSupabase, op, entityId);
        } catch (e) {
          if (e instanceof MsgfAdminAuthError) {
            return pulseJsonWithTrace(req, traceId, { error: e.message }, { status: e.status });
          }
          if (e instanceof MsgfOperatorGateError) {
            return pulseJsonWithTrace(req, traceId, { error: e.message }, { status: e.status });
          }
          throw e;
        }
        supabase = adminSupabase;
        license = {
          licenseId: "admin-tiebreak",
          tenantId: process.env.MSGF_PULSE_LICENSE_TENANT?.trim() || "author_ecosystem",
          tierId: process.env.MSGF_PULSE_LICENSE_TIER?.trim() || "brain_contract",
        };
      } else {
        const cookieStore = await cookies();
        supabase = createSupabaseServerClient(cookieStore);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          return pulseJsonWithTrace(req, traceId, { error: "Unauthorized" }, { status: 401 });
        }
        entityId = user.id;
        userMetadata = user.user_metadata as Record<string, unknown>;

        try {
          license = await assertPulseLicense({
            adminSupabase,
            request: req,
            sessionEntityId: entityId,
          });
        } catch (e) {
          if (e instanceof PulseHttpError) {
            return pulseJsonWithTrace(req, traceId, e.body, { status: e.status });
          }
          throw e;
        }
      }

      const headerTenant =
        req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
        req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();
      const tenantId = resolveTenantIdForPillars(
        headerTenant || license.tenantId,
        userMetadata
      );

      const idempotencyKey =
        req.headers.get("Idempotency-Key")?.trim() ||
        req.headers.get("x-msgf-idempotency-key")?.trim() ||
        traceId;

      const authorHalTelemetry = parseAuthorHalTelemetryHeader(
        req.headers.get(MSGF_AUTHOR_HAL_HEADER)
      );

      const cached = await getPulseIdempotencyCache({
        tenantId,
        entityId,
        idempotencyKey,
      });
      if (cached) {
        const cachedRes = pulseJsonWithTrace(req, traceId, cached.body, {
          status: cached.status,
        });
        cachedRes.headers.set("x-msgf-pulse-idempotent-replay", "1");
        return cachedRes;
      }

      const reserveAmount = resolvePulseCreditReserveAmount({
        authorHalPresent: Boolean(authorHalTelemetry),
        idePulse,
      });

      const creditStart = await startTenantCreditReservation(
        adminSupabase,
        tenantId,
        idempotencyKey,
        reserveAmount
      );
      if (creditStart.enabled && creditStart.insufficient) {
        return pulseJsonWithTrace(
          req,
          traceId,
          { error: "INSUFFICIENT_FUNDS" },
          { status: 402 }
        );
      }

      const forceMismatch =
        req.headers.get("x-msgf-test-force-mismatch")?.toLowerCase() === "true";
      const logicDriftEscalationThreshold = parseLogicDriftThresholdFromHeaders(req.headers);

      const rawBody = await req.json();
      const pulseTextSeed = peekPulseTextSeed(rawBody);

      const { session: hotSession, rateLimitExceeded } = await preparePulseHotLayer({
        traceId,
        tenantId,
        entityId,
        pulseTextSeed,
      });

      if (rateLimitExceeded) {
        await hotSession.release();
        return pulseJsonWithTrace(
          req,
          traceId,
          {
            error: "RATE_LIMIT_EXCEEDED",
            hot_layer: pulseHotLayerDiagnostics(hotSession),
          },
          { status: 429 }
        );
      }

      if (isRedisRequiredForPulse() && hotSession.mode !== "hot") {
        await hotSession.release();
        return pulseJsonWithTrace(
          req,
          traceId,
          {
            error: "REDIS_REQUIRED",
            detail:
              "MSGF_REQUIRE_REDIS is set but the hot layer is unavailable. Configure UPSTASH_REDIS_REST_* or REDIS_HOST or REDIS_URL.",
            hot_layer: pulseHotLayerDiagnostics(hotSession),
          },
          { status: 503 }
        );
      }

      const byok = extractPulseByokFromRequest(req);

      let pipelineResult;
      try {
        pipelineResult = await runPulsePipelineWithHotLayer({
          hotSession,
          supabase,
          adminSupabase,
          entityId,
          tenantId,
          traceId,
          rawBody,
          authorHalTelemetry,
          geminiModelId,
          forceLomMismatch: forceMismatch,
          lomHarnessEnabled: lomTestHarnessEnabled(),
          license,
          logicDriftEscalationThreshold,
          byokGeminiKey: byok.gemini,
          byokAnthropicKey: byok.anthropic,
          isIdePulse: idePulse,
        });
      } catch (e) {
        if (e instanceof PulseHttpError) {
          await endTenantCreditReservation(adminSupabase, creditStart, e.status);
          return pulseJsonWithTrace(req, traceId, e.body, { status: e.status });
        }
        await endTenantCreditReservation(adminSupabase, creditStart, 500);
        throw e;
      } finally {
        await hotSession.release();
      }

      const withHotLayer = (
        payload: Record<string, unknown>,
        result: typeof pipelineResult
      ) => {
        const forensic =
          result.kind === "ok" || result.kind === "baseline_required"
            ? (result.forensic as Record<string, unknown>)
            : undefined;
        const v32_directive = inferV32FromPulseForensic(forensic, hotSession);
        return {
          ...payload,
          hot_layer: pulseHotLayerDiagnostics(hotSession),
          ...(v32_directive ? { v32_directive } : {}),
        };
      };

      if (pipelineResult.kind === "baseline_required") {
        void insertPulseAdminVaultForensic({
          adminSupabase,
          tenantId,
          entityId,
          kind: "pulse_baseline_required",
          payload: pipelineResult.forensic,
        });
        const res202 = pulseJsonWithTrace(
          req,
          traceId,
          withHotLayer(pipelineResult.public as Record<string, unknown>, pipelineResult),
          { status: 202 }
        );
        await endTenantCreditReservation(adminSupabase, creditStart, res202.status);
        return res202;
      }

      void insertPulseAdminVaultForensic({
        adminSupabase,
        tenantId,
        entityId,
        kind: "pulse_forensic",
        payload: pipelineResult.forensic,
      });

      const publicPayload = withHotLayer(
        pipelineResult.public as Record<string, unknown>,
        pipelineResult
      ) as Record<string, unknown>;

      const routing =
        typeof publicPayload.routing === "string" ? publicPayload.routing : "unknown";
      const savings = estimatePulseRoutingTokenSavings({
        routing,
        contentChars: pulseTextSeed.length,
        authorHalTrusted: Boolean(authorHalTelemetry),
      });
      publicPayload.token_usage_estimate = {
        without_msgf: savings.without_msgf,
        with_msgf: savings.with_msgf,
        tokens_saved: savings.tokens_saved,
        savings_pct: savings.savings_pct,
      };

      const res200 = pulseJsonWithTrace(req, traceId, publicPayload);
      const allowance = publicPayload.x_msgf_allowance_state;
      if (typeof allowance === "string" && allowance.trim()) {
        res200.headers.set(MSGF_ALLOWANCE_STATE_HEADER, allowance.trim());
      }
      await endTenantCreditReservation(adminSupabase, creditStart, res200.status);
      void incrementUsageMonitorTokens(entityId, savings.with_msgf);
      void setPulseIdempotencyCache({
        tenantId,
        entityId,
        idempotencyKey,
        status: 200,
        body: publicPayload,
      });
      return res200;
    });
  } catch (err: unknown) {
    console.error("MSGF Pulse route error", err);
    return pulseJsonWithTrace(
      req,
      traceId,
      { error: "Unexpected MSGF Pulse error." },
      { status: 500 }
    );
  }
}
