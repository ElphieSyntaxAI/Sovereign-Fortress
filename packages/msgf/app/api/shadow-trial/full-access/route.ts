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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * POST /api/shadow-trial/full-access — email a magic link to start 3-day Individual Pro.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requestShadowTrialFullAccess } from "@/lib/services/shadow-trial-full-access";
import { createAdminClient } from "@/utils/supabase/admin";

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

    const admin = createAdminClient();
    const result = await requestShadowTrialFullAccess(admin, parsed.data.t);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Full-access request failed.";
    console.error("[shadow-trial/full-access]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
