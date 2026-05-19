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
 * Distribution Build ID: MSGF-dde0b5b-20260519T185358Z-internal
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ContractAutomationService, clientIpFromHeaders, type LegalContractParty } from "@msgf/lib/ContractAutomationBridge";
import { createServiceRoleClient } from "@msgf/lib/supabase/service-role";
import { createClient } from "@/utils/supabase/server";

function parseParty(v: unknown): LegalContractParty | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "author" || s === "helper") return s;
  return null;
}

/**
 * POST /api/contracts/sign-nda
 * Body: { manuscript_id, helper_id, party: "author" | "helper", author_notify_email?, helper_notify_email? }
 *
 * Authenticated author/helper session (Supabase cookies). Records IP, UTC time, manuscript SHA-256;
 * on full execution stores receipt hash and POSTs optional `CONTRACT_RECEIPT_EMAIL_WEBHOOK_URL`.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const authClient = createClient(cookieStore);
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = String(user.user_metadata?.tenant_id ?? "").trim();
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id missing from session" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const manuscript_id = typeof o["manuscript_id"] === "string" ? o["manuscript_id"].trim() : "";
  const helper_id = typeof o["helper_id"] === "string" ? o["helper_id"].trim() : "";
  const party = parseParty(o["party"]);
  const author_notify_email = typeof o["author_notify_email"] === "string" ? o["author_notify_email"].trim() : null;
  const helper_notify_email = typeof o["helper_notify_email"] === "string" ? o["helper_notify_email"].trim() : null;

  if (!manuscript_id || !helper_id || !party) {
    return NextResponse.json({ error: "manuscript_id, helper_id, and party are required" }, { status: 400 });
  }

  const ip = clientIpFromHeaders((name) => req.headers.get(name));

  try {
    const sr = createServiceRoleClient();
    const svc = new ContractAutomationService(sr);
    const row = await svc.recordDigitalSignature({
      tenantId,
      manuscriptId: manuscript_id,
      helperId: helper_id,
      party,
      signerIp: ip,
      authorNotifyEmail: author_notify_email,
      helperNotifyEmail: helper_notify_email,
    });
    return NextResponse.json({ contract: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
