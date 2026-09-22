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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * M3 Stripe → p4_profiles entitlement writers (Checkout + subscription lifecycle).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import { resolveOrCreateCompanyForAdmin } from "@/lib/services/company-team";

/** Canonical statuses written to `p4_profiles.stripe_subscription_status`. */
export type MsgfStripeSubscriptionStatus = "active" | "past_due" | "canceled";

export const STARTUP_TEAM_PLAN_ID = "startup_team" as const;
export const PRO_INDIVIDUAL_PLAN_ID = "pro_individual" as const;

const ACTIVE_LIKE = new Set([
  "active",
  "trialing",
]);

const PAST_DUE_LIKE = new Set([
  "past_due",
  "unpaid",
  "incomplete",
]);

const CANCELED_LIKE = new Set([
  "canceled",
  "cancelled",
  "incomplete_expired",
]);

/**
 * Map Stripe subscription.status (and cousins) onto MSGF entitlement statuses.
 * Unknown values are lowercased and returned as-is so operators can inspect them.
 */
export function mapStripeSubscriptionStatus(
  raw: string | null | undefined
): MsgfStripeSubscriptionStatus | string {
  const status = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!status) return "canceled";
  if (ACTIVE_LIKE.has(status)) return "active";
  if (PAST_DUE_LIKE.has(status)) return "past_due";
  if (CANCELED_LIKE.has(status)) return "canceled";
  return status;
}

export function startupTeamStarterCredits(): number {
  const parsed = Number.parseInt(
    process.env.MSGF_STARTUP_TEAM_STARTER_CREDITS?.trim() ||
      process.env.MSGF_REGISTRATION_STARTER_CREDITS?.trim() ||
      "100",
    10
  );
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 100;
}

export function resolveCheckoutEntityId(session: {
  metadata?: Stripe.Metadata | null;
  client_reference_id?: string | null;
}): string {
  return (
    session.metadata?.msgf_entity_id?.trim() ||
    session.client_reference_id?.trim() ||
    ""
  );
}

export function resolveCheckoutPlanId(session: {
  metadata?: Stripe.Metadata | null;
}): string {
  return session.metadata?.msgf_plan?.trim() ?? "";
}

export function resolveSeatQuantity(params: {
  metadata?: Stripe.Metadata | null;
  fallback?: number;
}): number {
  const fromMeta = Number.parseInt(
    params.metadata?.msgf_seat_quantity?.trim() || "",
    10
  );
  if (Number.isFinite(fromMeta) && fromMeta >= 1) {
    return Math.min(99, fromMeta);
  }
  const fallback = params.fallback ?? 1;
  return Math.max(1, Math.min(99, Math.floor(fallback)));
}

export function stripeIdFromExpandable(
  value: string | { id?: string } | null | undefined
): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return String(value.id ?? "").trim();
}

export type StartupTeamActivationResult = {
  entityId: string;
  companyId: string;
  seatLimit: number;
  credits: number;
  subscriptionId: string | null;
  customerId: string | null;
};

/**
 * Activate Startup Team after `checkout.session.completed`.
 * Sets monthly license + active Stripe status, seeds credits, allocates seats on company.
 */
export async function activateStartupTeamSubscription(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
  seatQuantity?: number;
  subscriptionId?: string | null;
  customerId?: string | null;
}): Promise<StartupTeamActivationResult | null> {
  const entityId = params.entityId.trim();
  if (!entityId) return null;

  const seatLimit = Math.max(1, Math.min(99, Math.floor(params.seatQuantity ?? 1)));
  const credits = startupTeamStarterCredits();
  const subscriptionId = params.subscriptionId?.trim() || null;
  const customerId = params.customerId?.trim() || null;

  const { data: existing } = await params.adminSupabase
    .from("p4_profiles")
    .select("company_id, current_credits, tier_id")
    .eq("user_id", entityId)
    .maybeSingle();

  const existingCompanyId =
    typeof existing?.company_id === "string" && existing.company_id.trim()
      ? existing.company_id.trim()
      : null;

  const companyId = await resolveOrCreateCompanyForAdmin(
    params.adminSupabase,
    entityId,
    existingCompanyId,
    false
  );

  await params.adminSupabase
    .from("msgf_companies")
    .update({
      seat_limit: seatLimit,
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
    })
    .eq("id", companyId);

  const existingCredits = Number(existing?.current_credits ?? 0);
  const nextCredits = Math.max(existingCredits, credits);

  const { error } = await params.adminSupabase
    .from("p4_profiles")
    .update({
      billing_license_type: "monthly",
      stripe_subscription_status: "active",
      current_credits: nextCredits,
      company_id: companyId,
      team_platform_role: "admin",
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
      ...(customerId ? { stripe_customer_id: customerId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", entityId);

  if (error) {
    console.warn("[stripe-entitlements] startup_team activation failed:", error.message);
    return null;
  }

  return {
    entityId,
    companyId,
    seatLimit,
    credits: nextCredits,
    subscriptionId,
    customerId,
  };
}

export async function syncProfileStripeSubscriptionStatus(params: {
  adminSupabase: SupabaseClient;
  entityId?: string | null;
  subscriptionId?: string | null;
  customerId?: string | null;
  status: string;
  seatQuantity?: number | null;
}): Promise<{ updated: number; status: string }> {
  const status = mapStripeSubscriptionStatus(params.status);
  const entityId = params.entityId?.trim() || "";
  const subscriptionId = params.subscriptionId?.trim() || "";
  const customerId = params.customerId?.trim() || "";

  const patch: Record<string, unknown> = {
    stripe_subscription_status: status,
    updated_at: new Date().toISOString(),
  };
  if (subscriptionId) patch.stripe_subscription_id = subscriptionId;
  if (customerId) patch.stripe_customer_id = customerId;
  if (status === "active" || status === "past_due") {
    patch.billing_license_type = "monthly";
  }

  let updated = 0;

  if (entityId) {
    const { error, count } = await params.adminSupabase
      .from("p4_profiles")
      .update(patch, { count: "exact" })
      .eq("user_id", entityId);
    if (error) {
      console.warn("[stripe-entitlements] status sync by entity failed:", error.message);
    } else {
      updated = count ?? 1;
    }
  } else if (subscriptionId) {
    const { error, count } = await params.adminSupabase
      .from("p4_profiles")
      .update(patch, { count: "exact" })
      .eq("stripe_subscription_id", subscriptionId);
    if (error) {
      console.warn(
        "[stripe-entitlements] status sync by subscription failed:",
        error.message
      );
    } else {
      updated = count ?? 0;
    }
  } else if (customerId) {
    const { error, count } = await params.adminSupabase
      .from("p4_profiles")
      .update(patch, { count: "exact" })
      .eq("stripe_customer_id", customerId);
    if (error) {
      console.warn("[stripe-entitlements] status sync by customer failed:", error.message);
    } else {
      updated = count ?? 0;
    }
  }

  if (subscriptionId && params.seatQuantity != null && params.seatQuantity >= 1) {
    await params.adminSupabase
      .from("msgf_companies")
      .update({
        seat_limit: Math.min(99, Math.floor(params.seatQuantity)),
        stripe_subscription_id: subscriptionId,
      })
      .eq("stripe_subscription_id", subscriptionId);
  }

  return { updated, status };
}

export async function markProfilesPastDueFromInvoice(params: {
  adminSupabase: SupabaseClient;
  subscriptionId?: string | null;
  customerId?: string | null;
  entityId?: string | null;
}): Promise<{ updated: number }> {
  return syncProfileStripeSubscriptionStatus({
    adminSupabase: params.adminSupabase,
    entityId: params.entityId,
    subscriptionId: params.subscriptionId,
    customerId: params.customerId,
    status: "past_due",
  });
}

export function entityIdFromStripeMetadata(
  metadata: Stripe.Metadata | null | undefined
): string {
  return metadata?.msgf_entity_id?.trim() || "";
}
