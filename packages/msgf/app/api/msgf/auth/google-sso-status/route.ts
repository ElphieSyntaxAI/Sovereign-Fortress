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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
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
