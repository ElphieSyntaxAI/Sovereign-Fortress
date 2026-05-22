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
 * Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
 */
/**
 * Supabase-session admin resolution for MSGF's browser login flow.
 *
 * Service-token admin routes still use `resolveDashboardOperator` from
 * `msgf-operator-access`. This file is for human admins who sign in with the
 * shared `AuthForm` and then access `/admin/dashboard` / health refreshes with
 * their Supabase session cookie.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  fetchProfileCompanyAndRole,
  listUserIdsForCompany,
  type DashboardOperatorContext,
  type MsgfDashboardAccessRole,
} from "@/lib/msgf-operator-access";
import type { HealthServiceOptions } from "@/lib/services/HealthService";

export class MsgfAdminSessionError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "MsgfAdminSessionError";
    this.status = status;
  }
}

function normalizeAccessRole(raw: unknown): MsgfDashboardAccessRole {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (s === "GLOBAL_ADMIN" || s === "GLOBAL" || s === "ADMIN" || s === "OWNER") {
    return "GLOBAL_ADMIN";
  }
  if (
    s === "COMPANY_ADMIN" ||
    s === "COMPANY_OWNER" ||
    s === "COMPANY_OWNER_IT" ||
    s === "IT_ADMIN"
  ) {
    return "COMPANY_ADMIN";
  }
  return "DEVELOPER";
}

function strongestRole(...roles: MsgfDashboardAccessRole[]): MsgfDashboardAccessRole {
  if (roles.includes("GLOBAL_ADMIN")) return "GLOBAL_ADMIN";
  if (roles.includes("COMPANY_ADMIN")) return "COMPANY_ADMIN";
  return "DEVELOPER";
}

function readMetadataRole(user: User): MsgfDashboardAccessRole {
  const app = user.app_metadata as Record<string, unknown>;
  const meta = user.user_metadata as Record<string, unknown>;
  return strongestRole(
    normalizeAccessRole(app.msgf_access_role),
    normalizeAccessRole(app.access_role),
    normalizeAccessRole(app.role),
    normalizeAccessRole(meta.msgf_access_role),
    normalizeAccessRole(meta.access_role),
    normalizeAccessRole(meta.role),
    normalizeAccessRole(meta.persona)
  );
}

function readMetadataCompanyId(user: User): string | null {
  const app = user.app_metadata as Record<string, unknown>;
  const meta = user.user_metadata as Record<string, unknown>;
  const raw = app.company_id ?? app.companyId ?? meta.company_id ?? meta.companyId;
  return typeof raw === "string" ? raw.trim() || null : null;
}

function adminEmailAllowlist(): Set<string> {
  const raw =
    process.env.MSGF_GLOBAL_ADMIN_EMAILS?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_GLOBAL_ADMIN_EMAILS?.trim() ||
    "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Resolve a signed-in Supabase user to an MSGF dashboard operator.
 *
 * Sources, strongest wins:
 * - `MSGF_GLOBAL_ADMIN_EMAILS` env allowlist (fast recovery/admin bootstrap)
 * - `p4_profiles.msgf_access_role` + `company_id`
 * - Supabase `app_metadata` / `user_metadata` (`msgf_access_role`, `role`, `persona`)
 */
export async function resolveSessionDashboardOperator(
  admin: SupabaseClient,
  user: User
): Promise<DashboardOperatorContext> {
  const allowedEmails = adminEmailAllowlist();
  const emailRole =
    user.email && allowedEmails.has(user.email.toLowerCase()) ? "GLOBAL_ADMIN" : "DEVELOPER";

  const profile = await fetchProfileCompanyAndRole(admin, user.id).catch(() => ({
    msgf_access_role: "DEVELOPER" as MsgfDashboardAccessRole,
    company_id: null as string | null,
  }));

  const role = strongestRole(emailRole, profile.msgf_access_role, readMetadataRole(user));
  const companyId = profile.company_id ?? readMetadataCompanyId(user);

  return {
    role,
    companyId,
    operatorUserId: user.id,
    dashboardView: role === "GLOBAL_ADMIN" ? "tenant_health" : "team_overview",
    canPromoteToGlobal: role === "GLOBAL_ADMIN",
  };
}

export function isSessionOperatorAdmin(op: DashboardOperatorContext): boolean {
  return op.role === "GLOBAL_ADMIN" || op.role === "COMPANY_ADMIN";
}

export function assertSessionOperatorIsAdmin(op: DashboardOperatorContext): void {
  if (isSessionOperatorAdmin(op)) return;
  throw new MsgfAdminSessionError("This account is not an MSGF admin/operator.", 403);
}

export async function healthOptionsForSessionOperator(
  admin: SupabaseClient,
  op: DashboardOperatorContext,
  lookbackHours: number
): Promise<HealthServiceOptions> {
  if (op.role === "GLOBAL_ADMIN") {
    return {
      userId: null,
      lookbackHours,
      dashboardView: "tenant_health",
    };
  }

  if (op.role === "COMPANY_ADMIN") {
    if (!op.companyId) {
      if (op.operatorUserId) {
        return {
          userId: op.operatorUserId,
          lookbackHours,
          dashboardView: "tenant_health",
        };
      }
      throw new MsgfAdminSessionError("Company admin profile is missing company_id.", 403);
    }

    const memberUserIds = await listUserIdsForCompany(admin, op.companyId);
    return {
      userId: null,
      memberUserIds,
      teamScope: true,
      companyId: op.companyId,
      dashboardView: "team_overview",
      lookbackHours,
    };
  }

  return {
    userId: op.operatorUserId,
    lookbackHours,
  };
}
