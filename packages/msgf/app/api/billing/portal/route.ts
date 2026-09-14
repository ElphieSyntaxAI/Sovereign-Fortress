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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * POST /api/billing/portal — Stripe Customer Portal session for the signed-in user.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { getStripe } from "@msgf/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const hdrs = await headers();
    const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("p4_profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { ok: false, error: profileError.message },
        { status: 500 }
      );
    }

    const customerId =
      typeof profile?.stripe_customer_id === "string"
        ? profile.stripe_customer_id.trim()
        : "";

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "No Stripe customer on this account yet." },
        { status: 404 }
      );
    }

    let stripe;
    try {
      stripe = getStripe();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Billing portal is not configured." },
        { status: 503 }
      );
    }

    const origin = req.nextUrl.origin.replace(/\/$/, "");
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account`,
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Portal session did not return a URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Billing portal failed.";
    console.error("[billing/portal] POST", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
