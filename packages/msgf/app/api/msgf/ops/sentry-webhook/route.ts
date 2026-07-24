/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * POST /api/msgf/ops/sentry-webhook — Sentry issue → Vault quarantine (A2)
 */
import { NextRequest, NextResponse } from "next/server";

import {
  parseSentryWebhookPayload,
  quarantineVaultFromSentryCrash,
  verifySentryWebhookAuth,
} from "@/lib/services/sentry-vault-quarantine";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifySentryWebhookAuth(rawBody, req.headers)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const signal = parseSentryWebhookPayload(body, req.headers);
  if (!signal) {
    return NextResponse.json({ ok: false, error: "Unrecognized Sentry payload." }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await quarantineVaultFromSentryCrash(admin, signal);

  return NextResponse.json({
    ok: true,
    quarantined: result.quarantined,
    vector_id: result.vectorId,
    confidence: result.confidence,
    reason: result.reason,
    issue_id: signal.issueId,
  });
}
