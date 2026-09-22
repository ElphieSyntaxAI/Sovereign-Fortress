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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * Individual Pro — monthly subscription activation + 1,200-credit managed-consensus window.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const INDIVIDUAL_PERPETUAL_LICENSE_TYPE = "INDIVIDUAL_PERPETUAL" as const;
export const INDIVIDUAL_TRIAL_3D_LICENSE_TYPE = "INDIVIDUAL_TRIAL_3D" as const;

/** Managed cloud consensus coverage window (ms). */
export const INDIVIDUAL_PERPETUAL_MANAGED_CLOUD_DAYS = 365;
export const INDIVIDUAL_TRIAL_3D_HOURS = 72;

export const MSGF_PERPETUAL_MANAGED_CLOUD_MS =
  INDIVIDUAL_PERPETUAL_MANAGED_CLOUD_DAYS * 24 * 60 * 60 * 1000;

export const INDIVIDUAL_TRIAL_3D_MANAGED_CLOUD_MS =
  INDIVIDUAL_TRIAL_3D_HOURS * 60 * 60 * 1000;

export type IndividualPerpetualProfile = {
  licenseType: string | null;
  licensePurchaseDate: Date | null;
  billingLicenseType: string | null;
  companyId: string | null;
  profileFound: boolean;
};

export type ManagedCloudWindowEvaluation = {
  withinManagedCloudYear: boolean;
  managedCloudExpired: boolean;
  daysSincePurchase: number | null;
  purchaseDateIso: string | null;
};

export function isIndividualTrial3dLicenseType(
  licenseType: string | null | undefined
): boolean {
  return licenseType?.trim().toUpperCase() === INDIVIDUAL_TRIAL_3D_LICENSE_TYPE;
}

export function isIndividualPerpetualLicenseType(
  licenseType: string | null | undefined
): boolean {
  const t = licenseType?.trim().toUpperCase();
  return (
    t === INDIVIDUAL_PERPETUAL_LICENSE_TYPE ||
    t === INDIVIDUAL_TRIAL_3D_LICENSE_TYPE
  );
}

export function managedCloudWindowMsForLicenseType(
  licenseType: string | null | undefined
): number {
  return isIndividualTrial3dLicenseType(licenseType)
    ? INDIVIDUAL_TRIAL_3D_MANAGED_CLOUD_MS
    : MSGF_PERPETUAL_MANAGED_CLOUD_MS;
}

export function evaluateManagedCloudWindow(
  purchaseDate: Date | null,
  now: Date = new Date(),
  windowMs: number = MSGF_PERPETUAL_MANAGED_CLOUD_MS
): ManagedCloudWindowEvaluation {
  if (!purchaseDate || Number.isNaN(purchaseDate.getTime())) {
    return {
      withinManagedCloudYear: false,
      managedCloudExpired: true,
      daysSincePurchase: null,
      purchaseDateIso: null,
    };
  }

  const elapsedMs = now.getTime() - purchaseDate.getTime();
  const daysSincePurchase = Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
  const coverageMs =
    Number.isFinite(windowMs) && windowMs > 0
      ? windowMs
      : MSGF_PERPETUAL_MANAGED_CLOUD_MS;
  const withinManagedCloudYear = elapsedMs >= 0 && elapsedMs < coverageMs;

  return {
    withinManagedCloudYear,
    managedCloudExpired: !withinManagedCloudYear,
    daysSincePurchase,
    purchaseDateIso: purchaseDate.toISOString(),
  };
}

export async function loadIndividualPerpetualProfile(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
}): Promise<IndividualPerpetualProfile> {
  const { data, error } = await params.adminSupabase
    .from("p4_profiles")
    .select("license_type, license_purchase_date, billing_license_type, company_id")
    .eq("user_id", params.entityId)
    .maybeSingle();

  if (error || !data) {
    return {
      licenseType: null,
      licensePurchaseDate: null,
      billingLicenseType: null,
      companyId: null,
      profileFound: false,
    };
  }

  const purchaseRaw = data.license_purchase_date;
  let licensePurchaseDate: Date | null = null;
  if (purchaseRaw) {
    const d = new Date(String(purchaseRaw));
    licensePurchaseDate = Number.isNaN(d.getTime()) ? null : d;
  }

  const companyId =
    typeof data.company_id === "string" && data.company_id.trim()
      ? data.company_id.trim()
      : null;

  return {
    licenseType: typeof data.license_type === "string" ? data.license_type.trim() : null,
    licensePurchaseDate,
    billingLicenseType:
      typeof data.billing_license_type === "string"
        ? data.billing_license_type.trim()
        : null,
    companyId,
    profileFound: true,
  };
}

/**
 * Stripe checkout / webhook — stamp perpetual license on the purchaser profile.
 * @deprecated Pro is monthly. Use {@link activateIndividualProSubscription}.
 */
export async function activateIndividualPerpetualLicense(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
  purchaseDate?: Date;
}): Promise<void> {
  return activateIndividualProSubscription(params);
}

/**
 * Stripe Checkout — activate Individual Pro as a monthly subscription.
 * Routing still uses `INDIVIDUAL_PERPETUAL` license_type for the 1,200-credit
 * managed-consensus path; Pulse entitlement is gated on Stripe `active`.
 */
export async function activateIndividualProSubscription(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
  purchaseDate?: Date;
  subscriptionId?: string | null;
  customerId?: string | null;
}): Promise<void> {
  const entityId = params.entityId.trim();
  if (!entityId) return;

  const purchasedAt = params.purchaseDate ?? new Date();
  const subscriptionId = params.subscriptionId?.trim() || null;
  const customerId = params.customerId?.trim() || null;

  const { error } = await params.adminSupabase
    .from("p4_profiles")
    .update({
      license_type: INDIVIDUAL_PERPETUAL_LICENSE_TYPE,
      license_purchase_date: purchasedAt.toISOString(),
      billing_license_type: "monthly",
      stripe_subscription_status: "active",
      updated_at: purchasedAt.toISOString(),
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    .eq("user_id", entityId);

  if (error) {
    console.warn("[individual-pro-subscription] activation failed:", error.message);
  }
}
