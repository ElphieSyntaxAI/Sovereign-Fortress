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
 * POST /api/beta-signup — public waitlist for MSGF beta / Author foundational testing.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { joinBetaWaitlist } from "@/lib/services/beta-waitlist";
import { createAdminClient } from "@/utils/supabase/admin";

const bodySchema = z
  .object({
    product: z.enum(["msgf", "author", "education"]),
    email: z.string().email().max(320),
    name: z.string().trim().max(120).optional().nullable(),
    note: z.string().trim().max(2000).optional().nullable(),
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
        { ok: false, error: "Invalid signup.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const result = await joinBetaWaitlist(admin, parsed.data);

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      reused: result.reused,
      message: result.reused
        ? "You're already on the list — we'll email you when a seat opens."
        : "You're on the list. We'll email you when a seat opens.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Beta signup failed.";
    console.error("[beta-signup]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
