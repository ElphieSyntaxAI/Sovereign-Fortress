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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import { headers } from "next/headers";
import type Stripe from "stripe";

import { checkoutProductFromPlanId } from "@/lib/billing/stripe-checkout-types";
import { activateIndividualProSubscription } from "@/lib/services/individual-perpetual-license";
import {
  activateStartupTeamSubscription,
  ENTERPRISE_PLAN_ID,
  entityIdFromStripeMetadata,
  markProfilesPastDueFromInvoice,
  PRO_INDIVIDUAL_PLAN_ID,
  resolveCheckoutEntityId,
  resolveCheckoutPlanId,
  resolveSeatQuantity,
  STARTUP_TEAM_PLAN_ID,
  stripeIdFromExpandable,
  syncProfileStripeSubscriptionStatus,
} from "@/lib/services/stripe-entitlements";
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
      const entityId = resolveCheckoutEntityId(session);
      const plan = resolveCheckoutPlanId(session);
      const product = checkoutProductFromPlanId(plan);
      const subscriptionId = stripeIdFromExpandable(session.subscription);
      const customerId = stripeIdFromExpandable(session.customer);
      const seatQuantity = resolveSeatQuantity({
        metadata: session.metadata,
        fallback: 1,
      });

      if (entityId && product === PRO_INDIVIDUAL_PLAN_ID) {
        try {
          const admin = createAdminClient();
          await activateIndividualProSubscription({
            adminSupabase: admin,
            entityId,
            purchaseDate: new Date(),
            subscriptionId,
            customerId,
          });
          if (customerId) {
            await admin
              .from("p4_profiles")
              .update({
                stripe_customer_id: customerId,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", entityId);
          }
        } catch (e) {
          console.error("[stripe-webhook] Individual Pro activation failed:", e);
        }
      }

      if (entityId && (product === STARTUP_TEAM_PLAN_ID || product === ENTERPRISE_PLAN_ID)) {
        try {
          const admin = createAdminClient();
          await activateStartupTeamSubscription({
            adminSupabase: admin,
            entityId,
            seatQuantity,
            subscriptionId,
            customerId,
          });
        } catch (e) {
          console.error(`[stripe-webhook] ${product} activation failed:`, e);
        }
      }

      await msgfLogger.info(tenantId, "STRIPE_PAYMENT_SUCCESS", "stripe-gateway", {
        sessionId: session.id,
        amount: session.amount_total,
        msgf_plan: plan || null,
        msgf_entity_id: entityId || null,
        msgf_seat_quantity: seatQuantity,
        stripe_subscription_id: subscriptionId || null,
      });
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = tenantFrom(subscription);
      const entityId = entityIdFromStripeMetadata(subscription.metadata);
      const customerId = stripeIdFromExpandable(subscription.customer);
      const rawStatus =
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : subscription.status;
      const seatQuantity = resolveSeatQuantity({
        metadata: subscription.metadata,
        fallback: subscription.items?.data?.[0]?.quantity ?? 1,
      });

      try {
        const admin = createAdminClient();
        const result = await syncProfileStripeSubscriptionStatus({
          adminSupabase: admin,
          entityId: entityId || null,
          subscriptionId: subscription.id,
          customerId,
          status: rawStatus,
          seatQuantity:
            event.type === "customer.subscription.deleted" ? null : seatQuantity,
        });
        await msgfLogger.info(tenantId, "STRIPE_SUBSCRIPTION_SYNC", "stripe-gateway", {
          subscriptionId: subscription.id,
          stripe_status: rawStatus,
          mapped_status: result.status,
          updated: result.updated,
          msgf_entity_id: entityId || null,
          event_type: event.type,
        });
      } catch (e) {
        console.error("[stripe-webhook] subscription sync failed:", e);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = tenantFrom(invoice);
      const subscriptionId = stripeIdFromExpandable(
        (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null })
          .subscription
      );
      const customerId = stripeIdFromExpandable(invoice.customer);
      const entityId = entityIdFromStripeMetadata(invoice.metadata);

      try {
        const admin = createAdminClient();
        const result = await markProfilesPastDueFromInvoice({
          adminSupabase: admin,
          subscriptionId,
          customerId,
          entityId: entityId || null,
        });
        await msgfLogger.violation(tenantId, "STRIPE_PAYMENT_FAILURE", "stripe-gateway", {
          invoiceId: invoice.id,
          stripe_subscription_id: subscriptionId || null,
          stripe_customer_id: customerId || null,
          profiles_marked_past_due: result.updated,
        });
      } catch (e) {
        console.error("[stripe-webhook] payment_failed past_due mark failed:", e);
        await msgfLogger.violation(tenantId, "STRIPE_PAYMENT_FAILURE", "stripe-gateway", {
          invoiceId: invoice.id,
        });
      }
      break;
    }

    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
