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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  isSessionOperatorAdmin,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function GET() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ ok: false, is_admin: false }, { status: 401 });
  }

  const admin = createAdminClient();
  const op = await resolveSessionDashboardOperator(admin, user);
  return NextResponse.json({
    ok: true,
    is_admin: isSessionOperatorAdmin(op),
    role: op.role,
  });
}
