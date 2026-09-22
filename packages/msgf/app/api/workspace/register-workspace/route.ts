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
/**
 * POST /api/workspace/register-workspace — record IDE workspace for tenant handoff.
 */

import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { registerWorkspace } from "@/lib/services/registered-workspace-service";
import { listUserProjects } from "@/lib/services/user-projects";
import { resolveIdeTenantKey } from "@/lib/workspace-ide-setup";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

const bodySchema = z
  .object({
    workspace_name: z.string().trim().min(1).max(256),
    workspace_path_hint: z.string().max(512).optional(),
    project_origin: z.string().max(512).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));

  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const projects = await listUserProjects(admin, session.user.id).catch(() => []);
  const requestedOrigin = parsed.data.project_origin?.trim() || null;
  const matched =
    requestedOrigin && projects.some((p) => p.project_origin === requestedOrigin)
      ? requestedOrigin
      : null;
  const firstOrigin = matched ?? projects[0]?.project_origin ?? null;
  const tenantId = resolveIdeTenantKey(session.user.id, firstOrigin);

  const result = await registerWorkspace(admin, {
    userId: session.user.id,
    tenantId,
    workspaceName: parsed.data.workspace_name,
    workspacePathHint: parsed.data.workspace_path_hint,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    tenant_id: tenantId,
    project_origin: firstOrigin,
    workspace_fingerprint: result.workspace_fingerprint,
    registered_at: result.registered_at,
  });
}
