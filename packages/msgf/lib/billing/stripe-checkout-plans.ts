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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Stripe Checkout session initialization for MSGF pricing tiers.
 */

import { getStripe } from "@msgf/lib/stripe";

import type {
  CheckoutInterval,
  CheckoutPlanId,
  CheckoutProductId,
} from "./stripe-checkout-types";

export type {
  CheckoutInterval,
  CheckoutPlanId,
  CheckoutProductId,
} from "./stripe-checkout-types";
export { checkoutPlanIdFor, checkoutProductFromPlanId } from "./stripe-checkout-types";

export type CheckoutPlanConfig = {
  planId: CheckoutPlanId;
  priceEnvKey: string;
  tierMetadata: string;
  defaultQuantity: number;
  mode: "subscription" | "payment";
  interval: CheckoutInterval;
  product: CheckoutProductId;
};

export const CHECKOUT_PLANS: Record<CheckoutPlanId, CheckoutPlanConfig> = {
  pro_individual: {
    planId: "pro_individual",
    product: "pro_individual",
    interval: "month",
    priceEnvKey: "STRIPE_PRICE_PRO_INDIVIDUAL",
    /** Monthly Pro. Recreate this Stripe Price as $29/mo subscription — do not reuse the old $99 one-time ID. */
    tierMetadata: "individual_pro",
    defaultQuantity: 1,
    mode: "subscription",
  },
  pro_individual_yearly: {
    planId: "pro_individual_yearly",
    product: "pro_individual",
    interval: "year",
    priceEnvKey: "STRIPE_PRICE_PRO_INDIVIDUAL_YEARLY",
    tierMetadata: "individual_pro",
    defaultQuantity: 1,
    mode: "subscription",
  },
  startup_team: {
    planId: "startup_team",
    product: "startup_team",
    interval: "month",
    priceEnvKey: "STRIPE_PRICE_STARTUP_TEAM",
    /** Workspace subscription ($49/mo). Recreate if the live ID is still per-seat. */
    tierMetadata: "corporate_startup",
    defaultQuantity: 5,
    mode: "subscription",
  },
  startup_team_yearly: {
    planId: "startup_team_yearly",
    product: "startup_team",
    interval: "year",
    priceEnvKey: "STRIPE_PRICE_STARTUP_TEAM_YEARLY",
    tierMetadata: "corporate_startup",
    defaultQuantity: 5,
    mode: "subscription",
  },
  enterprise: {
    planId: "enterprise",
    product: "enterprise",
    interval: "month",
    priceEnvKey: "STRIPE_PRICE_ENTERPRISE",
    tierMetadata: "corporate_enterprise",
    defaultQuantity: 25,
    mode: "subscription",
  },
  enterprise_yearly: {
    planId: "enterprise_yearly",
    product: "enterprise",
    interval: "year",
    priceEnvKey: "STRIPE_PRICE_ENTERPRISE_YEARLY",
    tierMetadata: "corporate_enterprise",
    defaultQuantity: 25,
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
  if (!plan) {
    return {
      ok: false,
      error: "Invalid checkout plan.",
      code: "STRIPE_PLAN_INVALID",
      status: 400,
    };
  }
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

  const entityId = params.entityId?.trim() || "";
  const sharedMetadata: Record<string, string> = {
    msgf_plan: params.planId,
    msgf_product: plan.product,
    msgf_interval: plan.interval,
    msgf_tier: plan.tierMetadata,
    msgf_seat_quantity: String(quantity),
    ...(entityId ? { msgf_entity_id: entityId } : {}),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan.mode,
      line_items: [{ price: priceId, quantity }],
      success_url: `${origin}/pricing?checkout=success&plan=${params.planId}`,
      cancel_url: `${origin}/pricing?checkout=cancelled&plan=${params.planId}`,
      customer_email: params.customerEmail?.trim() || undefined,
      allow_promotion_codes: true,
      client_reference_id: entityId || undefined,
      metadata: sharedMetadata,
      ...(plan.mode === "subscription"
        ? {
            subscription_data: {
              metadata: sharedMetadata,
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
  } catch (e) {
    const stripeCode =
      e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    console.error("[stripe-checkout]", stripeCode || (e instanceof Error ? e.message : e));
    return {
      ok: false,
      error: "Stripe checkout could not start. Confirm test-mode price IDs.",
      code: stripeCode === "resource_missing" ? "STRIPE_PRICE_MISSING" : "STRIPE_CHECKOUT_FAILED",
      status: 503,
    };
  }
}
