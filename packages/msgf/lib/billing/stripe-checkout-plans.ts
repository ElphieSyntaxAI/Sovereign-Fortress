/**
 * Stripe Checkout session initialization for MSGF pricing tiers.
 */

import { getStripe } from "@msgf/lib/stripe";

export type CheckoutPlanId = "pro_individual" | "startup_team";

export type CheckoutPlanConfig = {
  planId: CheckoutPlanId;
  priceEnvKey: string;
  tierMetadata: string;
  defaultQuantity: number;
  mode: "subscription" | "payment";
};

export const CHECKOUT_PLANS: Record<CheckoutPlanId, CheckoutPlanConfig> = {
  pro_individual: {
    planId: "pro_individual",
    priceEnvKey: "STRIPE_PRICE_PRO_INDIVIDUAL",
    tierMetadata: "paid_individual",
    defaultQuantity: 1,
    mode: "payment",
  },
  startup_team: {
    planId: "startup_team",
    priceEnvKey: "STRIPE_PRICE_STARTUP_TEAM",
    tierMetadata: "corporate_startup",
    defaultQuantity: 1,
    mode: "subscription",
  },
};

export type CheckoutSessionResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; error: string; code: string; status: number };

export async function createStripeCheckoutSession(params: {
  planId: CheckoutPlanId;
  origin: string;
  customerEmail?: string | null;
  quantity?: number;
}): Promise<CheckoutSessionResult> {
  const plan = CHECKOUT_PLANS[params.planId];
  const priceId = process.env[plan.priceEnvKey]?.trim();

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return {
      ok: false,
      error: "Secure checkout is not configured on this environment.",
      code: "STRIPE_NOT_CONFIGURED",
      status: 503,
    };
  }

  if (!priceId) {
    return {
      ok: false,
      error: `Checkout price is not configured (${plan.priceEnvKey}).`,
      code: "STRIPE_PRICE_MISSING",
      status: 503,
    };
  }

  const origin = params.origin.replace(/\/$/, "");
  const quantity = Math.max(1, Math.min(99, Math.floor(params.quantity ?? plan.defaultQuantity)));

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return {
      ok: false,
      error: "Secure checkout is not configured on this environment.",
      code: "STRIPE_NOT_CONFIGURED",
      status: 503,
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: plan.mode,
    line_items: [{ price: priceId, quantity }],
    success_url: `${origin}/pricing?checkout=success&plan=${params.planId}`,
    cancel_url: `${origin}/pricing?checkout=cancelled&plan=${params.planId}`,
    customer_email: params.customerEmail?.trim() || undefined,
    allow_promotion_codes: true,
    metadata: {
      msgf_plan: params.planId,
      msgf_tier: plan.tierMetadata,
    },
    ...(plan.mode === "subscription"
      ? {
          subscription_data: {
            metadata: {
              msgf_plan: params.planId,
              msgf_tier: plan.tierMetadata,
            },
          },
        }
      : {}),
  });

  if (!session.url) {
    return {
      ok: false,
      error: "Stripe did not return a checkout URL.",
      code: "STRIPE_SESSION_URL_MISSING",
      status: 502,
    };
  }

  return { ok: true, url: session.url, sessionId: session.id };
}
