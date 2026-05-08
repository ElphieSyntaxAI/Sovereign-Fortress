import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { msgfLogger } from "@msgf/lib/logger";

/**
 * Ensures the logged-in user belongs to the tenant they are trying to access.
 * If not, logs a violation and redirects to `/unauthorized` (never returns on failure).
 *
 * Use from Server Components / Route Handlers after `getUser()`.
 * With `MSGF_LOGGER_OFFLINE=1`, violations still surface in the server console.
 */
export async function tenantGuard(
  user: User | null,
  targetTenantId: string
): Promise<true> {
  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  const userTenantId =
    typeof meta?.tenant_id === "string" ? meta.tenant_id : undefined;

  if (userTenantId !== targetTenantId) {
    await msgfLogger.violation(
      targetTenantId,
      "UNAUTHORIZED_TENANT_ACCESS_ATTEMPT",
      user?.id,
      {
        attempted_tenant: targetTenantId,
        actual_tenant: userTenantId ?? null,
        path: "security-check",
      }
    );

    redirect("/unauthorized");
  }

  return true;
}
