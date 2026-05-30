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
 * POST /api/msgf/ops/docusign-webhook — DocuSign Connect events
 */

import { NextRequest, NextResponse } from "next/server";

import {
  handleConnectWebhook,
  verifyDocuSignWebhookAuth,
  type DocuSignConnectPayload,
} from "@/lib/services/docusign-gateway";
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

  const admin = createAdminClient();
  const result = await handleConnectWebhook(admin, payload);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
