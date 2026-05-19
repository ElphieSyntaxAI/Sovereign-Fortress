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
