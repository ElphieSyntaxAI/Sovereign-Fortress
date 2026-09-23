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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * POST /api/workspace/ide-token — mint long-lived msgf_ide_* token (session required).
 */

import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { mintIdeToken, ideTokenTtlDays } from "@/lib/services/ide-token-service";
import { listUserProjects } from "@/lib/services/user-projects";
import {
  buildIdeWorkspaceSettings,
  formatIdeSettingsJson,
  resolveIdeTenantKey,
  resolveMsgfAppOrigin,
} from "@/lib/workspace-ide-setup";
import { buildVscodeIdeSetupUri } from "@/lib/workspace-ide-deep-link";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

const bodySchema = z
  .object({
    project_origin: z.string().max(512).optional(),
    label: z.string().max(128).optional(),
    workspace_name: z.string().max(256).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const requestHost = requestHostFromHeaders(hdrs);
  const supabase = createClient(cookieStore, requestHost);

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema> = {};
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (parsed.success) body = parsed.data;
  } catch {
    /* empty body ok */
  }

  const admin = createAdminClient();
  const projects = await listUserProjects(admin, session.user.id).catch(() => []);
  const requestedOrigin = body.project_origin?.trim() || null;
  const matched =
    requestedOrigin && projects.some((p) => p.project_origin === requestedOrigin)
      ? requestedOrigin
      : null;
  const firstOrigin = matched ?? projects[0]?.project_origin ?? null;
  const tenantKey = resolveIdeTenantKey(session.user.id, firstOrigin);
  const apiUrl = resolveMsgfAppOrigin(requestHost);

  const minted = await mintIdeToken(admin, {
    userId: session.user.id,
    tenantId: tenantKey,
    label: body.label ?? "IDE long-lived",
    workspaceFingerprint: body.workspace_name
      ? `${session.user.id}:${body.workspace_name}`
      : null,
  });

  if ("error" in minted) {
    return NextResponse.json({ ok: false, error: minted.error }, { status: 503 });
  }

  const devSessionDefault =
    process.env.MSGF_DEV_SESSION_DEFAULT?.trim().toLowerCase() !== "0" &&
    process.env.MSGF_DEV_SESSION_DEFAULT?.trim().toLowerCase() !== "false";

  const settings = buildIdeWorkspaceSettings({
    apiUrl,
    tenantKey,
    authToken: minted.token,
    devSession: devSessionDefault,
  });

  return NextResponse.json({
    ok: true,
    ideToken: minted.token,
    tokenId: minted.token_id,
    expiresAt: minted.expires_at,
    ttlDays: ideTokenTtlDays(),
    tenantKey,
    apiUrl,
    settingsJson: formatIdeSettingsJson(settings),
    settingsPath: ".vscode/settings.json",
    vscodeUri: buildVscodeIdeSetupUri(settings),
    longLived: {
      tokenId: minted.token_id,
      expiresAt: minted.expires_at,
      ttlDays: ideTokenTtlDays(),
    },
    warning: "Store this token like a password. It is shown once.",
  });
}
