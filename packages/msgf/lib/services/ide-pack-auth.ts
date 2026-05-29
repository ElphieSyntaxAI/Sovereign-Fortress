/**
 * IDE bearer resolution for prompt-optimizer / confirm-pack routes.
 */

import type { NextRequest } from "next/server";

import { MSGF_ENTITY_ID_HEADER, MSGF_TENANT_KEY_HEADER } from "@/lib/msgf-http-headers";
import { verifyIdeToken, type VerifiedIdeToken } from "@/lib/services/ide-token-service";
import { createAdminClient } from "@/utils/supabase/admin";

export class IdePackAuthError extends Error {
  constructor(
    message: string,
    readonly status: number = 401
  ) {
    super(message);
    this.name = "IdePackAuthError";
  }
}

function getBearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const apiKey = req.headers.get("x-msgf-api-key");
  return apiKey?.trim() || null;
}

export async function resolveIdePackActor(
  req: NextRequest,
  tenantKey: string
): Promise<{ admin: ReturnType<typeof createAdminClient>; token: VerifiedIdeToken; entityId: string }> {
  const bearer = getBearer(req);
  if (!bearer?.startsWith("msgf_ide_")) {
    throw new IdePackAuthError("msgf_ide_* bearer token required.", 401);
  }

  const admin = createAdminClient();
  const headerTenant = req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim();
  const tid = headerTenant || tenantKey.trim();
  const verified = await verifyIdeToken(admin, bearer, tid);
  if (!verified) {
    throw new IdePackAuthError("IDE token rejected for tenant scope.", 403);
  }

  const entityId =
    req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() ||
    process.env.MSGF_SOLO_ENTITY_ID?.trim() ||
    verified.user_id;

  return { admin, token: verified, entityId };
}
