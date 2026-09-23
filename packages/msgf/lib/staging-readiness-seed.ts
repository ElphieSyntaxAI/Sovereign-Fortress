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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * Staging product-readiness seed: operator, buyer, Pulse tenant, Author license.
 * Never run against production DEPLOY_ENV or a production Supabase host.
 */
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  bootstrapTenantBrain,
  createPledgeBeat,
  ensureGatedAiBuyerAccount,
  syncPlatformEntitlement,
} from "./msgf-onboarding";
import { resolveOperationalTenantId } from "./platform-persona-auth";
import { ensureTenantWalletStarter } from "./services/tenant-token-wallet";

export const STAGING_SOLO_TENANT_ID = "staging_readiness";
export const STAGING_AUTHOR_TENANT_ID = "author_ecosystem";
export const STAGING_BUYER_EMAIL_DEFAULT = "staging-buyer@elphiesyntax.test";

export type StagingSeedOptions = {
  operatorEmail: string;
  operatorPassword?: string;
  resetOperatorPassword?: boolean;
  buyerEmail?: string;
  buyerPassword?: string;
  credits?: number;
};

export type LicenseMint = {
  tenantId: string;
  created: boolean;
  plaintextKey: string | null;
};

export type SeededUser = {
  email: string;
  userId: string;
  created: boolean;
  password: string | null;
};

export type StagingSeedResult = {
  operator: SeededUser;
  buyer: SeededUser;
  soloTenantId: string;
  authorTenantId: string;
  soloLicense: LicenseMint;
  authorLicense: LicenseMint;
};

export type StagingSeedStatus = {
  operatorReady: boolean;
  operatorEmail: string | null;
  buyerReady: boolean;
  buyerEmail: string | null;
  soloTenantReady: boolean;
  soloLicenseReady: boolean;
  authorLicenseReady: boolean;
  stripeTestReady: boolean;
};

export function hostOf(url: string): string {
  try {
    return new URL(String(url || "").trim()).host.toLowerCase();
  } catch {
    return "";
  }
}

export function firstGlobalAdminEmail(raw?: string): string {
  const first = String(raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .find(Boolean);
  return first || "jessicapickens@elphiesyntax.com";
}

export function assertStagingSeedTarget(params: {
  deployEnv?: string;
  supabaseUrl?: string;
  productionSupabaseHosts?: Iterable<string>;
}): void {
  if (String(params.deployEnv ?? "").trim().toLowerCase() !== "staging") {
    throw new Error("Staging seed only runs when DEPLOY_ENV=staging.");
  }
  const host = hostOf(params.supabaseUrl ?? "");
  if (!host || /your_staging|your-project/i.test(host)) {
    throw new Error("Staging seed requires a real staging Supabase URL.");
  }
  for (const prod of params.productionSupabaseHosts ?? []) {
    if (hostOf(prod) === host || String(prod).trim().toLowerCase() === host) {
      throw new Error("Refusing to seed: Supabase host matches production.");
    }
  }
}

export function stripeTestReady(env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = String(env.STRIPE_SECRET_KEY ?? "").trim();
  if (!secret.startsWith("sk_test_")) return false;
  const keys = [
    "STRIPE_PRICE_PRO_INDIVIDUAL",
    "STRIPE_PRICE_PRO_INDIVIDUAL_YEARLY",
    "STRIPE_PRICE_STARTUP_TEAM",
    "STRIPE_PRICE_STARTUP_TEAM_YEARLY",
    "STRIPE_PRICE_ENTERPRISE",
    "STRIPE_PRICE_ENTERPRISE_YEARLY",
  ];
  return keys.every((k) => String(env[k] ?? "").trim().startsWith("price_"));
}

function sha256HexUtf8(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function mintPlaintextKey() {
  return `msgf_live_${crypto.randomBytes(32).toString("base64url")}`;
}

function randomPassword() {
  return `StagingReady!${crypto.randomBytes(6).toString("hex")}`;
}

async function findUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<{ id: string; email?: string } | null> {
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match?.id) return { id: match.id, email: match.email };
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function ensureUser(
  admin: SupabaseClient,
  params: {
    email: string;
    password?: string;
    resetPassword?: boolean;
    appMetadata: Record<string, unknown>;
    userMetadata: Record<string, unknown>;
  }
): Promise<SeededUser> {
  const email = params.email.trim().toLowerCase();
  const existing = await findUserByEmail(admin, email);
  if (existing?.id) {
    let password: string | null = null;
    if (params.resetPassword) {
      password = params.password?.trim() || randomPassword();
      const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
      if (error) throw new Error(`updateUser password: ${error.message}`);
    }
    const { error: metaErr } = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata: params.appMetadata,
      user_metadata: params.userMetadata,
    });
    if (metaErr) throw new Error(`updateUser metadata: ${metaErr.message}`);
    return { email, userId: existing.id, created: false, password };
  }

  const password = params.password?.trim() || randomPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: params.appMetadata,
    user_metadata: params.userMetadata,
  });
  if (error || !data.user?.id) {
    throw new Error(`createUser failed: ${error?.message ?? "no user id"}`);
  }
  return { email, userId: data.user.id, created: true, password };
}

async function ensureBiometricProfile(admin: SupabaseClient, entityId: string) {
  const { error } = await admin.from("biometric_profile").upsert(
    {
      user_id: entityId,
      ewma_speed: 4.5,
      rhythm_hash: "r100-n10",
      baseline_training_remaining: 0,
      recalibrated_at: null,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`biometric_profile upsert: ${error.message}`);
}

async function ensureActiveLicense(
  admin: SupabaseClient,
  tenantId: string,
  credits: number
): Promise<LicenseMint> {
  const { data: existing, error: readErr } = await admin
    .from("msgf_licenses")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (readErr) throw new Error(`msgf_licenses read: ${readErr.message}`);
  if (existing?.id) {
    return { tenantId, created: false, plaintextKey: null };
  }

  const plainKey = mintPlaintextKey();
  const { error } = await admin.from("msgf_licenses").insert({
    license_key_hash: sha256HexUtf8(plainKey),
    tenant_id: tenantId,
    tier_id: "brain_contract",
    credits_total: credits,
    credits_used: 0,
    status: "active",
  });
  if (error) throw new Error(`msgf_licenses insert: ${error.message}`);
  return { tenantId, created: true, plaintextKey: plainKey };
}

export async function getStagingSeedStatus(
  admin: SupabaseClient,
  env: NodeJS.ProcessEnv = process.env
): Promise<StagingSeedStatus> {
  const operatorEmail = firstGlobalAdminEmail(env.MSGF_GLOBAL_ADMIN_EMAILS);
  const buyerEmail = (
    env.STAGING_BUYER_EMAIL?.trim() || STAGING_BUYER_EMAIL_DEFAULT
  ).toLowerCase();
  const operator = await findUserByEmail(admin, operatorEmail);
  const buyer = await findUserByEmail(admin, buyerEmail);

  const { count: soloLicenses } = await admin
    .from("msgf_licenses")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", STAGING_SOLO_TENANT_ID)
    .eq("status", "active");
  const { count: authorLicenses } = await admin
    .from("msgf_licenses")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", STAGING_AUTHOR_TENANT_ID)
    .eq("status", "active");
  const { data: pledgeRow } = await admin
    .from("state_beats")
    .select("id")
    .eq("tenant_id", STAGING_SOLO_TENANT_ID)
    .limit(1)
    .maybeSingle();

  return {
    operatorReady: Boolean(operator?.id),
    operatorEmail: operator?.email ?? null,
    buyerReady: Boolean(buyer?.id),
    buyerEmail: buyer?.email ?? null,
    soloTenantReady: Boolean(pledgeRow?.id),
    soloLicenseReady: (soloLicenses ?? 0) > 0,
    authorLicenseReady: (authorLicenses ?? 0) > 0,
    stripeTestReady: stripeTestReady(env),
  };
}

export async function runStagingReadinessSeed(
  admin: SupabaseClient,
  options: StagingSeedOptions
): Promise<StagingSeedResult> {
  const credits = Math.max(1, options.credits ?? 50_000);
  const operatorEmail = options.operatorEmail.trim().toLowerCase();
  const buyerEmail = (
    options.buyerEmail?.trim() || STAGING_BUYER_EMAIL_DEFAULT
  ).toLowerCase();

  const operator = await ensureUser(admin, {
    email: operatorEmail,
    password: options.operatorPassword,
    resetPassword: Boolean(options.resetOperatorPassword),
    appMetadata: {
      msgf_access_role: "GLOBAL_ADMIN",
      role: "GLOBAL_ADMIN",
    },
    userMetadata: {
      msgf_access_role: "GLOBAL_ADMIN",
      persona: "global_admin",
      platform: "gatedai",
    },
  });

  const gated = await syncPlatformEntitlement({
    supabase: admin,
    entityId: operator.userId,
    platform: "gatedai",
    persona: "developer",
    username: operatorEmail.split("@")[0] || "staging-operator",
  });
  const author = await syncPlatformEntitlement({
    supabase: admin,
    entityId: operator.userId,
    platform: "author",
    persona: "author",
    username: operatorEmail.split("@")[0] || "staging-operator",
  });

  const { error: roleErr } = await admin
    .from("p4_profiles")
    .update({
      msgf_access_role: "GLOBAL_ADMIN",
      company_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", operator.userId);
  if (roleErr) throw new Error(`p4_profiles role: ${roleErr.message}`);

  const pledge = await createPledgeBeat(operator.userId, {
    tenantId: STAGING_SOLO_TENANT_ID,
    supabase: admin,
    beatText: "No-AI-Training Pledge (staging product-readiness seed).",
  });
  await bootstrapTenantBrain(admin, STAGING_SOLO_TENANT_ID, operator.userId);
  await bootstrapTenantBrain(admin, author.tenantId || STAGING_AUTHOR_TENANT_ID, operator.userId);
  await ensureTenantWalletStarter(admin, STAGING_SOLO_TENANT_ID);
  await ensureTenantWalletStarter(admin, STAGING_AUTHOR_TENANT_ID);
  await ensureBiometricProfile(admin, operator.userId);

  const buyer = await ensureUser(admin, {
    email: buyerEmail,
    password: options.buyerPassword,
    resetPassword: false,
    appMetadata: { role: "DEVELOPER" },
    userMetadata: { persona: "developer", platform: "gatedai" },
  });
  await ensureGatedAiBuyerAccount({
    supabase: admin,
    entityId: buyer.userId,
    username: buyerEmail.split("@")[0] || "staging-buyer",
  });

  const soloLicense = await ensureActiveLicense(admin, STAGING_SOLO_TENANT_ID, credits);
  const authorLicense = await ensureActiveLicense(
    admin,
    resolveOperationalTenantId("author") || STAGING_AUTHOR_TENANT_ID,
    credits
  );

  void gated;
  void pledge;

  return {
    operator,
    buyer,
    soloTenantId: STAGING_SOLO_TENANT_ID,
    authorTenantId: STAGING_AUTHOR_TENANT_ID,
    soloLicense,
    authorLicense,
  };
}
