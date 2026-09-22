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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * GET /api/msgf/admin/prompt-sessions/search — Session Replay + harm filter.
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { listUserIdsForCompany } from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { searchPromptSessions } from "@/lib/services/prompt-sessions";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

async function companyTenantAllowlist(
  admin: SupabaseClient,
  companyId: string
): Promise<string[]> {
  const memberIds = await listUserIdsForCompany(admin, companyId);
  const tenants = new Set<string>([companyId.trim()]);
  for (const id of memberIds) if (id) tenants.add(id);
  if (memberIds.length > 0) {
    const { data } = await admin
      .from("p4_profiles")
      .select("user_id, tenant_id")
      .in("user_id", memberIds);
    for (const row of data ?? []) {
      if (typeof row.tenant_id === "string" && row.tenant_id.trim()) {
        tenants.add(row.tenant_id.trim());
      }
    }
  }
  return [...tenants];
}

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveOperatorForAdminRequest(req, admin);
    if (op.role === "DEVELOPER") {
      return adminJson(req, { ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (op.role === "COMPANY_ADMIN" && !op.companyId) {
      return adminJson(req, { ok: false, error: "Company scope required" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const requestedTenant = sp.get("tenant_id")?.trim() || "";
    const isGlobal = op.role === "GLOBAL_ADMIN";
    const harmOnly =
      sp.get("harm_only") === "1" || sp.get("harm_only") === "true";

    let tenant_id: string | null = requestedTenant || null;
    let company_id: string | null = isGlobal
      ? sp.get("company_id")?.trim() || null
      : op.companyId;

    if (!isGlobal && op.companyId) {
      const allow = await companyTenantAllowlist(admin, op.companyId);
      if (requestedTenant && !allow.includes(requestedTenant)) {
        return adminJson(req, { ok: false, error: "Forbidden tenant scope" }, { status: 403 });
      }
      company_id = op.companyId;
      if (!tenant_id && allow.length === 1) tenant_id = allow[0] ?? null;
    }

    let sessions = await searchPromptSessions(admin, {
      tenant_id,
      company_id: isGlobal ? company_id : op.companyId,
      cross_tenant: isGlobal && !tenant_id,
      q: sp.get("q"),
      harm_only: harmOnly,
      product: sp.get("product"),
      model_id: sp.get("model_id"),
      trace_id: sp.get("trace_id"),
      limit: Number(sp.get("limit") || 25) || 25,
    });

    const projectOrigin = sp.get("project_origin")?.trim();
    if (projectOrigin) {
      sessions = sessions.filter((s) => s.project_origin === projectOrigin);
    }

    if (!isGlobal && op.companyId) {
      const allow = await companyTenantAllowlist(admin, op.companyId);
      sessions = sessions.filter((s) => {
        const tid = String(s.tenant_id ?? "");
        const cid = String(s.company_id ?? "");
        return allow.includes(tid) || cid === op.companyId;
      });
    }

    return adminJson(req, {
      ok: true,
      scope: isGlobal ? "global" : "company",
      harm_only: harmOnly,
      sessions,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    return adminJson(
      req,
      { ok: false, error: e instanceof Error ? e.message : "prompt-sessions search failed" },
      { status: 500 }
    );
  }
}
