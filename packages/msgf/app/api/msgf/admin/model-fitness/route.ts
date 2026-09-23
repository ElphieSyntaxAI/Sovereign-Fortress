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
 * GET /api/msgf/admin/model-fitness — tenant fitness rollups for ops UI.
 */

import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  listModelFitnessRollups,
  preferCheapestFitModel,
} from "@/lib/services/model-fitness";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveOperatorForAdminRequest(req, admin);
    if (op.role === "DEVELOPER") {
      return adminJson(req, { ok: false, error: "Forbidden" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    let tenantId = sp.get("tenant_id")?.trim() || "";
    if (!tenantId && op.companyId) tenantId = op.companyId;
    if (!tenantId) {
      return adminJson(req, { ok: false, error: "tenant_id required" }, { status: 400 });
    }

    if (op.role === "COMPANY_ADMIN") {
      if (!op.companyId) {
        return adminJson(req, { ok: false, error: "Company scope required" }, { status: 403 });
      }
      const selfId = op.operatorUserId?.trim() || "";
      if (tenantId !== op.companyId && tenantId !== selfId) {
        const { data: profile } = await admin
          .from("p4_profiles")
          .select("tenant_id, company_id")
          .eq("user_id", selfId || "00000000-0000-4000-8000-000000000000")
          .maybeSingle();
        const allowed = new Set(
          [op.companyId, selfId, profile?.tenant_id, profile?.company_id]
            .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
            .map((x) => x.trim())
        );
        if (!allowed.has(tenantId)) {
          return adminJson(req, { ok: false, error: "Forbidden tenant scope" }, { status: 403 });
        }
      }
    }

    const promptClass = sp.get("prompt_class");
    const rollups = await listModelFitnessRollups(admin, {
      tenant_id: tenantId,
      prompt_class: promptClass,
      limit: Number(sp.get("limit") || 40) || 40,
    });
    const preferred = await preferCheapestFitModel(admin, {
      tenant_id: tenantId,
      prompt_class: promptClass,
    });

    return adminJson(req, {
      ok: true,
      scope: op.role === "GLOBAL_ADMIN" ? "global" : "company",
      tenant_id: tenantId,
      rollups,
      preferred_cheapest_fit: preferred,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    return adminJson(
      req,
      { ok: false, error: e instanceof Error ? e.message : "model-fitness failed" },
      { status: 500 }
    );
  }
}
