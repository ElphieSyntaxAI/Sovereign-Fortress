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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
 */
import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import {
  assertOperatorMayActAsEntity,
  MsgfOperatorGateError,
  resolveDashboardOperator,
} from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { SelfHealReportBodySchema } from "@/lib/schemas/diagnostic-snapshot";
import { persistSelfHealReport } from "@/lib/services/self-heal-report";
import { buildTenantSentinelSelfHealBody } from "@/lib/services/tenant-sentinel-response";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * POST /api/msgf/admin/self-heal/report
 * Full {@link DiagnosticSnapshot} from Sentinel / Report Issue FAB (admin or BFF proxy).
 *
 * Optional header `x-msgf-act-as-user` when using service-role Bearer.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    const actAsUser = req.headers.get("x-msgf-act-as-user")?.trim();
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = SelfHealReportBodySchema.safeParse(json);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const entityId = parsed.data.entity_id ?? parsed.data.author_id ?? actAsUser;
    if (!entityId) {
      return adminJson(
        req,
        { ok: false, error: "entity_id required (body or x-msgf-act-as-user header)." },
        { status: 400 }
      );
    }

    await assertOperatorMayActAsEntity(admin, op, entityId);

    const tenantId = parsed.data.tenant_id?.trim() || entityId;

    const result = await persistSelfHealReport({
      adminSupabase: admin,
      body: parsed.data,
      entityId,
      tenantId,
    });

    /** Tenant / Sentinel — no raw LOM output or remediation DTOs. */
    return adminJson(req, buildTenantSentinelSelfHealBody(result));
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    if (e instanceof MsgfOperatorGateError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Self-heal report failed.";
    console.error("[admin/self-heal/report] POST", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
