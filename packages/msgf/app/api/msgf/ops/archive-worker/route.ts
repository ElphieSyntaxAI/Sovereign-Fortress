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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import { NextRequest, NextResponse } from "next/server";

import { isPostMvpFeatureEnabled, postMvpDisabledPayload } from "@/lib/post-mvp-gates";
import { processDropboxArchiveJobs } from "@/lib/services/dropbox-archive-worker";
import { createAdminClient } from "@/utils/supabase/admin";

function authorized(req: NextRequest): boolean {
  const secret = process.env.MSGF_OPS_CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization")?.trim() === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isPostMvpFeatureEnabled("dropbox_archive")) {
    return NextResponse.json(postMvpDisabledPayload("dropbox_archive"), { status: 404 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let limit = 10;
  try {
    const body = (await req.json()) as { limit?: number };
    if (typeof body.limit === "number") limit = body.limit;
  } catch {
    /* empty */
  }

  const admin = createAdminClient();
  const result = await processDropboxArchiveJobs(admin, { limit });

  // Backlog hint for ops banner
  const { count } = await admin
    .from("msgf_docusign_envelopes")
    .select("id", { count: "exact", head: true })
    .eq("archive_status", "pending_local");

  return NextResponse.json({
    ok: true,
    ...result,
    archive_backlog_pending_local: count ?? 0,
  });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const admin = createAdminClient();
  const { count } = await admin
    .from("msgf_docusign_envelopes")
    .select("id", { count: "exact", head: true })
    .in("archive_status", ["pending_local", "queued", "failed"]);

  return NextResponse.json({
    ok: true,
    archive_backlog: count ?? 0,
    note: "Archive failures never block IDE mint once onboarding_status=APPROVED.",
  });
}
