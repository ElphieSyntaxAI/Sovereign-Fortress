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
 * POST /api/shadow-trial/full-access/activate — bind session user and grant 72h Individual Pro.
 */

import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { activateShadowTrialFullAccess } from "@/lib/services/shadow-trial-full-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

const bodySchema = z
  .object({
    t: z.string().trim().min(8).max(256),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Missing status token." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const hdrs = await headers();
    const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id || !user.email) {
      return NextResponse.json(
        { ok: false, error: "Sign in with the magic link sent to your trial email." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();
    const result = await activateShadowTrialFullAccess(admin, {
      statusToken: parsed.data.t,
      userId: user.id,
      email: user.email,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Full-access activate failed.";
    console.error("[shadow-trial/full-access/activate]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
