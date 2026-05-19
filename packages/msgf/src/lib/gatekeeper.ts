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
 * Distribution Build ID: MSGF-81e8259-20260519T153428Z-internal
 */
import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import { msgfLogger } from "@msgf/lib/logger";

/** Minimal user shape for tenant checks (map from your session / JWT). */
export type TenantGateUser = Pick<User, "id"> & {
  tenant_id?: string | null;
};

export type GatekeeperContext = {
  attemptedPath?: string;
  ip?: string | null;
};

export function clientIpFromHeaders(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    return fwd.split(",")[0]?.trim() ?? null;
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip");
}

/** Path + IP from a Next.js request (use in Route Handlers or middleware). */
export function gatekeeperContextFromRequest(request: NextRequest): GatekeeperContext {
  return {
    attemptedPath: request.nextUrl.pathname,
    ip: clientIpFromHeaders(request.headers),
  };
}

/** Reads `tenant_id` from Supabase `user_metadata` / `app_metadata` if present. */
export function tenantIdFromSupabaseUser(user: User): string | null {
  const um = user.user_metadata as Record<string, unknown> | undefined;
  const am = user.app_metadata as Record<string, unknown> | undefined;
  const v = um?.tenant_id ?? am?.tenant_id;
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Ensures the caller belongs to `targetTenantId`. On mismatch, logs a violation and throws.
 * Server-only (uses service-role logger).
 */
export async function validateTenantAccess(
  user: TenantGateUser,
  targetTenantId: string,
  context: GatekeeperContext = {}
): Promise<void> {
  if (user.tenant_id === targetTenantId) {
    return;
  }

  await msgfLogger.violation(
    targetTenantId,
    "Unauthorized Tenant Access Attempt",
    user.id,
    {
      attempted_path: context.attemptedPath,
      ip: context.ip ?? null,
      ...(user.tenant_id != null && user.tenant_id !== ""
        ? { user_tenant_id: user.tenant_id }
        : {}),
    }
  );

  throw new Error("Access Denied");
}

/** Same as `validateTenantAccess`, but resolves `tenant_id` from Supabase user metadata. */
export async function validateSupabaseUserTenantAccess(
  user: User,
  targetTenantId: string,
  context: GatekeeperContext = {}
): Promise<void> {
  const tenant_id = tenantIdFromSupabaseUser(user) ?? null;
  await validateTenantAccess({ id: user.id, tenant_id }, targetTenantId, context);
}
