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
 * Dashboard tenant access guard — blocks IDOR via spoofed tenant_id query params.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  assertUserMayManageTenantSettings,
  TenantSettingsAuthError,
} from "@/lib/services/tenant-settings-auth";
import type { MsgfDashboardAccessRole } from "@/lib/msgf-operator-access";

export class DashboardTenantAccessError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "DashboardTenantAccessError";
    this.status = status;
  }
}

export type DashboardTenantAccessResult = {
  role: MsgfDashboardAccessRole;
  companyId: string | null;
  tenantId: string;
};

/**
 * Validate that the session user may read dashboard data for requestedTenantId.
 * GLOBAL_ADMIN (repo SUPER_ADMIN equivalent) may cross tenants.
 */
export async function validateDashboardTenantAccess(
  admin: SupabaseClient,
  session: { user: User },
  requestedTenantId: string
): Promise<DashboardTenantAccessResult> {
  const tid = requestedTenantId.trim();
  if (!tid) {
    throw new DashboardTenantAccessError("tenant_id required", 400);
  }

  try {
    const result = await assertUserMayManageTenantSettings({
      admin,
      user: session.user,
      tenantId: tid,
      write: false,
    });
    return { role: result.role, companyId: result.companyId, tenantId: tid };
  } catch (e) {
    if (e instanceof TenantSettingsAuthError) {
      throw new DashboardTenantAccessError(e.message, e.status);
    }
    throw e;
  }
}
