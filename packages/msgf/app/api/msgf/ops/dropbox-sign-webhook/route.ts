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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import { NextRequest, NextResponse } from "next/server";

import { isPostMvpFeatureEnabled, postMvpDisabledPayload } from "@/lib/post-mvp-gates";
import { DropboxSignSigningProvider } from "@/lib/services/signing/DropboxSignSigningProvider";
import { processSigningWebhookCompletion } from "@/lib/services/signing/processSigningWebhook";
import { createAdminClient } from "@/utils/supabase/admin";

const provider = new DropboxSignSigningProvider();

export async function POST(req: NextRequest) {
  if (!isPostMvpFeatureEnabled("signing")) {
    return NextResponse.json(postMvpDisabledPayload("signing"), { status: 404 });
  }
  const rawBody = await req.text();

  if (!provider.verifyWebhook(rawBody, req.headers)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let jsonBody = rawBody;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const nested = params.get("json");
    if (nested) jsonBody = nested;
  }

  const parsed = provider.parseWebhook(jsonBody, req.headers);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  if (parsed.event === "callback_test" || !parsed.completed) {
    return new NextResponse("Hello API Event Received", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  let rawPayload: Record<string, unknown> = {};
  try {
    rawPayload = JSON.parse(jsonBody) as Record<string, unknown>;
  } catch {
    rawPayload = { raw: jsonBody.slice(0, 2000) };
  }

  const admin = createAdminClient();
  const result = await processSigningWebhookCompletion({
    admin,
    provider: "dropbox_sign",
    event: parsed.event,
    external_request_id: parsed.external_request_id,
    invite_id: parsed.invite_id,
    rawPayload,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  return new NextResponse("Hello API Event Received", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
