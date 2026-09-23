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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Authorize tenant settings APIs (provider keys, consensus presets).
 * Prevents IDOR via spoofed x-msgf-tenant-id against the service-role admin client.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  allocatePersonalSandboxTenantId,
} from "@/lib/msgf-tenant-governance";
import {
  fetchProfileCompanyAndRole,
  type MsgfDashboardAccessRole,
} from "@/lib/msgf-operator-access";

export class TenantSettingsAuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "TenantSettingsAuthError";
    this.status = status;
  }
}

function personalTenantIdsForUser(userId: string): Set<string> {
  const uid = userId.trim();
  return new Set([uid, allocatePersonalSandboxTenantId(uid)].filter(Boolean));
}

/**
 * Caller may read/write tenant BYOK + consensus config when:
 * - tenant is their personal sandbox / user id, or
 * - GLOBAL_ADMIN, or
 * - COMPANY_ADMIN whose company_id equals the tenant_id (company silo), or
 * - COMPANY_ADMIN / DEVELOPER whose profile company_id matches tenant when tenant is a company UUID
 *   and they belong to that company (developers: read+write own company settings for presets).
 */
export async function assertUserMayManageTenantSettings(params: {
  admin: SupabaseClient;
  user: User;
  tenantId: string;
  /** PUT/POST/DELETE require admin-ish; GET allows same scopes. */
  write: boolean;
}): Promise<{ role: MsgfDashboardAccessRole; companyId: string | null }> {
  const tid = params.tenantId.trim();
  if (!tid) {
    throw new TenantSettingsAuthError("tenant_id required", 400);
  }

  const uid = params.user.id.trim();
  if (personalTenantIdsForUser(uid).has(tid)) {
    const profile = await fetchProfileCompanyAndRole(params.admin, uid);
    return { role: profile.msgf_access_role, companyId: profile.company_id };
  }

  const profile = await fetchProfileCompanyAndRole(params.admin, uid);

  if (profile.msgf_access_role === "GLOBAL_ADMIN") {
    return { role: profile.msgf_access_role, companyId: profile.company_id };
  }

  if (profile.company_id && profile.company_id === tid) {
    if (params.write && profile.msgf_access_role === "DEVELOPER") {
      throw new TenantSettingsAuthError(
        "Company CONVERGE / provider settings require COMPANY_ADMIN.",
        403
      );
    }
    return { role: profile.msgf_access_role, companyId: profile.company_id };
  }

  throw new TenantSettingsAuthError("Not allowed for this tenant.", 403);
}
