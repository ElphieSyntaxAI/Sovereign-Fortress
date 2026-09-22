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
import { NextResponse } from "next/server";

import {
  decryptGithubAccessToken,
  listGithubReposForToken,
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

/** GET — list GitHub repos for the connected account. */
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const token = await decryptGithubAccessToken({ admin, userId: user.id });
    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "GitHub is not connected. Use Connect GitHub on Setup → Projects.",
          code: "GITHUB_NOT_CONNECTED",
        },
        { status: 400 }
      );
    }

    const repos = await listGithubReposForToken(token);
    return NextResponse.json({ ok: true, repos, count: repos.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list GitHub repos.";
    const status = /token rejected|not connected/i.test(message) ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
