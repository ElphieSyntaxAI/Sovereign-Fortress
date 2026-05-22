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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
import type { User } from "@supabase/supabase-js";

import {
  isSessionOperatorAdmin,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import type { DashboardOperatorContext } from "@/lib/msgf-operator-access";
import { createAdminClient } from "@/utils/supabase/admin";

export type DashboardAccessContext = {
  canAccessAdminDashboard: boolean;
  operator: DashboardOperatorContext;
};

export async function resolveDashboardAccessForUser(
  user: User
): Promise<DashboardAccessContext> {
  const admin = createAdminClient();
  const operator = await resolveSessionDashboardOperator(admin, user);
  return {
    canAccessAdminDashboard: isSessionOperatorAdmin(operator),
    operator,
  };
}
