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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/**
 * POST /api/msgf/ops/docusign-webhook — DocuSign Connect events (idempotent I5)
 */

import { NextRequest, NextResponse } from "next/server";

import {
  verifyDocuSignWebhookAuth,
  type DocuSignConnectPayload,
} from "@/lib/services/docusign-gateway";
import { processSigningWebhookCompletion } from "@/lib/services/signing/processSigningWebhook";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifyDocuSignWebhookAuth(req, rawBody)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let payload: DocuSignConnectPayload;
  try {
    payload = JSON.parse(rawBody) as DocuSignConnectPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const event = payload.event?.toLowerCase() ?? "";
  const envelopeId = payload.envelopeId ?? payload.data?.envelopeId ?? null;
  const isCompleted =
    event.includes("envelope-completed") ||
    payload.data?.envelopeSummary?.status?.toLowerCase() === "completed";

  if (!isCompleted) {
    return NextResponse.json({ ok: true, message: "event ignored" });
  }

  const admin = createAdminClient();
  const result = await processSigningWebhookCompletion({
    admin,
    provider: "docusign",
    event: event || "envelope-completed",
    external_request_id: envelopeId,
    invite_id: payload.inviteId ?? null,
    rawPayload: payload as unknown as Record<string, unknown>,
  });

  return NextResponse.json(
    {
      ok: result.ok,
      message: result.message,
      invite_id: result.invite_id,
      duplicate: result.duplicate ?? false,
      archive: result.archive ?? null,
    },
    { status: result.ok ? 200 : 422 }
  );
}
