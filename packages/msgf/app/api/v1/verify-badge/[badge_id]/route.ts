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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import { NextResponse } from "next/server";

import { BadgeCertificationService } from "@msgf/lib/BadgeCertificationBridge";
import { createServiceRoleClient } from "@msgf/lib/supabase/service-role";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/verify-badge/:badge_id
 *
 * Public Fan Hub metadata: forensic summary from `p4_manuscript_badges` (session counts, draft timestamps).
 * No authentication — badge UUID acts as an opaque capability (treat as secret link).
 */
export async function GET(_req: Request, context: { params: Promise<{ badge_id: string }> }) {
  const { badge_id } = await context.params;
  const id = typeof badge_id === "string" ? badge_id.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid badge_id" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const svc = new BadgeCertificationService(supabase);
    const payload = await svc.getPublicVerifyPayload(id);
    if (!payload) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=120",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
