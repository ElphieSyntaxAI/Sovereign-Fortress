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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * POST /api/msgf/workspace/docusign/mock-complete — dev-only DocuSign completion (MSGF_DOCUSIGN_MOCK=1).
 */

import { NextResponse } from "next/server";

import {
  handleConnectWebhook,
  mockMode,
} from "@/lib/services/docusign-gateway";
import { requireWorkspaceTeamSession } from "@/lib/workspace-team-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: Request) {
  if (!mockMode()) {
    return NextResponse.json(
      { ok: false, error: "Mock completion is only available when MSGF_DOCUSIGN_MOCK=1." },
      { status: 403 }
    );
  }

  const session = await requireWorkspaceTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const inviteId =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).invite_id === "string"
      ? String((body as Record<string, unknown>).invite_id).trim()
      : "";

  const admin = createAdminClient();
  const { data: envelope } = await admin
    .from("msgf_docusign_envelopes")
    .select("envelope_id, invite_id")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!envelope?.envelope_id) {
    return NextResponse.json({ ok: false, error: "No envelope for this user." }, { status: 404 });
  }

  const result = await handleConnectWebhook(admin, {
    event: "envelope-completed",
    envelopeId: envelope.envelope_id as string,
    inviteId: inviteId || (envelope.invite_id as string),
    data: { envelopeSummary: { status: "completed" } },
  });

  return NextResponse.json({ ok: result.ok, message: result.message });
}
