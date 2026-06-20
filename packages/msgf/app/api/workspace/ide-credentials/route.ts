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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * GET /api/workspace/ide-credentials — session token + VS Code settings for msgf-pulse-guard.
 */

import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  ideTokenTtlDays,
  listActiveIdeTokens,
  mintIdeToken,
} from "@/lib/services/ide-token-service";
import {
  buildIdeWorkspaceSettings,
  formatIdeSettingsJson,
  resolveIdeTenantKey,
  resolveMsgfAppOrigin,
} from "@/lib/workspace-ide-setup";
import { buildVscodeIdeSetupUri } from "@/lib/workspace-ide-deep-link";
import { listUserProjects } from "@/lib/services/user-projects";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
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
  const requestedOrigin = req.nextUrl.searchParams.get("project_origin")?.trim() || null;
  const matched =
    requestedOrigin && projects.some((p) => p.project_origin === requestedOrigin)
      ? requestedOrigin
      : null;
  const firstOrigin = matched ?? projects[0]?.project_origin ?? null;

  const apiUrl = resolveMsgfAppOrigin(requestHost);
  const tenantKey = resolveIdeTenantKey(session.user.id, firstOrigin);
  const devSessionDefault =
    process.env.MSGF_DEV_SESSION_DEFAULT?.trim().toLowerCase() !== "0" &&
    process.env.MSGF_DEV_SESSION_DEFAULT?.trim().toLowerCase() !== "false";

  const wantLongLived = req.nextUrl.searchParams.get("long_lived") === "1";
  let authToken = session.access_token;
  let expiresAt: string | number | null = session.expires_at ?? null;
  let longLived: {
    tokenId: string;
    expiresAt: string;
    ttlDays: number;
  } | null = null;

  if (wantLongLived) {
    const minted = await mintIdeToken(admin, {
      userId: session.user.id,
      tenantId: tenantKey,
      label: "Workspace IDE setup",
    });
    if (!("error" in minted)) {
      authToken = minted.token;
      expiresAt = minted.expires_at;
      longLived = {
        tokenId: minted.token_id,
        expiresAt: minted.expires_at,
        ttlDays: ideTokenTtlDays(),
      };
    }
  }

  const activeTokens = await listActiveIdeTokens(admin, session.user.id, tenantKey);
  const hasActiveIdeToken = activeTokens.length > 0;
  const settingsAuthToken = longLived
    ? authToken
    : hasActiveIdeToken
      ? "REPLACE_VIA_MINT_OR_PASTE_SAVED_msgf_ide_TOKEN"
      : "← Mint long-lived IDE token (session JWT expires in ~1 hour — do not paste into the IDE)";

  const settings = buildIdeWorkspaceSettings({
    apiUrl,
    tenantKey,
    authToken: settingsAuthToken,
    devSession: devSessionDefault,
  });

  return NextResponse.json({
    apiUrl,
    tenantKey,
    accessToken: session.access_token,
    ideToken: longLived ? authToken : undefined,
    expiresAt: longLived ? expiresAt : activeTokens[0]?.expires_at ?? session.expires_at ?? null,
    longLived,
    hasActiveIdeToken,
    activeTokenCount: activeTokens.length,
    tokenKind: longLived
      ? "long_lived"
      : hasActiveIdeToken
        ? "long_lived_active"
        : "needs_mint",
    settingsJson: formatIdeSettingsJson(settings),
    settingsPath: ".vscode/settings.json",
    vscodeUri: buildVscodeIdeSetupUri(settings),
    projectCount: projects.length,
    projects: projects.map((p) => ({
      project_origin: p.project_origin,
      label: p.project_origin,
    })),
    selectedProjectOrigin: firstOrigin,
  });
}
