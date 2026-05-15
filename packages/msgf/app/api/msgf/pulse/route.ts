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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { assertServiceAccountPresent } from "@/lib/msgf-vertex";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import { resolveCreditGuardGeminiModelId } from "@/lib/creditGuard";
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

function pulseJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyPulseCorsHeaders(req, res);
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
  try {
    assertServiceAccountPresent();
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
        return pulseJson(
          req,
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
          return pulseJson(req, e.body, { status: e.status });
        }
        throw e;
      }
    } else if (adminTiebreak) {
      try {
        const op = await resolveDashboardOperator(req, adminSupabase);
        if (op.role === "DEVELOPER") {
          return pulseJson(
            req,
            { error: "Pulse admin tie-break requires company or global operator." },
            { status: 403 }
          );
        }
        entityId = req.headers.get("x-msgf-act-as-user")!.trim();
        await assertOperatorMayActAsEntity(adminSupabase, op, entityId);
      } catch (e) {
        if (e instanceof MsgfAdminAuthError) {
          return pulseJson(req, { error: e.message }, { status: e.status });
        }
        if (e instanceof MsgfOperatorGateError) {
          return pulseJson(req, { error: e.message }, { status: e.status });
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
        return pulseJson(req, { error: "Unauthorized" }, { status: 401 });
      }
      entityId = user.id;
      userMetadata = user.user_metadata as Record<string, unknown>;

      try {
        license = await assertPulseLicense({ adminSupabase, request: req });
      } catch (e) {
        if (e instanceof PulseHttpError) {
          return pulseJson(req, e.body, { status: e.status });
        }
        throw e;
      }
    }

    const headerTenant = req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();
    const tenantId = resolveTenantIdForPillars(
      headerTenant || license.tenantId,
      userMetadata
    );

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
        rawBody: await req.json(),
        geminiModelId,
        forceLomMismatch: forceMismatch,
        lomHarnessEnabled: lomTestHarnessEnabled(),
        license,
        logicDriftEscalationThreshold,
      });
    } catch (e) {
      if (e instanceof PulseHttpError) {
        return pulseJson(req, e.body, { status: e.status });
      }
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
      return pulseJson(req, pipelineResult.public, { status: 202 });
    }

    void insertPulseAdminVaultForensic({
      adminSupabase,
      tenantId,
      entityId,
      kind: "pulse_forensic",
      payload: pipelineResult.forensic,
    });

    return pulseJson(req, pipelineResult.public);
  } catch (err: unknown) {
    console.error("MSGF Pulse route error", err);
    return pulseJson(req, { error: "Unexpected MSGF Pulse error." }, { status: 500 });
  }
}
