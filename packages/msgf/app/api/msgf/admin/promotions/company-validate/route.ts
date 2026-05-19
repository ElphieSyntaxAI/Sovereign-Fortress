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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveDashboardOperator } from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { markLocalStateCacheCompanyValidated } from "@/lib/services/local-state-cache";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

const bodySchema = z.object({
  cache_id: z.string().uuid(),
  tenant_id: z.string().min(1),
});

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * POST /api/msgf/admin/promotions/company-validate
 * COMPANY_ADMIN: validates a LogicDelta so it can appear on the global vault promotion queue.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role !== "COMPANY_ADMIN") {
      return adminJson(
        req,
        { ok: false, error: "Only company admins can validate LogicDeltas for global promotion." },
        { status: 403 }
      );
    }
    if (!op.companyId) {
      return adminJson(
        req,
        { ok: false, error: "Company admin requires company_id on p4_profiles." },
        { status: 403 }
      );
    }
    if (!op.operatorUserId) {
      return adminJson(
        req,
        { ok: false, error: "MSGF-Operator-User-Id header is required." },
        { status: 400 }
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await markLocalStateCacheCompanyValidated(admin, {
      cacheId: parsed.data.cache_id,
      tenantId: parsed.data.tenant_id,
      companyId: op.companyId,
      validatorActorId: op.operatorUserId,
    });

    return adminJson(req, { ok: true, validated: true });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Validation failed.";
    console.error("[admin/promotions/company-validate] POST", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
