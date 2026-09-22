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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * Resolve MSGF operator for admin API routes: Bearer (Vite ops dashboard) or Supabase session (browser).
 */

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import {
  assertSessionOperatorIsAdmin,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import type { DashboardOperatorContext } from "@/lib/msgf-operator-access";
import { resolveDashboardOperator } from "@/lib/msgf-operator-access";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function resolveOperatorForAdminRequest(
  req: NextRequest,
  admin: SupabaseClient
): Promise<DashboardOperatorContext> {
  try {
    return await resolveDashboardOperator(req, admin);
  } catch (e) {
    if (!(e instanceof MsgfAdminAuthError)) {
      throw e;
    }

    const cookieStore = await cookies();
    const hdrs = await headers();
    const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new MsgfAdminAuthError("Sign in required for admin API access.", 401);
    }

    const op = await resolveSessionDashboardOperator(admin, user);
    assertSessionOperatorIsAdmin(op);
    return op;
  }
}
