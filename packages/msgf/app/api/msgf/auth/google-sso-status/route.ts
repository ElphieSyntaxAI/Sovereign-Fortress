/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * GET /api/msgf/auth/google-sso-status — circuit + mock flags for AuthForm
 * POST body { event: "failure", reason? } — record OAuth failure (opens circuit)
 */
import { NextRequest, NextResponse } from "next/server";

import {
  isGoogleSsoCircuitOpen,
  recordGoogleSsoFailure,
} from "@/lib/services/google-sso-circuit";

export async function GET() {
  const circuit_open = await isGoogleSsoCircuitOpen();
  return NextResponse.json({
    ok: true,
    circuit_open,
    workspace_sso_enabled: process.env.MSGF_GOOGLE_WORKSPACE_SSO !== "0",
  });
}

export async function POST(req: NextRequest) {
  let body: { event?: string; reason?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty */
  }
  if (body.event === "failure") {
    const { open } = await recordGoogleSsoFailure(body.reason);
    return NextResponse.json({ ok: true, circuit_open: open });
  }
  return NextResponse.json({ ok: false, error: "Unknown event." }, { status: 400 });
}
