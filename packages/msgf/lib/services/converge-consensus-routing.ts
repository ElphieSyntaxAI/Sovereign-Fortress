/**
 * Step 5 (CONVERGE) — Individual Free (BYOK), PAID_INDIVIDUAL, Corporate routing.
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
  evaluatePaidIndividualMonthlyUsage,
  PAID_INDIVIDUAL_QUOTA_EXCEEDED_WARNING,
  type PaidIndividualMonthlyUsage,
} from "@/lib/services/paid-individual-usage";

export const CONVERGE_CONSENSUS_BYPASS_WARNING =
  "Consensus layer bypassed. Provide Gemini & Claude keys in your dashboard or project configuration to unlock premium cloud validation." as const;

export type TenantCommercialSegment = "individual_free" | "paid_individual" | "corporate_paid";

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
    }
  | {
      segment: "individual_free";
      action: "bypass_converge_baseline";
      byok: ResolvedByokKeys;
    };

export type ConvergeConsensusRouting =
  | FreeTierConvergeRouting
  | {
      segment: "paid_individual";
      action: "run_paid_individual_platform_converge";
      byok: ResolvedByokKeys;
      monthlyUsage: PaidIndividualMonthlyUsage;
    }
  | {
      segment: "paid_individual";
      action: "run_byok_converge";
      byok: ResolvedByokKeys & { bothPresent: true };
      monthlyUsage: PaidIndividualMonthlyUsage;
      quotaExceeded: true;
    }
  | {
      segment: "paid_individual";
      action: "bypass_converge_baseline";
      byok: ResolvedByokKeys;
      monthlyUsage: PaidIndividualMonthlyUsage;
      quotaExceeded: true;
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

const PAID_INDIVIDUAL_TIER_SLUGS = new Set([
  "paid_individual",
  "individual_premium",
  "individual_pro",
  "paid_individual_tier",
]);

export type PulseTenantCommercialContext = {
  segment: TenantCommercialSegment;
  billingLicenseType: BillingLicenseType | null;
  companyId: string | null;
  profileFound: boolean;
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
}): TenantCommercialSegment {
  const { tenantId, license, billingLicenseType, companyId } = params;
  const tier = normalizeTierSlug(license.tierId);

  if (CORPORATE_TIER_SLUGS.has(tier)) {
    return "corporate_paid";
  }

  if (companyId) {
    return "corporate_paid";
  }

  if (PAID_INDIVIDUAL_TIER_SLUGS.has(tier)) {
    return "paid_individual";
  }

  if (
    billingLicenseType === "monthly" &&
    (isPersonalSandboxTenant(tenantId) || tenantId.startsWith(TENANT_INDIV_PREFIX))
  ) {
    return "paid_individual";
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

  if (billingLicenseType === "monthly" || billingLicenseType === "lifetime") {
    return "corporate_paid";
  }

  return "individual_free";
}

export async function loadPulseTenantCommercialContext(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
}): Promise<{
  billingLicenseType: BillingLicenseType | null;
  companyId: string | null;
  profileFound: boolean;
}> {
  const { data, error } = await params.adminSupabase
    .from("p4_profiles")
    .select("billing_license_type, company_id")
    .eq("user_id", params.entityId)
    .maybeSingle();

  if (error || !data) {
    return {
      billingLicenseType: null,
      companyId: null,
      profileFound: false,
    };
  }

  const billingRaw = data.billing_license_type;
  const billingLicenseType =
    billingRaw === "free" || billingRaw === "monthly" || billingRaw === "lifetime"
      ? billingRaw
      : null;

  const companyId =
    typeof data.company_id === "string" && data.company_id.trim()
      ? data.company_id.trim()
      : null;

  return {
    billingLicenseType,
    companyId,
    profileFound: true,
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

function resolveIndividualFreeRouting(byok: ResolvedByokKeys): FreeTierConvergeRouting {
  if (byok.bothPresent) {
    return {
      segment: "individual_free",
      action: "run_byok_converge",
      byok: byok as ResolvedByokKeys & { bothPresent: true },
    };
  }
  return {
    segment: "individual_free",
    action: "bypass_converge_baseline",
    byok,
  };
}

/** Public bypass / upgrade fields for pulse JSON (HTTP 200). */
export function buildConvergeBypassResponseFields(routing: ConvergeConsensusRouting): Record<
  string,
  unknown
> {
  if (routing.action !== "bypass_converge_baseline") {
    return {};
  }

  const warning =
    routing.segment === "paid_individual" && "quotaExceeded" in routing && routing.quotaExceeded
      ? PAID_INDIVIDUAL_QUOTA_EXCEEDED_WARNING
      : CONVERGE_CONSENSUS_BYPASS_WARNING;

  return {
    consensusBypassed: true,
    consensus_layer_bypassed: true,
    warning,
    ...(routing.segment === "paid_individual" && "monthlyUsage" in routing
      ? {
          paid_individual_quota_exceeded: true,
          monthly_tokens_consumed: routing.monthlyUsage.tokensConsumed,
          monthly_token_soft_cap: routing.monthlyUsage.softCap,
        }
      : {}),
  };
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
  const profile = await loadPulseTenantCommercialContext({
    adminSupabase: params.adminSupabase,
    entityId: params.entityId,
  });

  const segment = classifyTenantCommercialSegment({
    tenantId: params.tenantId,
    license: params.license,
    billingLicenseType: profile.billingLicenseType,
    companyId: profile.companyId,
  });

  const byok = await resolveEffectiveByokKeys({
    adminSupabase: params.adminSupabase,
    tenantId: params.tenantId,
    headerGeminiKey: params.headerGeminiKey,
    headerAnthropicKey: params.headerAnthropicKey,
  });

  const commercial: PulseTenantCommercialContext = {
    segment,
    billingLicenseType: profile.billingLicenseType,
    companyId: profile.companyId,
    profileFound: profile.profileFound,
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

  if (segment === "paid_individual") {
    const monthlyUsage = await evaluatePaidIndividualMonthlyUsage({
      adminSupabase: params.adminSupabase,
      entityId: params.entityId,
    });

    if (monthlyUsage.withinSoftCap) {
      return {
        commercial,
        routing: {
          segment: "paid_individual",
          action: "run_paid_individual_platform_converge",
          byok,
          monthlyUsage,
        },
      };
    }

    if (byok.bothPresent) {
      return {
        commercial,
        routing: {
          segment: "paid_individual",
          action: "run_byok_converge",
          byok: byok as ResolvedByokKeys & { bothPresent: true },
          monthlyUsage,
          quotaExceeded: true,
        },
      };
    }

    return {
      commercial,
      routing: {
        segment: "paid_individual",
        action: "bypass_converge_baseline",
        byok,
        monthlyUsage,
        quotaExceeded: true,
      },
    };
  }

  return {
    commercial,
    routing: resolveIndividualFreeRouting(byok),
  };
}

/** Whether local-gateway dual-model enrichment should run for this routing decision. */
export function shouldRunLocalDualModelGateway(routing: ConvergeConsensusRouting): boolean {
  if (routing.action === "bypass_converge_baseline") return false;
  if (routing.action === "run_paid_individual_platform_converge") return false;
  if (routing.segment === "individual_free" || routing.segment === "paid_individual") {
    return routing.action === "run_byok_converge";
  }
  return routing.enterpriseVaultConfigured;
}

/** True when CONVERGE should use master platform credentials (Vertex), not BYOK. */
export function usesPlatformMasterConvergeCredentials(routing: ConvergeConsensusRouting): boolean {
  return (
    routing.action === "run_corporate_system_converge" ||
    routing.action === "run_paid_individual_platform_converge"
  );
}
