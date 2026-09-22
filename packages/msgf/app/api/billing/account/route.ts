/**
 * Account billing: up to 3 Stripe cards, invoices, plan change, and cancel.
 * Card numbers stay in Stripe. This route stores nothing but ids Stripe already holds.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { CHECKOUT_PLANS, checkoutPlanIdFor } from "@/lib/billing/stripe-checkout-plans";
import { getPeriodSavingsReportsBundle } from "@/lib/services/period-savings-reports";
import { getStripe } from "@msgf/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export const MAX_ACCOUNT_CARDS = 3;

async function signedInUser() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function customerIdFor(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("p4_profiles")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  const id =
    typeof data?.stripe_customer_id === "string" ? data.stripe_customer_id.trim() : "";
  return id || null;
}

async function tenantIdFor(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("p4_profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  const id = typeof data?.tenant_id === "string" ? data.tenant_id.trim() : "";
  return id || userId;
}

export async function GET() {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });

  const customerId = await customerIdFor(user.id);
  const tenantId = await tenantIdFor(user.id);
  const stripe = customerId ? getStripe() : null;

  let cards: Array<{
    id: string;
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    is_default: boolean;
  }> = [];
  let invoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    amount_due: number;
    currency: string;
    created: number;
    hosted_invoice_url: string | null;
  }> = [];
  let subscription: {
    id: string;
    status: string;
    cancel_at_period_end: boolean;
    current_period_end: number | null;
    plan_label: string | null;
  } | null = null;

  if (stripe && customerId) {
    try {
    const customer = await stripe.customers.retrieve(customerId);
    const rawDefault =
      !customer.deleted ? customer.invoice_settings?.default_payment_method : null;
    const defaultPm =
      typeof rawDefault === "string" ? rawDefault : rawDefault?.id ?? "";
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
    cards = methods.data.slice(0, MAX_ACCOUNT_CARDS).map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? "card",
      last4: pm.card?.last4 ?? "",
      exp_month: pm.card?.exp_month ?? 0,
      exp_year: pm.card?.exp_year ?? 0,
      is_default: pm.id === defaultPm,
    }));
    const listed = await stripe.invoices.list({ customer: customerId, limit: 24 });
    invoices = listed.data.map((inv) => ({
      id: inv.id ?? "",
      number: inv.number,
      status: inv.status,
      amount_due: inv.amount_due,
      currency: inv.currency,
      created: inv.created,
      hosted_invoice_url: inv.hosted_invoice_url ?? null,
    }));
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
    const sub = subs.data[0];
    if (sub) {
      const price = sub.items.data[0]?.price;
      subscription = {
        id: sub.id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_end:
          typeof (sub as { current_period_end?: number }).current_period_end === "number"
            ? (sub as { current_period_end?: number }).current_period_end ?? null
            : null,
        plan_label: price?.nickname || price?.id || null,
      };
    }
    } catch {
      cards = [];
      invoices = [];
      subscription = null;
    }
  }

  let reports: Array<{
    period_key: string;
    period_label: string;
    period_kind: string;
    tokens_saved_proven: number;
  }> = [];
  try {
    const admin = createAdminClient();
    const bundle = await getPeriodSavingsReportsBundle({
      admin,
      tenantId,
      persistCurrent: false,
    });
    reports = [...bundle.weekly, ...bundle.monthly].map((row) => ({
      period_key: row.period_key,
      period_label: row.period_label,
      period_kind: row.period_kind,
      tokens_saved_proven: row.tokens_saved_proven,
    }));
  } catch {
    reports = [];
  }

  return NextResponse.json({
    ok: true,
    customer_linked: Boolean(customerId),
    card_limit: MAX_ACCOUNT_CARDS,
    cards,
    invoices,
    subscription,
    reports,
    tenant_id: tenantId,
    plans: Object.values(CHECKOUT_PLANS)
      .filter((plan) => plan.mode === "subscription")
      .map((plan) => ({ planId: plan.planId, product: plan.product, interval: plan.interval })),
  });
}

export async function POST(req: NextRequest) {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    paymentMethodId?: string;
    plan?: "pro_individual" | "startup_team" | "enterprise";
    interval?: "month" | "year";
  };
  const customerId = await customerIdFor(user.id);
  const stripe = getStripe();

  if (body.action === "add_card") {
    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "No Stripe customer yet. Choose a plan first." },
        { status: 400 }
      );
    }
    const existing = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
    if (existing.data.length >= MAX_ACCOUNT_CARDS) {
      return NextResponse.json(
        { ok: false, error: "Three cards are already saved. Remove one to add another." },
        { status: 400 }
      );
    }
    const origin = req.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      success_url: `${origin}/account?card=saved`,
      cancel_url: `${origin}/account`,
      payment_method_types: ["card"],
    });
    return NextResponse.json({ ok: true, url: session.url });
  }

  if (body.action === "detach" || body.action === "default") {
    if (!customerId || !body.paymentMethodId) {
      return NextResponse.json({ ok: false, error: "Card required." }, { status: 400 });
    }
    const pm = await stripe.paymentMethods.retrieve(body.paymentMethodId);
    const owner = typeof pm.customer === "string" ? pm.customer : pm.customer?.id ?? "";
    if (owner !== customerId) {
      return NextResponse.json({ ok: false, error: "Card not on this account." }, { status: 403 });
    }
    if (body.action === "detach") {
      await stripe.paymentMethods.detach(body.paymentMethodId);
    } else {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: body.paymentMethodId },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "cancel") {
    if (!customerId) {
      return NextResponse.json({ ok: false, error: "No subscription." }, { status: 400 });
    }
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
    const sub = subs.data[0];
    if (!sub) return NextResponse.json({ ok: false, error: "No active subscription." }, { status: 400 });
    const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    return NextResponse.json({
      ok: true,
      current_period_end:
        typeof (updated as { current_period_end?: number }).current_period_end === "number"
          ? (updated as { current_period_end?: number }).current_period_end
          : null,
    });
  }

  if (body.action === "change_plan") {
    if (!body.plan) {
      return NextResponse.json({ ok: false, error: "Plan required." }, { status: 400 });
    }
    const planId = checkoutPlanIdFor(body.plan, body.interval ?? "month");
    const priceId = process.env[CHECKOUT_PLANS[planId].priceEnvKey]?.trim();
    if (!priceId) {
      return NextResponse.json({ ok: false, error: "Plan price is not configured." }, { status: 500 });
    }
    if (customerId) {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      const sub = subs.data[0];
      const item = sub?.items.data[0];
      if (sub && item) {
        await stripe.subscriptions.update(sub.id, {
          items: [{ id: item.id, price: priceId }],
          cancel_at_period_end: false,
          proration_behavior: "create_prorations",
        });
        return NextResponse.json({ ok: true, updated: true });
      }
    }
    return NextResponse.json({ ok: true, checkout: true, plan: body.plan, interval: body.interval ?? "month" });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
