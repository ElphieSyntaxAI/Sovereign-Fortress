/**
 * Actor resolution for POST /api/msgf/verify-result (IDE token / license / session).
 */

import type { NextRequest } from "next/server";

import { resolveDevEventActor } from "@/lib/services/dev-event-auth";

export async function resolveVerifyResultActor(
  req: NextRequest,
  tenantKey: string
): Promise<{ admin: ReturnType<typeof import("@/utils/supabase/admin").createAdminClient>; entityId: string }> {
  return resolveDevEventActor(req, tenantKey);
}
