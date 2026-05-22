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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
/**
 * GET /api/workspace/ide-credentials — session token + VS Code settings for msgf-pulse-guard.
 */

import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildIdeWorkspaceSettings,
  formatIdeSettingsJson,
  resolveIdeTenantKey,
  resolveMsgfAppOrigin,
} from "@/lib/workspace-ide-setup";
import { listUserProjects } from "@/lib/services/user-projects";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function GET() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const requestHost = requestHostFromHeaders(hdrs);
  const supabase = createClient(cookieStore, requestHost);

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return NextResponse.json({ error: "Sign in required.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = createAdminClient();
  const projects = await listUserProjects(admin, session.user.id).catch(() => []);
  const firstOrigin = projects[0]?.project_origin ?? null;

  const apiUrl = resolveMsgfAppOrigin(requestHost);
  const tenantKey = resolveIdeTenantKey(session.user.id, firstOrigin);
  const devSessionDefault =
    process.env.MSGF_DEV_SESSION_DEFAULT?.trim().toLowerCase() !== "0" &&
    process.env.MSGF_DEV_SESSION_DEFAULT?.trim().toLowerCase() !== "false";

  const settings = buildIdeWorkspaceSettings({
    apiUrl,
    tenantKey,
    authToken: session.access_token,
    devSession: devSessionDefault,
  });

  return NextResponse.json({
    apiUrl,
    tenantKey,
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? null,
    settingsJson: formatIdeSettingsJson(settings),
    settingsPath: ".vscode/settings.json",
    projectCount: projects.length,
  });
}
