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
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  GITHUB_OAUTH_SCOPES,
  deleteGithubUserConnection,
  fetchGithubLogin,
  getGithubConnectionStatus,
  upsertGithubUserConnection,
} from "@/lib/services/github-user-connection";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

async function requireUser() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/** GET — { connected, github_login, scopes } (no token). */
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const status = await getGithubConnectionStatus({ admin, userId: user.id });
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load GitHub status.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST — persist provider_token after OAuth / linkIdentity.
 * Body: { access_token, github_login?, scopes? }
 */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const json = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const accessToken =
    typeof json?.access_token === "string" ? json.access_token.trim() : "";
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "access_token is required." }, { status: 400 });
  }

  const scopes =
    typeof json?.scopes === "string" && json.scopes.trim()
      ? json.scopes.trim()
      : GITHUB_OAUTH_SCOPES;
  let githubLogin =
    typeof json?.github_login === "string" ? json.github_login.trim() : "";

  try {
    if (!githubLogin) {
      githubLogin = (await fetchGithubLogin(accessToken)) ?? "";
    }
    const admin = createAdminClient();
    await upsertGithubUserConnection({
      admin,
      userId: user.id,
      accessToken,
      githubLogin: githubLogin || null,
      scopes,
    });
    return NextResponse.json({
      ok: true,
      connected: true,
      github_login: githubLogin || null,
      scopes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to store GitHub connection.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** DELETE — disconnect GitHub (drop stored token). */
export async function DELETE() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    await deleteGithubUserConnection({ admin, userId: user.id });
    return NextResponse.json({ ok: true, connected: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect GitHub.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
