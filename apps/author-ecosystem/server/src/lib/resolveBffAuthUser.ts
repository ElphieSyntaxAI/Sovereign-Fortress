import type { User } from "@supabase/supabase-js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request, Response } from "express";

import { bffTenantIdFromSupabaseUser } from "./authorTenantId.js";
import { getJwtFromRequest } from "./bffAuthCookies.js";
import { createBffSupabaseServerClient } from "./bffSupabaseSsr.js";
import { loadMonorepoRootEnv } from "./database/loadRootEnv.js";
import { supabaseNodeClientOptions } from "./supabaseNodeRealtime.js";
import {
  normalizeRole,
  tryReadBearerUser,
  type BffAuthUser,
} from "./readBearerJwtUser.js";

export type AuthRequest = Request & { bffAuthUser?: BffAuthUser };

function mapSupabaseUser(user: User): BffAuthUser {
  const meta = user.user_metadata ?? {};
  const userId = bffTenantIdFromSupabaseUser(user);
  const role = normalizeRole(
    meta["terms_role"] ?? meta["user_role"] ?? meta["role"] ?? meta["persona"]
  );
  return { userId, role };
}

let publishableClient: SupabaseClient | null = null;

export function getPublishableAuthClient(): SupabaseClient | null {
  loadMonorepoRootEnv();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  if (!publishableClient) {
    publishableClient = createClient(
      url,
      key,
      supabaseNodeClientOptions({
        auth: { persistSession: false, autoRefreshToken: false },
      })
    );
  }
  return publishableClient;
}

/**
 * Resolve the signed-in user without requiring a legacy JWT Secret in env.
 * Order: local JWT verify (if configured) → Supabase SSR cookies → Auth API `getUser(jwt)`.
 */
export async function resolveBffAuthUser(req: Request, res: Response): Promise<BffAuthUser | null> {
  const sync = tryReadBearerUser(req);
  if (sync) return sync;

  try {
    const supabase = createBffSupabaseServerClient(req, res);
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return mapSupabaseUser(data.user);
  } catch {
    /* cookie session unavailable */
  }

  const token = getJwtFromRequest(req);
  if (token) {
    const client = getPublishableAuthClient();
    if (client) {
      const { data, error } = await client.auth.getUser(token);
      if (!error && data.user) return mapSupabaseUser(data.user);
    }
  }

  return null;
}

/** Attach `req.bffAuthUser` for downstream `readBearerUser` (sync) on protected API routes. */
export async function bffAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: () => void
): Promise<void> {
  if (
    req.path.startsWith("/api/auth/login") ||
    req.path.startsWith("/api/auth/register") ||
    req.path.startsWith("/api/auth/msgf-handoff")
  ) {
    next();
    return;
  }
  try {
    const user = await resolveBffAuthUser(req, res);
    if (user) req.bffAuthUser = user;
  } catch (e) {
    console.warn("[bff] auth middleware:", e instanceof Error ? e.message : e);
  }
  next();
}
