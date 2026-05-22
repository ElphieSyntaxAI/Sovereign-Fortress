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
 * Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
 */
import { cookies, headers } from "next/headers";

import {
  assertSessionOperatorIsAdmin,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

/**
 * Author Ecosystem and Syntax Education are prelaunch surfaces. Keep public CTAs
 * as "Coming soon" while allowing signed-in MSGF admins to test the live apps.
 */
export async function canAccessPrelaunchProducts(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const hdrs = await headers();
    const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return false;

    const admin = createAdminClient();
    const op = await resolveSessionDashboardOperator(admin, user);
    assertSessionOperatorIsAdmin(op);
    return true;
  } catch {
    return false;
  }
}
