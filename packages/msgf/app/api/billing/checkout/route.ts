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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
/**
 * POST /api/billing/checkout — initialize Stripe Checkout for Pro / Startup tiers.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import {
  createStripeCheckoutSession,
  type CheckoutPlanId,
} from "@/lib/billing/stripe-checkout-plans";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

const BodySchema = z.object({
  plan: z.enum(["pro_individual", "startup_team"]),
  quantity: z.number().int().min(1).max(99).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid plan.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const planId = parsed.data.plan as CheckoutPlanId;
  const origin = req.nextUrl.origin;

  let customerEmail: string | null = null;
  let entityId: string | null = null;
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    customerEmail = user?.email ?? null;
    entityId = user?.id ?? null;
  } catch {
    customerEmail = null;
    entityId = null;
  }

  const result = await createStripeCheckoutSession({
    planId,
    origin,
    customerEmail,
    entityId,
    quantity: parsed.data.quantity,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    url: result.url,
    sessionId: result.sessionId,
  });
}
