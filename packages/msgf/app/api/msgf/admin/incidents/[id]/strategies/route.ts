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
import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import {
  assertOperatorCanAccessIncident,
  MsgfOperatorGateError,
  resolveDashboardOperator,
} from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { GenealogicalBugIndexSchema } from "@/lib/schemas/vault-hall-metadata";
import {
  remediationEngine,
  toAdminIncidentStrategyDto,
} from "@/lib/services/RemediationEngine";
import { getMsgfIncidentById } from "@/lib/services/msgf-incidents";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * GET /api/msgf/admin/incidents/:id/strategies
 * Resolves remediation strategies from the incident `bug_index` via {@link RemediationEngine}.
 * Requires service-role Bearer (same as other admin routes).
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role === "DEVELOPER") {
      return adminJson(
        req,
        { ok: false, error: "Developers cannot load admin remediation strategies." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const incidentId = id?.trim();
    if (!incidentId) {
      return adminJson(req, { ok: false, error: "Incident id required." }, { status: 400 });
    }

    const incident = await getMsgfIncidentById({ adminSupabase: admin, id: incidentId });

    if (!incident) {
      return adminJson(req, { ok: false, error: "Incident not found." }, { status: 404 });
    }

    await assertOperatorCanAccessIncident(admin, op, incident);

    const bugIndex = GenealogicalBugIndexSchema.parse(incident.bug_index);
    const matrixStrategies = remediationEngine.getStrategiesForIncident(
      bugIndex.level_1_1_1_instance
    );

    const strategies = matrixStrategies.map(toAdminIncidentStrategyDto);

    return adminJson(req, {
      incidentId,
      strategies,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    if (e instanceof MsgfOperatorGateError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to load incident strategies.";
    console.error("[admin/incidents/:id/strategies] GET", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
