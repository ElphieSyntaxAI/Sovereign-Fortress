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
 * Distribution Build ID: MSGF-2d8d295-20260516T002421Z-internal
 */
import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { assertServiceAccountPresent } from "@/lib/msgf-vertex";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import { resolveCreditGuardGeminiModelId } from "@/lib/creditGuard";
import {
  endTenantCreditReservation,
  startTenantCreditReservation,
} from "@/lib/credit-reservation";
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
} from "@/lib/msgf-http-headers";
import { resolveTenantIdForPillars } from "@/lib/services/msgf-metadata-scope";
import { runWithPulseTrace } from "@/lib/runtime/pulse-trace-context";

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
          license = await assertPulseLicense({ adminSupabase, request: req });
        } catch (e) {
          if (e instanceof PulseHttpError) {
            return pulseJsonWithTrace(req, traceId, e.body, { status: e.status });
          }
          throw e;
        }
      }

      const headerTenant = req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();
      const tenantId = resolveTenantIdForPillars(
        headerTenant || license.tenantId,
        userMetadata
      );

      const idempotencyKey =
        req.headers.get("Idempotency-Key")?.trim() ||
        req.headers.get("x-msgf-idempotency-key")?.trim() ||
        traceId;

      const creditStart = await startTenantCreditReservation(
        adminSupabase,
        tenantId,
        idempotencyKey
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

      let pipelineResult;
      try {
        pipelineResult = await pulseEngine.runFullPipeline({
          supabase,
          adminSupabase,
          entityId,
          tenantId,
          traceId,
          rawBody: await req.json(),
          geminiModelId,
          forceLomMismatch: forceMismatch,
          lomHarnessEnabled: lomTestHarnessEnabled(),
          license,
          logicDriftEscalationThreshold,
        });
      } catch (e) {
        if (e instanceof PulseHttpError) {
          await endTenantCreditReservation(adminSupabase, creditStart, e.status);
          return pulseJsonWithTrace(req, traceId, e.body, { status: e.status });
        }
        await endTenantCreditReservation(adminSupabase, creditStart, 500);
        throw e;
      }

      if (pipelineResult.kind === "baseline_required") {
        void insertPulseAdminVaultForensic({
          adminSupabase,
          tenantId,
          entityId,
          kind: "pulse_baseline_required",
          payload: pipelineResult.forensic,
        });
        const res202 = pulseJsonWithTrace(req, traceId, pipelineResult.public, { status: 202 });
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

      const res200 = pulseJsonWithTrace(req, traceId, pipelineResult.public);
      await endTenantCreditReservation(adminSupabase, creditStart, res200.status);
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
