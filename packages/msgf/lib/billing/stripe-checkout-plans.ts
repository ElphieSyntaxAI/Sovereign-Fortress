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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
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
    tierMetadata: "individual_perpetual",
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
  entityId?: string | null;
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
    client_reference_id: params.entityId?.trim() || undefined,
    metadata: {
      msgf_plan: params.planId,
      msgf_tier: plan.tierMetadata,
      ...(params.entityId?.trim()
        ? { msgf_entity_id: params.entityId.trim() }
        : {}),
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
