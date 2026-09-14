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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * GET /api/workspace/ide-tokens — list active long-lived IDE tokens (metadata only).
 * POST — mint a new token for a mapped project (same as /api/workspace/ide-token).
 */

import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  ideTokenTtlDays,
  listActiveIdeTokens,
  mintIdeToken,
} from "@/lib/services/ide-token-service";
import { MONOREPO_WORKSPACE_PRESETS } from "@/lib/services/monorepo-workspace-presets";
import { ensureTenantWalletStarter } from "@/lib/services/tenant-token-wallet";
import { listUserProjects } from "@/lib/services/user-projects";
import {
  buildIdeWorkspaceSettings,
  formatIdeSettingsJson,
  resolveIdeTenantKey,
  resolveMsgfAppOrigin,
} from "@/lib/workspace-ide-setup";
import { buildVscodeIdeSetupUri } from "@/lib/workspace-ide-deep-link";
import { getComplianceStatus } from "@/lib/services/company-team";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

const postSchema = z
  .object({
    project_origin: z.string().max(512).optional(),
    label: z.string().max(128).optional(),
    workspace_name: z.string().max(256).optional(),
  })
  .strict();

async function requireSession() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const requestHost = requestHostFromHeaders(hdrs);
  const supabase = createClient(cookieStore, requestHost);
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.user) {
    return null;
  }
  return { session, requestHost };
}

function resolveProjectOrigin(
  projects: Awaited<ReturnType<typeof listUserProjects>>,
  requested: string | null
): string | null {
  if (requested && projects.some((p) => p.project_origin === requested)) {
    return requested;
  }
  return projects[0]?.project_origin ?? null;
}

export async function GET(req: NextRequest) {
  const ctx = await requireSession();
  if (!ctx) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const admin = createAdminClient();
  const projects = await listUserProjects(admin, ctx.session.user.id).catch(() => []);
  const projectOrigin = req.nextUrl.searchParams.get("project_origin")?.trim() || null;
  const tenantFilter = resolveProjectOrigin(projects, projectOrigin);

  const tokens = await listActiveIdeTokens(
    admin,
    ctx.session.user.id,
    tenantFilter ?? undefined
  );

  return NextResponse.json({
    ok: true,
    project_origin: tenantFilter,
    tokens,
    has_active_token: tokens.length > 0,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await requireSession();
  if (!ctx) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: z.infer<typeof postSchema> = {};
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = postSchema.safeParse(json);
    if (parsed.success) body = parsed.data;
  } catch {
    /* empty body ok */
  }

  const admin = createAdminClient();

  const compliance = await getComplianceStatus(admin, ctx.session.user.id);
  if (compliance.is_locked) {
    return NextResponse.json(
      {
        ok: false,
        error: "pending_signatures",
        signing_url: compliance.signing_url,
        message:
          "Complete your compliance signature before minting IDE tokens.",
      },
      { status: 403 }
    );
  }

  const projects = await listUserProjects(admin, ctx.session.user.id).catch(() => []);
  const requestedOrigin = body.project_origin?.trim() || null;
  const projectOrigin = resolveProjectOrigin(projects, requestedOrigin);

  if (requestedOrigin && !projectOrigin) {
    return NextResponse.json(
      {
        error:
          "Project not mapped. Add it on Setup projects first, then mint an IDE token.",
      },
      { status: 400 }
    );
  }

  const tenantKey = resolveIdeTenantKey(ctx.session.user.id, projectOrigin);
  const apiUrl = resolveMsgfAppOrigin(ctx.requestHost);

  const minted = await mintIdeToken(admin, {
    userId: ctx.session.user.id,
    tenantId: tenantKey,
    label: body.label ?? `IDE · ${tenantKey}`,
    workspaceFingerprint: body.workspace_name
      ? `${ctx.session.user.id}:${body.workspace_name}`
      : projectOrigin
        ? `${ctx.session.user.id}:${projectOrigin}`
        : null,
  });

  if ("error" in minted) {
    return NextResponse.json({ ok: false, error: minted.error }, { status: 503 });
  }

  try {
    await ensureTenantWalletStarter(admin, tenantKey);
    if (projectOrigin && projectOrigin !== tenantKey) {
      await ensureTenantWalletStarter(admin, projectOrigin);
    }
  } catch (e) {
    console.warn("[ide-tokens] wallet starter:", e instanceof Error ? e.message : e);
  }

  const devSessionDefault =
    process.env.MSGF_DEV_SESSION_DEFAULT?.trim().toLowerCase() !== "0" &&
    process.env.MSGF_DEV_SESSION_DEFAULT?.trim().toLowerCase() !== "false";

  const productPath =
    MONOREPO_WORKSPACE_PRESETS.find((p) => p.project_origin === tenantKey)?.suggested_local_path ??
    null;

  const settings = buildIdeWorkspaceSettings({
    apiUrl,
    tenantKey,
    authToken: minted.token,
    productPath,
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
    project_origin: projectOrigin,
    settingsJson: formatIdeSettingsJson(settings),
    settingsPath: ".vscode/settings.json",
    vscodeUri: buildVscodeIdeSetupUri(settings),
    longLived: {
      tokenId: minted.token_id,
      expiresAt: minted.expires_at,
      ttlDays: ideTokenTtlDays(),
    },
    warning: "Store this token like a password. It is shown once — paste into .vscode/settings.json.",
  });
}
