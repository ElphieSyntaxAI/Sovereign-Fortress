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
import Stripe from "stripe";

/** Pinned to the API version shipped with the installed `stripe` package (see `node_modules/stripe/esm/apiVersion.d.ts`). */
const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

/**
 * `webhooks.constructEvent` verifies HMAC with the webhook signing secret only, but stripe-node
 * still requires a non-empty API key when constructing the client. Without this, `next build`
 * fails during "Collecting page data" when `STRIPE_SECRET_KEY` is not in the environment.
 */
const WEBHOOK_CLIENT_PLACEHOLDER_KEY = "sk_test_webhook_construct_only_00000000000000";

let stripeWebhookClient: Stripe | null = null;

/** Client for webhook signature verification. Safe to use when only calling `webhooks.constructEvent`. */
export function getStripeWebhookClient(): Stripe {
  if (!stripeWebhookClient) {
    const key = process.env.STRIPE_SECRET_KEY?.trim() || WEBHOOK_CLIENT_PLACEHOLDER_KEY;
    stripeWebhookClient = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return stripeWebhookClient;
}

let stripeBillingClient: Stripe | null = null;

/** Stripe client for live API calls — requires `STRIPE_SECRET_KEY`. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeBillingClient) {
    stripeBillingClient = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return stripeBillingClient;
}
