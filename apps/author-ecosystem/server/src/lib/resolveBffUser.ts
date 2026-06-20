import type { Request, Response } from "express";

import { bffTenantIdFromSupabaseUser } from "./authorTenantId.js";
import { createBffSupabaseServerClient } from "./bffSupabaseSsr.js";
import { normalizeRole, readBearerUser, tryReadBearerUser, type BffAuthUser } from "./readBearerJwtUser.js";

function roleFromSupabaseUser(user: {
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata ?? {};
  const raw = meta["terms_role"] ?? meta["user_role"] ?? meta["role"] ?? meta["persona"] ?? "author";
  return normalizeRole(raw);
}

/**
 * JWT/cookie bridge first, then Supabase SSR session (same-origin /api proxy + handoff cookies).
 */
export async function resolveBffUser(
  req: Request,
  res: Response
): Promise<BffAuthUser | null> {
  const cached = tryReadBearerUser(req);
  if (cached) return cached;

  try {
    const supabase = createBffSupabaseServerClient(req, res);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error && user?.id) {
      const authUser: BffAuthUser = {
        userId: bffTenantIdFromSupabaseUser(user),
        role: roleFromSupabaseUser(user),
      };
      (req as Request & { bffAuthUser?: BffAuthUser }).bffAuthUser = authUser;
      return authUser;
    }
  } catch (e) {
    console.warn("[resolveBffUser] supabase session", e);
  }

  return readBearerUser(req, res);
}
