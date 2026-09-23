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
 * POST /api/msgf/workspace/docusign/mock-complete — dev-only signing completion
 * (MSGF_SIGNING_MOCK=1 or MSGF_DOCUSIGN_MOCK=1). Uses I5 idempotent pipeline.
 */

import { NextResponse } from "next/server";

import { isPostMvpFeatureEnabled, postMvpDisabledPayload } from "@/lib/post-mvp-gates";
import {
  assertPlanFeature,
  resolveCommercialPlanForUser,
} from "@/lib/billing/plan-entitlements";
import type { SigningProviderId } from "@/lib/services/signing/SigningProvider";
import { processSigningWebhookCompletion } from "@/lib/services/signing/processSigningWebhook";
import { signingMockMode } from "@/lib/services/signing/resolveSigningProvider";
import { requireWorkspaceTeamSession } from "@/lib/workspace-team-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: Request) {
  if (!isPostMvpFeatureEnabled("signing")) {
    return NextResponse.json(postMvpDisabledPayload("signing"), { status: 404 });
  }
  if (!signingMockMode()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Mock completion is only available when MSGF_SIGNING_MOCK=1 or MSGF_DOCUSIGN_MOCK=1.",
      },
      { status: 403 }
    );
  }

  const session = await requireWorkspaceTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const plan = await resolveCommercialPlanForUser(session.admin, session.user.id);
  const gate = assertPlanFeature(plan, "signing");
  if (!gate.ok) {
    return NextResponse.json(gate, { status: gate.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const inviteId =
    typeof record.invite_id === "string" ? record.invite_id.trim() : "";
  const providerHint =
    typeof record.provider === "string" ? record.provider.trim().toLowerCase() : "";

  const admin = createAdminClient();
  const { data: envelope } = await admin
    .from("msgf_docusign_envelopes")
    .select("envelope_id, external_request_id, invite_id, provider")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    !envelope?.envelope_id &&
    !(envelope as { external_request_id?: string } | null)?.external_request_id
  ) {
    return NextResponse.json({ ok: false, error: "No envelope for this user." }, { status: 404 });
  }

  const provider: SigningProviderId =
    providerHint === "dropbox_sign" ||
    (envelope as { provider?: string }).provider === "dropbox_sign"
      ? "dropbox_sign"
      : "docusign";

  const external =
    (envelope as { external_request_id?: string }).external_request_id ||
    (envelope as { envelope_id: string }).envelope_id;

  const result = await processSigningWebhookCompletion({
    admin,
    provider,
    external_request_id: external,
    invite_id: inviteId || ((envelope as { invite_id: string }).invite_id as string),
    event: "mock-complete",
    rawPayload: { mock: true, invite_id: inviteId || null },
  });

  return NextResponse.json({
    ok: result.ok,
    message: result.message,
    invite_id: result.invite_id,
    duplicate: result.duplicate ?? false,
    archive: result.archive ?? null,
  });
}
