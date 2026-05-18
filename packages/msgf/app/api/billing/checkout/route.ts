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
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    customerEmail = user?.email ?? null;
  } catch {
    customerEmail = null;
  }

  const result = await createStripeCheckoutSession({
    planId,
    origin,
    customerEmail,
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
