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
