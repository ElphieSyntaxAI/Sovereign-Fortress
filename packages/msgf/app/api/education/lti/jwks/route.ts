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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
/**
 * GET /api/education/lti/jwks — tool public keys for Canvas developer key registration.
 */
import { NextResponse } from "next/server";

import { getToolPublicJwks } from "@/lib/education/lti/lti-tool-jwks";

export async function GET() {
  try {
    const jwks = await getToolPublicJwks();
    return NextResponse.json(jwks, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
