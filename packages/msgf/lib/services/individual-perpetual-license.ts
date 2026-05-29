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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/**
 * INDIVIDUAL_PERPETUAL — 365-day managed cloud window + profile activation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const INDIVIDUAL_PERPETUAL_LICENSE_TYPE = "INDIVIDUAL_PERPETUAL" as const;

/** Managed cloud consensus coverage window (ms). */
export const INDIVIDUAL_PERPETUAL_MANAGED_CLOUD_DAYS = 365;

export const MSGF_PERPETUAL_MANAGED_CLOUD_MS =
  INDIVIDUAL_PERPETUAL_MANAGED_CLOUD_DAYS * 24 * 60 * 60 * 1000;

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

export function isIndividualPerpetualLicenseType(
  licenseType: string | null | undefined
): boolean {
  return (
    licenseType?.trim().toUpperCase() === INDIVIDUAL_PERPETUAL_LICENSE_TYPE
  );
}

export function evaluateManagedCloudWindow(
  purchaseDate: Date | null,
  now: Date = new Date()
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
  const withinManagedCloudYear = elapsedMs >= 0 && elapsedMs < MSGF_PERPETUAL_MANAGED_CLOUD_MS;

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
 */
export async function activateIndividualPerpetualLicense(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
  purchaseDate?: Date;
}): Promise<void> {
  const entityId = params.entityId.trim();
  if (!entityId) return;

  const purchasedAt = params.purchaseDate ?? new Date();

  const { error } = await params.adminSupabase
    .from("p4_profiles")
    .update({
      license_type: INDIVIDUAL_PERPETUAL_LICENSE_TYPE,
      license_purchase_date: purchasedAt.toISOString(),
      billing_license_type: "lifetime",
    })
    .eq("user_id", entityId);

  if (error) {
    console.warn("[individual-perpetual-license] activation failed:", error.message);
  }
}
