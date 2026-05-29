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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * GET /api/workspace/ide-connectivity-check — browser session probe (Workspace IDE setup UI).
 */

import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import type { IdeConnectivityResponse } from "@/lib/ide-error-codes";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_IDE_PULSE_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { runIdeConnectivityChecks } from "@/lib/services/ide-connectivity-check";
import { listUserProjects } from "@/lib/services/user-projects";
import { resolveIdeTenantKey } from "@/lib/workspace-ide-setup";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return NextResponse.json(
      { ok: false, checks: [{ name: "session", ok: false, user_message: "Sign in required." }] },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const projects = await listUserProjects(admin, session.user.id).catch(() => []);
  const requestedOrigin = req.nextUrl.searchParams.get("project_origin")?.trim() || null;
  const tenantKey = resolveIdeTenantKey(
    session.user.id,
    requestedOrigin && projects.some((p) => p.project_origin === requestedOrigin)
      ? requestedOrigin
      : projects[0]?.project_origin ?? null
  );

  const probeReq = new NextRequest(req.url, {
    headers: new Headers({
      authorization: `Bearer ${session.access_token}`,
      [MSGF_IDE_PULSE_HEADER]: "1",
      [MSGF_TENANT_KEY_HEADER]: tenantKey,
      [MSGF_TENANT_ID_HEADER]: tenantKey,
      [MSGF_ENTITY_ID_HEADER]: session.user.id,
    }),
  });

  const checks = await runIdeConnectivityChecks(probeReq);
  const body: IdeConnectivityResponse = { ok: checks.every((c) => c.ok), checks };
  return NextResponse.json(body, { status: body.ok ? 200 : 503 });
}
