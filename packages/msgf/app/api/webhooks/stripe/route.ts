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
import { headers } from "next/headers";
import type Stripe from "stripe";

import { activateIndividualPerpetualLicense } from "@/lib/services/individual-perpetual-license";
import { createAdminClient } from "@/utils/supabase/admin";
import { msgfLogger } from "@msgf/lib/logger";
import { getStripeWebhookClient } from "@msgf/lib/stripe";
import { tenantIdForNarrativeLog } from "@msgf/lib/tenant-ids";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return new Response("Webhook Error: Missing Stripe-Signature", { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret?.trim()) {
    return new Response("Webhook Error: STRIPE_WEBHOOK_SECRET is not configured", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = getStripeWebhookClient().webhooks.constructEvent(body, signature, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  const tenantFrom = (obj: { metadata?: Stripe.Metadata | null }) =>
    tenantIdForNarrativeLog(obj.metadata?.tenant_id?.trim() ?? "");

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = tenantFrom(session);
      const entityId =
        session.metadata?.msgf_entity_id?.trim() ||
        session.client_reference_id?.trim() ||
        "";
      const plan = session.metadata?.msgf_plan?.trim() ?? "";

      if (entityId && plan === "pro_individual") {
        try {
          const admin = createAdminClient();
          await activateIndividualPerpetualLicense({
            adminSupabase: admin,
            entityId,
            purchaseDate: new Date(),
          });
        } catch (e) {
          console.error("[stripe-webhook] INDIVIDUAL_PERPETUAL activation failed:", e);
        }
      }

      await msgfLogger.info(tenantId, "STRIPE_PAYMENT_SUCCESS", "stripe-gateway", {
        sessionId: session.id,
        amount: session.amount_total,
        msgf_plan: plan || null,
        msgf_entity_id: entityId || null,
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = tenantFrom(invoice);
      await msgfLogger.violation(tenantId, "STRIPE_PAYMENT_FAILURE", "stripe-gateway", {
        invoiceId: invoice.id,
      });
      break;
    }
    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
