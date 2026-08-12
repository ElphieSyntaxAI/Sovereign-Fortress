/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * POST /api/shadow-trial/start — mint free 24h Shadow Proxy trial key.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { startShadowTrial } from "@/lib/services/shadow-trial";
import { createAdminClient } from "@/utils/supabase/admin";

const bodySchema = z
  .object({
    email: z.string().email().max(320),
    name: z.string().trim().max(120).optional().nullable(),
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
        { ok: false, error: "Invalid email.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const result = await startShadowTrial(admin, {
      email: parsed.data.email,
      name: parsed.data.name,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Shadow trial start failed.";
    console.error("[shadow-trial/start]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
