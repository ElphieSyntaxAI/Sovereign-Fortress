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
 * Distribution Build ID: MSGF-81e8259-20260519T153428Z-internal
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertMsgfServiceAdmin } from "@/lib/msgf-admin-auth";
import {
  MSGF_AUTO_PROMOTED_HEADER,
  MSGF_OPERATOR_USER_ID_HEADER,
  MSGF_PERSONAL_SANDBOX_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import {
  allocatePersonalSandboxTenantId,
  isIndependentDeveloper,
} from "@/lib/msgf-tenant-governance";

export { MSGF_OPERATOR_USER_ID_HEADER };

export type MsgfDashboardAccessRole = "GLOBAL_ADMIN" | "COMPANY_ADMIN" | "DEVELOPER";

export type MsgfDashboardView = "tenant_health" | "team_overview";

export type DashboardOperatorContext = {
  role: MsgfDashboardAccessRole;
  companyId: string | null;
  operatorUserId: string | null;
  dashboardView: MsgfDashboardView;
  canPromoteToGlobal: boolean;
};

export class MsgfOperatorGateError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "MsgfOperatorGateError";
    this.status = status;
  }
}

function normalizeRole(raw: string | null | undefined): MsgfDashboardAccessRole {
  const s = raw?.trim().toUpperCase();
  if (s === "GLOBAL_ADMIN") return "GLOBAL_ADMIN";
  if (s === "COMPANY_ADMIN") return "COMPANY_ADMIN";
  return "DEVELOPER";
}

export async function fetchProfileCompanyAndRole(
  admin: SupabaseClient,
  userId: string
): Promise<{ msgf_access_role: MsgfDashboardAccessRole; company_id: string | null }> {
  const { data, error } = await admin
    .from("p4_profiles")
    .select("msgf_access_role, company_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`p4_profiles operator lookup: ${error.message}`);
  }

  return {
    msgf_access_role: normalizeRole(data?.msgf_access_role as string | undefined),
    company_id: typeof data?.company_id === "string" ? data.company_id.trim() || null : null,
  };
}

export async function listUserIdsForCompany(
  admin: SupabaseClient,
  companyId: string
): Promise<string[]> {
  const cid = companyId.trim();
  if (!cid) return [];

  const { data, error } = await admin.from("p4_profiles").select("user_id").eq("company_id", cid);

  if (error) {
    throw new Error(`p4_profiles company members: ${error.message}`);
  }

  return (data ?? []).map((r) => r.user_id as string).filter(Boolean);
}

/**
 * Personal sandbox operator elevated by tenant middleware (company_admin, own silo only).
 */
export async function resolvePersonalSandboxOperator(
  req: NextRequest,
  admin: SupabaseClient
): Promise<DashboardOperatorContext | null> {
  if (
    req.headers.get(MSGF_PERSONAL_SANDBOX_HEADER)?.trim() !== "1" ||
    req.headers.get(MSGF_AUTO_PROMOTED_HEADER)?.trim() !== "1"
  ) {
    return null;
  }

  const operatorUserId = req.headers.get(MSGF_OPERATOR_USER_ID_HEADER)?.trim() || null;
  if (!operatorUserId) return null;

  const tenantKey = req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ?? null;
  const profile = await fetchProfileCompanyAndRole(admin, operatorUserId);
  const independent = isIndependentDeveloper({
    company_id: profile.company_id,
    tenantKey,
  });
  if (!independent) return null;

  const scopedTenant = allocatePersonalSandboxTenantId(operatorUserId);
  if (tenantKey && tenantKey !== scopedTenant && !tenantKey.endsWith(operatorUserId)) {
    throw new MsgfOperatorGateError("Personal sandbox tenant scope mismatch.", 403);
  }

  return {
    role: "COMPANY_ADMIN",
    companyId: null,
    operatorUserId,
    dashboardView: "tenant_health",
    canPromoteToGlobal: false,
  };
}

/**
 * Resolves operator RBAC after {@link assertMsgfServiceAdmin}.
 * Omit {@link MSGF_OPERATOR_USER_ID_HEADER} for legacy global-ops callers (full tenant health).
 */
export async function resolveDashboardOperator(
  req: NextRequest,
  admin: SupabaseClient
): Promise<DashboardOperatorContext> {
  const personal = await resolvePersonalSandboxOperator(req, admin);
  if (personal) return personal;

  assertMsgfServiceAdmin(req);

  const operatorUserId = req.headers.get(MSGF_OPERATOR_USER_ID_HEADER)?.trim() || null;

  if (!operatorUserId) {
    return {
      role: "GLOBAL_ADMIN",
      companyId: null,
      operatorUserId: null,
      dashboardView: "tenant_health",
      canPromoteToGlobal: true,
    };
  }

  const profile = await fetchProfileCompanyAndRole(admin, operatorUserId);

  if (profile.msgf_access_role === "GLOBAL_ADMIN") {
    return {
      role: "GLOBAL_ADMIN",
      companyId: profile.company_id,
      operatorUserId,
      dashboardView: "tenant_health",
      canPromoteToGlobal: true,
    };
  }

  if (profile.msgf_access_role === "COMPANY_ADMIN") {
    return {
      role: "COMPANY_ADMIN",
      companyId: profile.company_id,
      operatorUserId,
      dashboardView: "team_overview",
      canPromoteToGlobal: false,
    };
  }

  return {
    role: "DEVELOPER",
    companyId: profile.company_id,
    operatorUserId,
    dashboardView: "team_overview",
    canPromoteToGlobal: false,
  };
}

export async function resolveIncidentCompanyId(
  admin: SupabaseClient,
  incident: { metadata?: Record<string, unknown> | null; user_id: string }
): Promise<string | null> {
  const meta = incident.metadata;
  const fromMeta =
    meta && typeof meta === "object" && typeof meta.company_id === "string"
      ? meta.company_id.trim()
      : "";
  if (fromMeta) return fromMeta;

  const fromProfile = await fetchProfileCompanyAndRole(admin, incident.user_id);
  return fromProfile.company_id;
}

export async function assertOperatorCanAccessIncident(
  admin: SupabaseClient,
  op: DashboardOperatorContext,
  incident: { metadata?: Record<string, unknown> | null; user_id: string }
): Promise<void> {
  if (op.role === "GLOBAL_ADMIN") return;

  if (op.role === "DEVELOPER") {
    throw new MsgfOperatorGateError("Developers cannot access the admin incident queue.", 403);
  }

  if (!op.companyId) {
    throw new MsgfOperatorGateError("Company admin profile is missing company_id.", 403);
  }

  const ic = await resolveIncidentCompanyId(admin, incident);
  if (ic !== op.companyId) {
    throw new MsgfOperatorGateError("Incident is outside your company scope.", 403);
  }
}

/** Pulse admin tie-break, self-heal act-as, and narrative log access. */
export async function assertOperatorMayActAsEntity(
  admin: SupabaseClient,
  op: DashboardOperatorContext,
  entityId: string
): Promise<void> {
  const eid = entityId.trim();
  if (!eid) {
    throw new MsgfOperatorGateError("entity_id required.", 400);
  }

  if (op.role === "GLOBAL_ADMIN") return;

  if (op.role === "DEVELOPER") {
    if (op.operatorUserId && eid !== op.operatorUserId.trim()) {
      throw new MsgfOperatorGateError("Developers may only act as their own user id.", 403);
    }
    return;
  }

  if (op.role === "COMPANY_ADMIN") {
    if (!op.companyId) {
      throw new MsgfOperatorGateError("Company admin profile is missing company_id.", 403);
    }
    const target = await fetchProfileCompanyAndRole(admin, eid);
    if (target.company_id !== op.companyId) {
      throw new MsgfOperatorGateError("Cross-company access denied.", 403);
    }
  }
}

export async function enrichIncidentScopeWithCompany(
  admin: SupabaseClient,
  userId: string,
  scope?: { tenantId: string; entityId?: string; companyId?: string | null }
): Promise<{ tenantId: string; entityId?: string; companyId?: string | null } | undefined> {
  if (!scope?.tenantId?.trim()) return scope;
  if (scope.companyId?.trim()) return { ...scope, companyId: scope.companyId.trim() };

  const { company_id } = await fetchProfileCompanyAndRole(admin, userId);
  if (!company_id) return scope;

  return { ...scope, companyId: company_id };
}
