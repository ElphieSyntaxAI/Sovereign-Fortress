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
 * Resolve whether the signed-in session may access operator / admin-only surfaces.
 */

import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertSessionOperatorIsAdmin,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";

export async function sessionIsDashboardOperator(
  admin: SupabaseClient,
  user: User
): Promise<boolean> {
  try {
    const op = await resolveSessionDashboardOperator(admin, user);
    assertSessionOperatorIsAdmin(op);
    return true;
  } catch {
    return false;
  }
}
