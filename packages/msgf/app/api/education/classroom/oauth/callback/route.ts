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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * GET /api/education/classroom/oauth/callback
 * Completes Google OAuth and mints privacy-gated assignment instance.
 */
import { NextRequest, NextResponse } from "next/server";

import {
  classroomOAuthConfigured,
  completeClassroomOAuthLaunch,
  parseOAuthState,
} from "@/lib/education/classroom-oauth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    if (!classroomOAuthConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Classroom OAuth not configured", configured: false },
        { status: 503 }
      );
    }

    const sp = req.nextUrl.searchParams;
    const err = sp.get("error");
    if (err) {
      return NextResponse.json(
        { ok: false, error: err, description: sp.get("error_description") },
        { status: 400 }
      );
    }

    const code = sp.get("code");
    const state = sp.get("state");
    if (!code || !state) {
      return NextResponse.json({ error: "code and state required" }, { status: 400 });
    }

    const statePayload = parseOAuthState(state);
    if (!statePayload) {
      return NextResponse.json({ error: "invalid OAuth state" }, { status: 400 });
    }

    const admin = createAdminClient();
    const result = await completeClassroomOAuthLaunch({
      admin,
      code,
      statePayload,
    });

    return NextResponse.redirect(result.educationAppRedirect);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
