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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * Commercial plan → feature matrix (Pro / Startup / Enterprise launch gating).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const COMMERCIAL_PLANS = ["byok", "pro", "startup", "enterprise"] as const;
export type CommercialPlan = (typeof COMMERCIAL_PLANS)[number];

export const PLAN_FEATURES = [
  "team",
  "audit_console",
  "tenant_budgets",
  "session_replay",
  "tri_tribunal",
  "workspace_sso",
  "siem_export",
  "sentry_quarantine",
  "signing",
  "mcp_product",
  "dropbox_archive",
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

const STARTUP_FEATURES: readonly PlanFeature[] = [
  "team",
  "audit_console",
  "tenant_budgets",
  "session_replay",
  "tri_tribunal",
];

const ENTERPRISE_ONLY_FEATURES: readonly PlanFeature[] = [
  "workspace_sso",
  "siem_export",
  "sentry_quarantine",
  "signing",
  "mcp_product",
  "dropbox_archive",
];

/** Features granted per plan. BYOK and Pro are core-only (empty matrix). */
export const PLAN_FEATURE_MATRIX: Record<CommercialPlan, ReadonlySet<PlanFeature>> = {
  byok: new Set(),
  pro: new Set(),
  startup: new Set(STARTUP_FEATURES),
  enterprise: new Set([...STARTUP_FEATURES, ...ENTERPRISE_ONLY_FEATURES]),
};

export type PlanFeatureBlocked = {
  ok: false;
  status: 403;
  error: "PLAN_FEATURE_BLOCKED";
  feature: PlanFeature;
};

export type PlanFeatureAllowed = { ok: true };

export function parseCommercialPlan(raw: unknown): CommercialPlan | null {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if ((COMMERCIAL_PLANS as readonly string[]).includes(value)) {
    return value as CommercialPlan;
  }
  return null;
}

export function planAllows(
  plan: CommercialPlan | null | undefined,
  feature: PlanFeature
): boolean {
  const resolved = plan ?? "byok";
  return PLAN_FEATURE_MATRIX[resolved].has(feature);
}

/**
 * Soft assert: returns ok or a 403 PLAN_FEATURE_BLOCKED payload.
 * Callers may also throw via {@link assertPlanFeatureOrThrow}.
 */
export function assertPlanFeature(
  plan: CommercialPlan | null | undefined,
  feature: PlanFeature
): PlanFeatureAllowed | PlanFeatureBlocked {
  if (planAllows(plan, feature)) return { ok: true };
  return {
    ok: false,
    status: 403,
    error: "PLAN_FEATURE_BLOCKED",
    feature,
  };
}

export class PlanFeatureBlockedError extends Error {
  readonly status = 403 as const;
  readonly error = "PLAN_FEATURE_BLOCKED" as const;
  readonly feature: PlanFeature;

  constructor(feature: PlanFeature) {
    super("PLAN_FEATURE_BLOCKED");
    this.name = "PlanFeatureBlockedError";
    this.feature = feature;
  }

  toJSON(): PlanFeatureBlocked {
    return {
      ok: false,
      status: this.status,
      error: this.error,
      feature: this.feature,
    };
  }
}

export function assertPlanFeatureOrThrow(
  plan: CommercialPlan | null | undefined,
  feature: PlanFeature
): void {
  const result = assertPlanFeature(plan, feature);
  if (!result.ok) throw new PlanFeatureBlockedError(feature);
}

/** Map Stripe Checkout `msgf_tier` metadata onto commercial_plan. */
export function commercialPlanFromMsgfTier(tier: string | null | undefined): CommercialPlan {
  const t = String(tier ?? "")
    .trim()
    .toLowerCase();
  if (t === "individual_pro") return "pro";
  if (t === "corporate_startup") return "startup";
  if (t === "corporate_enterprise") return "enterprise";
  return "byok";
}

/**
 * Workspace company plan wins when companyId is present (null → byok).
 * Otherwise use profile plan (null → byok).
 */
export function resolveCommercialPlan(params: {
  companyPlan?: CommercialPlan | null;
  profilePlan?: CommercialPlan | null;
  companyId?: string | null;
}): CommercialPlan {
  const companyId =
    typeof params.companyId === "string" && params.companyId.trim()
      ? params.companyId.trim()
      : null;
  if (companyId) {
    return params.companyPlan ?? "byok";
  }
  return params.profilePlan ?? "byok";
}

/** Load commercial_plan for the current user (company overrides profile). */
export async function resolveCommercialPlanForUser(
  admin: SupabaseClient,
  userId: string
): Promise<CommercialPlan> {
  const id = userId.trim();
  if (!id) return "byok";

  const { data: profile } = await admin
    .from("p4_profiles")
    .select("company_id, commercial_plan")
    .eq("user_id", id)
    .maybeSingle();

  const companyId =
    typeof profile?.company_id === "string" && profile.company_id.trim()
      ? profile.company_id.trim()
      : null;
  const profilePlan = parseCommercialPlan(profile?.commercial_plan);

  let companyPlan: CommercialPlan | null = null;
  if (companyId) {
    const { data: company } = await admin
      .from("msgf_companies")
      .select("commercial_plan")
      .eq("id", companyId)
      .maybeSingle();
    companyPlan = parseCommercialPlan(company?.commercial_plan);
  }

  return resolveCommercialPlan({
    companyPlan,
    profilePlan,
    companyId,
  });
}
