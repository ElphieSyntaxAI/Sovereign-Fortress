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
 * Distribution Build ID: MSGF-5e9b050-20260519T172718Z-internal
 */
/**
 * Step 5 (CONVERGE) — Individual Free, INDIVIDUAL_PERPETUAL, Corporate routing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isPersonalSandboxTenant,
  TENANT_INDIV_PREFIX,
} from "@/lib/msgf-tenant-governance";
import type { BillingLicenseType } from "@/lib/middleware/entitlementGuard";
import {
  decryptTenantProviderCredential,
  listTenantProviderCredentialPresence,
} from "@/lib/services/tenant-provider-credentials";
import type { PulseLicenseContext } from "@/lib/services/pulse-license";
import {
  evaluateManagedCloudWindow,
  isIndividualPerpetualLicenseType,
  loadIndividualPerpetualProfile,
  type ManagedCloudWindowEvaluation,
} from "@/lib/services/individual-perpetual-license";
import {
  evaluatePerpetualMonthlySliceUsage,
  MANAGED_CLOUD_EXPIRED_BYPASS_WARNING,
  PERPETUAL_SOFT_CAP_EXCEEDED_MESSAGE,
  type PerpetualMonthlySliceUsage,
} from "@/lib/services/paid-individual-usage";

export const CONVERGE_CONSENSUS_BYPASS_WARNING =
  "Consensus layer bypassed. Provide Gemini & Claude keys in your dashboard or project configuration to unlock premium cloud validation." as const;

export const MSGF_ALLOWANCE_STATE_SOFT_CAP = "soft_cap_exceeded" as const;

export type TenantCommercialSegment =
  | "individual_free"
  | "individual_perpetual"
  | "corporate_paid";

export type ResolvedByokKeys = {
  gemini: string | null;
  anthropic: string | null;
  bothPresent: boolean;
  sources: {
    gemini: "header" | "tenant_vault" | "none";
    anthropic: "header" | "tenant_vault" | "none";
  };
};

type FreeTierConvergeRouting =
  | {
      segment: "individual_free";
      action: "run_byok_converge";
      byok: ResolvedByokKeys & { bothPresent: true };
      managedCloudExpired?: boolean;
    }
  | {
      segment: "individual_free";
      action: "bypass_converge_baseline";
      byok: ResolvedByokKeys;
      managedCloudExpired?: boolean;
    };

export type ConvergeConsensusRouting =
  | FreeTierConvergeRouting
  | {
      segment: "individual_perpetual";
      action: "run_perpetual_platform_converge";
      byok: ResolvedByokKeys;
      monthlyUsage: PerpetualMonthlySliceUsage;
      managedWindow: ManagedCloudWindowEvaluation;
    }
  | {
      segment: "individual_perpetual";
      action: "run_byok_converge";
      byok: ResolvedByokKeys & { bothPresent: true };
      monthlyUsage: PerpetualMonthlySliceUsage;
      managedWindow: ManagedCloudWindowEvaluation;
      allowanceState: typeof MSGF_ALLOWANCE_STATE_SOFT_CAP;
    }
  | {
      segment: "individual_perpetual";
      action: "soft_cap_exceeded_ide_degraded";
      byok: ResolvedByokKeys;
      monthlyUsage: PerpetualMonthlySliceUsage;
      managedWindow: ManagedCloudWindowEvaluation;
      allowanceState: typeof MSGF_ALLOWANCE_STATE_SOFT_CAP;
    }
  | {
      segment: "individual_perpetual";
      action: "managed_cloud_expired_bypass";
      byok: ResolvedByokKeys;
      managedWindow: ManagedCloudWindowEvaluation;
    }
  | {
      segment: "corporate_paid";
      action: "run_corporate_system_converge";
      byok: ResolvedByokKeys;
      enterpriseVaultConfigured: boolean;
    };

const CORPORATE_TIER_SLUGS = new Set([
  "startup",
  "corporate_startup",
  "enterprise",
  "corporate_enterprise",
  "premium",
  "premium_tier",
]);

const PERPETUAL_TIER_SLUGS = new Set([
  "paid_individual",
  "individual_premium",
  "individual_pro",
  "paid_individual_tier",
  "individual_perpetual",
]);

export type PulseTenantCommercialContext = {
  segment: TenantCommercialSegment;
  billingLicenseType: BillingLicenseType | null;
  companyId: string | null;
  profileFound: boolean;
  licenseType: string | null;
  licensePurchaseDate: string | null;
};

function normalizeTierSlug(tierId: string): string {
  return tierId.trim().toLowerCase().replace(/\s+/g, "_");
}

function isIdeSandboxLicense(license: PulseLicenseContext): boolean {
  return license.licenseId.startsWith("ide-sandbox-");
}

export function classifyTenantCommercialSegment(params: {
  tenantId: string;
  license: PulseLicenseContext;
  billingLicenseType: BillingLicenseType | null;
  companyId: string | null;
  licenseType: string | null;
}): TenantCommercialSegment {
  const { tenantId, license, billingLicenseType, companyId, licenseType } = params;
  const tier = normalizeTierSlug(license.tierId);

  if (CORPORATE_TIER_SLUGS.has(tier)) {
    return "corporate_paid";
  }

  if (companyId) {
    return "corporate_paid";
  }

  if (isIndividualPerpetualLicenseType(licenseType)) {
    return "individual_perpetual";
  }

  if (PERPETUAL_TIER_SLUGS.has(tier)) {
    return "individual_perpetual";
  }

  if (billingLicenseType === "lifetime" && !companyId) {
    return "individual_perpetual";
  }

  if (isPersonalSandboxTenant(tenantId) || tenantId.startsWith(TENANT_INDIV_PREFIX)) {
    return "individual_free";
  }

  if (isIdeSandboxLicense(license)) {
    return "individual_free";
  }

  if (billingLicenseType === "free") {
    return "individual_free";
  }

  if (billingLicenseType === "monthly") {
    return "corporate_paid";
  }

  return "individual_free";
}

export async function loadPulseTenantCommercialContext(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
}): Promise<PulseTenantCommercialContext> {
  const profile = await loadIndividualPerpetualProfile({
    adminSupabase: params.adminSupabase,
    entityId: params.entityId,
  });

  const billingLicenseType =
    profile.billingLicenseType === "free" ||
    profile.billingLicenseType === "monthly" ||
    profile.billingLicenseType === "lifetime"
      ? profile.billingLicenseType
      : null;

  return {
    segment: "individual_free",
    billingLicenseType,
    companyId: profile.companyId,
    profileFound: profile.profileFound,
    licenseType: profile.licenseType,
    licensePurchaseDate: profile.licensePurchaseDate?.toISOString() ?? null,
  };
}

export async function resolveEffectiveByokKeys(params: {
  adminSupabase: SupabaseClient;
  tenantId: string;
  headerGeminiKey?: string | null;
  headerAnthropicKey?: string | null;
}): Promise<ResolvedByokKeys> {
  const headerGemini = params.headerGeminiKey?.trim() || null;
  const headerAnthropic = params.headerAnthropicKey?.trim() || null;

  let gemini = headerGemini && headerGemini.length >= 8 ? headerGemini : null;
  let anthropic = headerAnthropic && headerAnthropic.length >= 8 ? headerAnthropic : null;

  const sources: ResolvedByokKeys["sources"] = {
    gemini: gemini ? "header" : "none",
    anthropic: anthropic ? "header" : "none",
  };

  if (!gemini || !anthropic) {
    const presence = await listTenantProviderCredentialPresence({
      admin: params.adminSupabase,
      tenantId: params.tenantId,
    });

    if (!gemini && presence.gemini) {
      gemini =
        (await decryptTenantProviderCredential({
          admin: params.adminSupabase,
          tenantId: params.tenantId,
          provider: "gemini",
        })) || null;
      if (gemini) sources.gemini = "tenant_vault";
    }

    if (!anthropic && presence.anthropic) {
      anthropic =
        (await decryptTenantProviderCredential({
          admin: params.adminSupabase,
          tenantId: params.tenantId,
          provider: "anthropic",
        })) || null;
      if (anthropic) sources.anthropic = "tenant_vault";
    }
  }

  const bothPresent = Boolean(gemini?.trim() && anthropic?.trim());

  return {
    gemini: gemini?.trim() || null,
    anthropic: anthropic?.trim() || null,
    bothPresent,
    sources,
  };
}

function resolveIndividualFreeRouting(
  byok: ResolvedByokKeys,
  managedCloudExpired = false
): FreeTierConvergeRouting {
  if (byok.bothPresent) {
    return {
      segment: "individual_free",
      action: "run_byok_converge",
      byok: byok as ResolvedByokKeys & { bothPresent: true },
      managedCloudExpired,
    };
  }
  return {
    segment: "individual_free",
    action: "bypass_converge_baseline",
    byok,
    managedCloudExpired,
  };
}

function resolvePerpetualManagedYearRouting(
  byok: ResolvedByokKeys,
  monthlyUsage: PerpetualMonthlySliceUsage,
  managedWindow: ManagedCloudWindowEvaluation
): ConvergeConsensusRouting {
  if (monthlyUsage.withinSoftCap) {
    return {
      segment: "individual_perpetual",
      action: "run_perpetual_platform_converge",
      byok,
      monthlyUsage,
      managedWindow,
    };
  }

  if (byok.bothPresent) {
    return {
      segment: "individual_perpetual",
      action: "run_byok_converge",
      byok: byok as ResolvedByokKeys & { bothPresent: true },
      monthlyUsage,
      managedWindow,
      allowanceState: MSGF_ALLOWANCE_STATE_SOFT_CAP,
    };
  }

  return {
    segment: "individual_perpetual",
    action: "soft_cap_exceeded_ide_degraded",
    byok,
    monthlyUsage,
    managedWindow,
    allowanceState: MSGF_ALLOWANCE_STATE_SOFT_CAP,
  };
}

/** Pulse JSON fields + allowance metadata for IDE / dashboard. */
export function buildConvergePublicResponseFields(
  routing: ConvergeConsensusRouting
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if ("allowanceState" in routing && routing.allowanceState) {
    fields.x_msgf_allowance_state = routing.allowanceState;
    fields.prefer_byok = true;
    fields.validation_mode = routing.byok.bothPresent
      ? "dual_model_byok"
      : "single_model";
    fields.warning = PERPETUAL_SOFT_CAP_EXCEEDED_MESSAGE;
    if ("monthlyUsage" in routing) {
      fields.monthly_slices_consumed = routing.monthlyUsage.slicesConsumed;
      fields.monthly_slice_soft_cap = routing.monthlyUsage.softCap;
    }
  }

  if (routing.action === "bypass_converge_baseline") {
    const managedExpired =
      "managedCloudExpired" in routing && Boolean(routing.managedCloudExpired);

    fields.consensusBypassed = true;
    fields.consensus_layer_bypassed = true;
    fields.show_dashboard_notification = true;
    fields.warning = managedExpired
      ? MANAGED_CLOUD_EXPIRED_BYPASS_WARNING
      : CONVERGE_CONSENSUS_BYPASS_WARNING;

    if ("managedCloudExpired" in routing && routing.managedCloudExpired) {
      fields.managed_cloud_expired = true;
      fields.license_type = "INDIVIDUAL_PERPETUAL";
    }
  }

  if (routing.action === "managed_cloud_expired_bypass") {
    fields.consensusBypassed = true;
    fields.consensus_layer_bypassed = true;
    fields.show_dashboard_notification = true;
    fields.managed_cloud_expired = true;
    fields.license_type = "INDIVIDUAL_PERPETUAL";
    fields.warning = MANAGED_CLOUD_EXPIRED_BYPASS_WARNING;
    if ("managedWindow" in routing) {
      fields.days_since_license_purchase = routing.managedWindow.daysSincePurchase;
    }
  }

  if (routing.action === "soft_cap_exceeded_ide_degraded") {
    fields.cloud_dual_model_skipped = true;
    fields.show_dashboard_notification = true;
  }

  if (
    routing.segment === "individual_perpetual" &&
    "monthlyUsage" in routing &&
    routing.action === "run_perpetual_platform_converge"
  ) {
    fields.license_type = "INDIVIDUAL_PERPETUAL";
    fields.managed_cloud_active = true;
    fields.monthly_slices_consumed = routing.monthlyUsage.slicesConsumed;
    fields.monthly_slice_soft_cap = routing.monthlyUsage.softCap;
    if ("managedWindow" in routing) {
      fields.days_since_license_purchase = routing.managedWindow.daysSincePurchase;
    }
  }

  return fields;
}

/** @deprecated Use {@link buildConvergePublicResponseFields}. */
export function buildConvergeBypassResponseFields(
  routing: ConvergeConsensusRouting
): Record<string, unknown> {
  return buildConvergePublicResponseFields(routing);
}

export async function resolveConvergeConsensusRouting(params: {
  adminSupabase: SupabaseClient;
  tenantId: string;
  entityId: string;
  license: PulseLicenseContext;
  headerGeminiKey?: string | null;
  headerAnthropicKey?: string | null;
}): Promise<{
  commercial: PulseTenantCommercialContext;
  routing: ConvergeConsensusRouting;
}> {
  const profileCtx = await loadPulseTenantCommercialContext({
    adminSupabase: params.adminSupabase,
    entityId: params.entityId,
  });

  const perpetualProfile = await loadIndividualPerpetualProfile({
    adminSupabase: params.adminSupabase,
    entityId: params.entityId,
  });

  const segment = classifyTenantCommercialSegment({
    tenantId: params.tenantId,
    license: params.license,
    billingLicenseType: profileCtx.billingLicenseType,
    companyId: profileCtx.companyId,
    licenseType: perpetualProfile.licenseType,
  });

  const byok = await resolveEffectiveByokKeys({
    adminSupabase: params.adminSupabase,
    tenantId: params.tenantId,
    headerGeminiKey: params.headerGeminiKey,
    headerAnthropicKey: params.headerAnthropicKey,
  });

  const commercial: PulseTenantCommercialContext = {
    ...profileCtx,
    segment,
    licenseType: perpetualProfile.licenseType,
    licensePurchaseDate: perpetualProfile.licensePurchaseDate?.toISOString() ?? null,
  };

  if (segment === "corporate_paid") {
    return {
      commercial,
      routing: {
        segment: "corporate_paid",
        action: "run_corporate_system_converge",
        byok,
        enterpriseVaultConfigured: byok.bothPresent,
      },
    };
  }

  if (segment === "individual_perpetual") {
    const managedWindow = evaluateManagedCloudWindow(perpetualProfile.licensePurchaseDate);

    if (managedWindow.managedCloudExpired) {
      if (byok.bothPresent) {
        return {
          commercial,
          routing: {
            segment: "individual_free",
            action: "run_byok_converge",
            byok: byok as ResolvedByokKeys & { bothPresent: true },
            managedCloudExpired: true,
          },
        };
      }

      return {
        commercial,
        routing: {
          segment: "individual_perpetual",
          action: "managed_cloud_expired_bypass",
          byok,
          managedWindow,
        },
      };
    }

    const monthlyUsage = await evaluatePerpetualMonthlySliceUsage({
      adminSupabase: params.adminSupabase,
      entityId: params.entityId,
    });

    return {
      commercial,
      routing: resolvePerpetualManagedYearRouting(byok, monthlyUsage, managedWindow),
    };
  }

  return {
    commercial,
    routing: resolveIndividualFreeRouting(byok),
  };
}

export function shouldRunLocalDualModelGateway(routing: ConvergeConsensusRouting): boolean {
  if (
    routing.action === "bypass_converge_baseline" ||
    routing.action === "soft_cap_exceeded_ide_degraded" ||
    routing.action === "managed_cloud_expired_bypass"
  ) {
    return false;
  }
  if (routing.action === "run_perpetual_platform_converge") return false;
  if (
    routing.segment === "individual_free" ||
    routing.segment === "individual_perpetual"
  ) {
    return routing.action === "run_byok_converge";
  }
  return routing.enterpriseVaultConfigured;
}

export function usesPlatformMasterConvergeCredentials(
  routing: ConvergeConsensusRouting
): boolean {
  return (
    routing.action === "run_corporate_system_converge" ||
    routing.action === "run_perpetual_platform_converge"
  );
}

export function isConvergeEscalationBypassOrDegraded(
  routing: ConvergeConsensusRouting
): boolean {
  return (
    routing.action === "bypass_converge_baseline" ||
    routing.action === "soft_cap_exceeded_ide_degraded" ||
    routing.action === "managed_cloud_expired_bypass"
  );
}
