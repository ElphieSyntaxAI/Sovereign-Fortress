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
 * MSGF onboarding — pledge `state_beats` + `p4_profiles` ({@link MsgfProfile}) for first Pulse.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { CURRENT_LEGAL_VERSION } from "./msgf-legal";
import type { EnsureMsgfProfileInput } from "@/lib/schemas/msgf-profile";
import {
  type PlatformId,
  personaToProfileRole,
  resolveOperationalTenantId,
} from "./platform-persona-auth";
import { bootstrapTenantBrain } from "./services/brain-readiness";
import { ensureTenantWalletStarter } from "./services/tenant-token-wallet";
import { createAdminClient } from "../utils/supabase/admin";

export { bootstrapTenantBrain };

export type { MsgfProfile, EnsureMsgfProfileInput } from "@/lib/schemas/msgf-profile";

export type CreatePledgeBeatResult = {
  beatId: string;
  created: boolean;
};

export type EnsureMsgfPulseProfileInput = EnsureMsgfProfileInput & {
  supabase?: SupabaseClient;
};

/** @deprecated Use {@link EnsureMsgfPulseProfileInput}. */
export type EnsureAuthorPulseProfileInput = EnsureMsgfPulseProfileInput & {
  userId: string;
};

/**
 * Input for {@link syncPlatformEntitlement}. The MSGF login bridge derives both
 * `tenant_id` and `user_role` from `platform` + `persona` (so callers do not
 * need to supply them); username is required for the profile upsert.
 */
export type SyncPlatformEntitlementInput = {
  supabase?: SupabaseClient;
  entityId: string;
  platform: PlatformId;
  persona: string;
  username: string;
  preferredTheme?: string;
};

function resolveAdmin(supabase?: SupabaseClient): SupabaseClient {
  return supabase ?? createAdminClient();
}

/**
 * Inserts the No-AI-Training pledge beat (tenant + entity scoped).
 * Idempotent per tenant + entity + {@link CURRENT_LEGAL_VERSION} + label `pledge`.
 */
export async function createPledgeBeat(
  entityId: string,
  options?: {
    tenantId: string;
    supabase?: SupabaseClient;
    beatText?: string;
  }
): Promise<CreatePledgeBeatResult> {
  const admin = resolveAdmin(options?.supabase);
  const eid = entityId.trim();
  const tenantId = options?.tenantId?.trim();
  if (!eid) {
    throw new Error("createPledgeBeat: entityId is required.");
  }
  if (!tenantId) {
    throw new Error("createPledgeBeat: tenantId is required.");
  }

  const { data: existing, error: readErr } = await admin
    .from("state_beats")
    .select("id")
    .eq("legal_version", CURRENT_LEGAL_VERSION)
    .eq("label", "pledge")
    .eq("author_id", eid)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readErr) {
    throw new Error(`createPledgeBeat: read failed: ${readErr.message}`);
  }

  if (existing?.id) {
    return { beatId: String(existing.id), created: false };
  }

  const beatText =
    options?.beatText?.trim() ||
    `No-AI-Training Pledge accepted at registration (Vault Pact). Legal version: ${CURRENT_LEGAL_VERSION}. Global Brain swarm telemetry is zero-text structural only; licensed benchmarks use synthetic stress cases. Session Replay is tenant legal/security retention, not a training corpus.`;

  const { data, error } = await admin
    .from("state_beats")
    .insert({
      author_id: eid,
      tenant_id: tenantId,
      beat_text: beatText,
      legal_version: CURRENT_LEGAL_VERSION,
      sequence_index: 1,
      label: "pledge",
      metadata: {
        source: "msgf_onboarding",
        tenant_id: tenantId,
        entity_id: eid,
        msgf_onboarding: true,
      },
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`createPledgeBeat: insert failed: ${error?.message ?? "no row"}`);
  }

  return { beatId: String(data.id), created: true };
}

/**
 * Ensures `p4_profiles` exists so entitlement middleware allows the first Pulse.
 */
export async function ensureMsgfPulseProfile(
  input: EnsureMsgfPulseProfileInput
): Promise<void> {
  const admin = resolveAdmin(input.supabase);
  const entityId = input.entityId.trim();
  if (!entityId) {
    throw new Error("ensureMsgfPulseProfile: entityId is required.");
  }

  const tierId = Number(input.tierId);
  if (!Number.isFinite(tierId) || tierId < 1) {
    throw new Error("ensureMsgfPulseProfile: tierId must be a positive integer.");
  }

  const billingLicense =
    process.env.MSGF_REGISTRATION_BILLING_LICENSE?.trim().toLowerCase() ??
    process.env.MSGF_AUTHOR_REGISTRATION_BILLING_LICENSE?.trim().toLowerCase() ??
    "monthly";
  const allowedBilling = ["free", "monthly", "lifetime"] as const;
  const billing_license_type = allowedBilling.includes(
    billingLicense as (typeof allowedBilling)[number]
  )
    ? (billingLicense as (typeof allowedBilling)[number])
    : "monthly";

  const starterCredits = Math.max(
    0,
    Number.parseInt(
      process.env.MSGF_REGISTRATION_STARTER_CREDITS ??
        process.env.MSGF_AUTHOR_REGISTRATION_STARTER_CREDITS ??
        "25",
      10
    ) || 25
  );

  const stripeStatus =
    billing_license_type === "monthly"
      ? process.env.MSGF_REGISTRATION_STRIPE_STATUS?.trim() ||
        process.env.MSGF_AUTHOR_REGISTRATION_STRIPE_STATUS?.trim() ||
        "active"
      : null;

  const { error } = await admin.from("p4_profiles").upsert(
    {
      user_id: entityId,
      legacy_user_id: null,
      username: input.username.trim(),
      tier_id: tierId,
      user_role: input.userRole?.trim() || "msgf_entity",
      tenant_id: input.tenantId?.trim() || null,
      preferred_theme: input.preferredTheme?.trim() || "Pleasure",
      billing_license_type,
      stripe_subscription_status: stripeStatus,
      current_credits: starterCredits,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    const detail =
      error.message === "fetch failed" || error.message.includes("fetch failed")
        ? `${error.message} — check NEXT_PUBLIC_SUPABASE_URL in packages/msgf/.env.local (a placeholder SUPABASE_URL in root .env must not override it)`
        : error.message;
    throw new Error(`ensureMsgfPulseProfile: p4_profiles upsert failed: ${detail}`);
  }
}

function legacyTierNameForPlatform(platform: PlatformId): string {
  if (platform === "author") return "Tier 2: Core Author";
  return "Tier 1: Fan Access";
}

/**
 * Login / register bridge: mint or refresh MSGF entitlement on `p4_profiles`, pledge beat, and brain baseline.
 * Does not reset `current_credits` when a billing license already exists.
 */
export async function syncPlatformEntitlement(input: SyncPlatformEntitlementInput): Promise<{
  provisionedLicense: boolean;
  tenantId: string;
  userRole: string;
}> {
  const admin = resolveAdmin(input.supabase);
  const entityId = input.entityId.trim();
  const tenantId = resolveOperationalTenantId(input.platform);
  const userRole = personaToProfileRole(input.platform, input.persona);

  const { data: tierRow } = await admin
    .from("msgf_legacy_tiers")
    .select("tier_id")
    .eq("name", legacyTierNameForPlatform(input.platform))
    .maybeSingle();
  const tierId = typeof tierRow?.tier_id === "number" ? tierRow.tier_id : 1;

  const { data: existing } = await admin
    .from("p4_profiles")
    .select("user_id, billing_license_type, current_credits")
    .eq("user_id", entityId)
    .maybeSingle();

  let provisionedLicense = false;
  if (!existing?.billing_license_type) {
    await ensureMsgfPulseProfile({
      supabase: admin,
      entityId,
      tierId,
      username: input.username,
      preferredTheme: input.preferredTheme,
      userRole,
      tenantId,
    });
    provisionedLicense = true;
  } else {
    const { error: patchErr } = await admin
      .from("p4_profiles")
      .update({
        user_role: userRole,
        tenant_id: tenantId,
        username: input.username.trim(),
        tier_id: tierId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", entityId);
    if (patchErr) {
      throw new Error(`syncPlatformEntitlement: profile patch failed: ${patchErr.message}`);
    }
  }

  await createPledgeBeat(entityId, {
    tenantId,
    supabase: admin,
    beatText: `Platform entitlement sync (${input.platform} · ${input.persona}).`,
  });

  await bootstrapTenantBrain(admin, tenantId, entityId);

  try {
    await ensureTenantWalletStarter(admin, tenantId);
  } catch (e) {
    console.warn("[msgf-onboarding] wallet starter:", e instanceof Error ? e.message : e);
  }

  return { provisionedLicense, tenantId, userRole };
}

/**
 * SaaS buyer account — `p4_profiles` + pledge only. Does not seed P1–P6 baseline rows;
 * pillars stay empty until the user maps a project and runs ingest / Pulse.
 */
export async function ensureGatedAiBuyerAccount(input: {
  supabase?: SupabaseClient;
  entityId: string;
  username: string;
}): Promise<{ tenantId: string; provisionedLicense: boolean }> {
  const admin = resolveAdmin(input.supabase);
  const entityId = input.entityId.trim();
  const tenantId = resolveOperationalTenantId("gatedai");
  const userRole = personaToProfileRole("gatedai", "developer");

  const { data: tierRow } = await admin
    .from("msgf_legacy_tiers")
    .select("tier_id")
    .eq("name", "Tier 1: Fan Access")
    .maybeSingle();
  const tierId = typeof tierRow?.tier_id === "number" ? tierRow.tier_id : 1;

  const { data: existing } = await admin
    .from("p4_profiles")
    .select("user_id, billing_license_type")
    .eq("user_id", entityId)
    .maybeSingle();

  let provisionedLicense = false;
  if (!existing?.billing_license_type) {
    await ensureMsgfPulseProfile({
      supabase: admin,
      entityId,
      tierId,
      username: input.username,
      userRole,
      tenantId,
    });
    provisionedLicense = true;
  }

  await createPledgeBeat(entityId, {
    tenantId,
    supabase: admin,
    beatText: `No-AI-Training Pledge accepted at registration (Vault Pact). Legal version: ${CURRENT_LEGAL_VERSION}. Global Brain swarm telemetry is zero-text structural only; licensed benchmarks use synthetic stress cases. Session Replay is tenant legal/security retention, not a training corpus.`,
  });

  return { provisionedLicense, tenantId };
}

/** @deprecated Use {@link ensureMsgfPulseProfile} with `entityId`. */
export async function ensureAuthorPulseProfile(
  input: EnsureAuthorPulseProfileInput
): Promise<void> {
  return ensureMsgfPulseProfile({
    supabase: input.supabase,
    entityId: input.userId,
    tierId: input.tierId,
    username: input.username,
    preferredTheme: input.preferredTheme,
  });
}

/** Host registration → MSGF Brain onboarding. */
export const MSGF = {
  createPledgeBeat,
  ensureMsgfPulseProfile,
  ensureGatedAiBuyerAccount,
  syncPlatformEntitlement,
  bootstrapTenantBrain,
  /** @deprecated Use {@link ensureMsgfPulseProfile}. */
  ensureAuthorPulseProfile,
} as const;
