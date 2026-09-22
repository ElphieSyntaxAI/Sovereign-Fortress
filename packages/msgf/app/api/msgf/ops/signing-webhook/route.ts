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
import { getSigningProviderById } from "@/lib/services/signing/index";
import { processSigningWebhookCompletion } from "@/lib/services/signing/processSigningWebhook";
import type { SigningProviderId } from "@/lib/services/signing/SigningProvider";
import { createAdminClient } from "@/utils/supabase/admin";

function parseProvider(req: NextRequest): SigningProviderId {
  const q = req.nextUrl.searchParams.get("provider")?.trim().toLowerCase();
  if (q === "dropbox_sign" || q === "hellosign") return "dropbox_sign";
  const hdr = req.headers.get("x-msgf-signing-provider")?.trim().toLowerCase();
  if (hdr === "dropbox_sign" || hdr === "hellosign") return "dropbox_sign";
  return "docusign";
}

export async function POST(req: NextRequest) {
  if (!isPostMvpFeatureEnabled("signing")) {
    return NextResponse.json(postMvpDisabledPayload("signing"), { status: 404 });
  }
  const rawBody = await req.text();
  const providerId = parseProvider(req);
  const provider = getSigningProviderById(providerId);

  if (!provider.verifyWebhook(rawBody, req.headers)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const parsed = provider.parseWebhook(rawBody, req.headers);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "Invalid JSON / payload." }, { status: 400 });
  }

  if (!parsed.completed) {
    return NextResponse.json({ ok: true, message: "event ignored" });
  }

  let rawPayload: Record<string, unknown> = {};
  try {
    rawPayload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    rawPayload = { raw: rawBody.slice(0, 2000) };
  }

  const admin = createAdminClient();
  const result = await processSigningWebhookCompletion({
    admin,
    provider: providerId,
    event: parsed.event,
    external_request_id: parsed.external_request_id,
    invite_id: parsed.invite_id,
    rawPayload,
  });

  return NextResponse.json(
    {
      ok: result.ok,
      message: result.message,
      invite_id: result.invite_id,
      duplicate: result.duplicate ?? false,
      archive: result.archive ?? null,
      idempotency_key: result.idempotency_key,
    },
    { status: result.ok ? 200 : 422 }
  );
}
