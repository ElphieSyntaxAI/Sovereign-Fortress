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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * GET /api/msgf/admin/audit-hub — searchable unified audit timeline.
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { listUserIdsForCompany } from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { searchPlatformAudit } from "@/lib/services/emit-platform-audit";
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
      if (typeof row.user_id === "string" && row.user_id.trim()) {
        tenants.add(row.user_id.trim());
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

    let tenant_id: string | null = requestedTenant || null;
    let company_id: string | null = isGlobal
      ? sp.get("company_id")?.trim() || null
      : op.companyId;

    if (!isGlobal && op.companyId) {
      const allow = await companyTenantAllowlist(admin, op.companyId);
      if (requestedTenant && !allow.includes(requestedTenant)) {
        return adminJson(req, { ok: false, error: "Forbidden tenant scope" }, { status: 403 });
      }
      if (!tenant_id && allow.length === 1) tenant_id = allow[0] ?? null;
      // Force company scope; search filters by company_id when set
      company_id = op.companyId;
    }

    const events = await searchPlatformAudit(admin, {
      tenant_id,
      company_id: isGlobal ? company_id : op.companyId,
      cross_tenant: isGlobal && !tenant_id && !company_id,
      kind: sp.get("kind"),
      severity: sp.get("severity"),
      product: sp.get("product"),
      trace_id: sp.get("trace_id"),
      q: sp.get("q"),
      before: sp.get("before"),
      limit: Number(sp.get("limit") || 40) || 40,
    });

    // Extra COMPANY_ADMIN filter: only allowlisted tenants
    let filtered = events;
    if (!isGlobal && op.companyId) {
      const allow = await companyTenantAllowlist(admin, op.companyId);
      filtered = events.filter((e) => {
        const tid = String(e.tenant_id ?? "");
        const cid = String(e.company_id ?? "");
        return allow.includes(tid) || cid === op.companyId;
      });
    }

    const projectOrigin = sp.get("project_origin")?.trim();
    if (projectOrigin) {
      filtered = filtered.filter((e) => {
        const meta = (e.metadata ?? {}) as Record<string, unknown>;
        return meta.project_origin === projectOrigin;
      });
    }

    const p7 = sp.get("p7")?.trim().toLowerCase();
    if (p7 === "promoted" || p7 === "blocked") {
      const field = p7 === "promoted" ? "promoted_keys" : "blocked_keys";
      filtered = filtered.filter((e) => {
        const meta = (e.metadata ?? {}) as Record<string, unknown>;
        return Array.isArray(meta[field]) && (meta[field] as unknown[]).length > 0;
      });
    }

    return adminJson(req, {
      ok: true,
      scope: isGlobal ? "global" : "company",
      tenant_id,
      company_id: company_id,
      events: filtered,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    return adminJson(
      req,
      { ok: false, error: e instanceof Error ? e.message : "audit-hub failed" },
      { status: 500 }
    );
  }
}
