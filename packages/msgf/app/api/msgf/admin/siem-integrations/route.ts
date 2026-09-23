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
 * PUT /api/msgf/admin/siem-integrations — configure SIEM webhook.
 */

import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  assertPlanFeature,
  resolveCommercialPlanForUser,
} from "@/lib/billing/plan-entitlements";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function PUT(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveOperatorForAdminRequest(req, admin);
    if (op.role === "DEVELOPER") {
      return adminJson(req, { ok: false, error: "Forbidden" }, { status: 403 });
    }

    if (op.operatorUserId) {
      const plan = await resolveCommercialPlanForUser(admin, op.operatorUserId);
      const gate = assertPlanFeature(plan, "siem_export");
      if (!gate.ok) {
        return adminJson(req, gate, { status: gate.status });
      }
    }

    const body = (await req.json()) as {
      tenant_id?: string;
      webhook_url?: string;
      auth_secret?: string | null;
      enabled?: boolean;
    };

    const tenantId =
      (op.role === "COMPANY_ADMIN" ? op.companyId : body.tenant_id?.trim()) ||
      op.companyId ||
      op.operatorUserId;
    if (!tenantId) {
      return adminJson(req, { ok: false, error: "tenant_id required" }, { status: 400 });
    }
    if (op.role === "COMPANY_ADMIN" && body.tenant_id && body.tenant_id !== op.companyId) {
      return adminJson(req, { ok: false, error: "Forbidden tenant scope" }, { status: 403 });
    }

    const url = body.webhook_url?.trim();
    if (!url) {
      return adminJson(req, { ok: false, error: "webhook_url required" }, { status: 400 });
    }

    const { error } = await admin.from("msgf_siem_integrations").upsert(
      {
        tenant_id: tenantId,
        webhook_url: url,
        auth_secret_encrypted: body.auth_secret?.trim() || null,
        enabled: body.enabled !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );
    if (error) {
      return adminJson(req, { ok: false, error: error.message }, { status: 500 });
    }

    return adminJson(req, { ok: true, tenant_id: tenantId });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    return adminJson(
      req,
      { ok: false, error: e instanceof Error ? e.message : "siem save failed" },
      { status: 500 }
    );
  }
}
