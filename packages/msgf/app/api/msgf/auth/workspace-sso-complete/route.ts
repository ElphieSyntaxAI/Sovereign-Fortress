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
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { completeWorkspaceSso } from "@/lib/services/workspace-sso";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  let nextPath: string | null = null;
  try {
    const body = (await req.json()) as { next?: string };
    if (typeof body?.next === "string") nextPath = body.next;
  } catch {
    /* empty body ok */
  }

  const admin = createAdminClient();
  const result = await completeWorkspaceSso(admin, user, { nextPath });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: result.reason,
        redirect: result.redirect,
        message: result.message,
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    company_id: result.company_id,
    domain: result.domain,
    redirect: result.redirect,
  });
}
