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
/** Client-safe checkout plan identifiers (no Stripe SDK). */

export type CheckoutProductId = "pro_individual" | "startup_team" | "enterprise";
export type CheckoutInterval = "month" | "year";
export type CheckoutPlanId =
  | "pro_individual"
  | "pro_individual_yearly"
  | "startup_team"
  | "startup_team_yearly"
  | "enterprise"
  | "enterprise_yearly";

export function checkoutPlanIdFor(
  product: CheckoutProductId,
  interval: CheckoutInterval = "month"
): CheckoutPlanId {
  return interval === "year" ? (`${product}_yearly` as CheckoutPlanId) : product;
}

export function checkoutProductFromPlanId(planId: string): CheckoutProductId | "" {
  const p = planId.trim();
  if (p === "pro_individual" || p === "pro_individual_yearly") return "pro_individual";
  if (p === "startup_team" || p === "startup_team_yearly") return "startup_team";
  if (p === "enterprise" || p === "enterprise_yearly") return "enterprise";
  return "";
}
