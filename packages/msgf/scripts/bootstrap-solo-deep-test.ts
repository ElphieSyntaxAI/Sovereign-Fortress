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
/**
 * Bootstrap a tenant + entity for MSGF solo / third-party deep testing (no Author app).
 *
 * - Inserts legal pledge (`state_beats`)
 * - Seeds six governance pillar baseline rows
 * - Mints contract license key (`msgf_licenses`)
 * - Ensures `biometric_profile` row exists for entity
 *
 * Usage:
 *   npm run bootstrap:solo -w msgf
 *   npm run bootstrap:solo -w msgf -- --tenant=acme_integrator --entity=<auth.users uuid>
 */
import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createPledgeBeat, bootstrapTenantBrain } from "../lib/msgf-onboarding";

function parseArgs(argv: string[]) {
  let tenant = process.env.MSGF_SOLO_TENANT_ID?.trim() || "integration_sandbox";
  let entity = process.env.MSGF_SOLO_ENTITY_ID?.trim() || "";
  let credits = 50_000;
  let skipLicense = false;

  for (const arg of argv) {
    if (arg.startsWith("--tenant=")) tenant = arg.slice("--tenant=".length).trim();
    else if (arg.startsWith("--entity=")) entity = arg.slice("--entity=".length).trim();
    else if (arg.startsWith("--credits=")) credits = Math.max(0, Math.floor(Number(arg.slice(9))));
    else if (arg === "--skip-license") skipLicense = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`bootstrap-solo-deep-test — options:
  --tenant=<id>     Tenant silo (default: integration_sandbox)
  --entity=<uuid>   Human entity id (default: random UUID for synthetic integrator actor)
  --credits=<n>     License credits_total (default: 50000)
  --skip-license    Only pledge + pillar baseline (no msgf_licenses row)
`);
      process.exit(0);
    }
  }

  if (!tenant) throw new Error("--tenant is required");
  if (!entity) entity = crypto.randomUUID();

  return { tenant, entity, credits, skipLicense };
}

function sha256HexUtf8(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function mintPlaintextKey() {
  return `msgf_live_${crypto.randomBytes(32).toString("base64url")}`;
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

async function mintLicense(admin: SupabaseClient, tenant: string, credits: number) {
  const plainKey = mintPlaintextKey();
  const { data, error } = await admin
    .from("msgf_licenses")
    .insert({
      license_key_hash: sha256HexUtf8(plainKey),
      tenant_id: tenant,
      tier_id: "brain_contract",
      credits_total: credits,
      credits_used: 0,
      status: "active",
    })
    .select("id, tenant_id, tier_id, credits_total")
    .single();

  if (error) {
    throw new Error(
      `msgf_licenses insert failed: ${error.message} (apply migration 20260527120000_msgf_licensing.sql)`
    );
  }

  return { plainKey, row: data };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRole) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("[bootstrap:solo] tenant:", opts.tenant);
  console.log("[bootstrap:solo] entity:", opts.entity);

  const pledge = await createPledgeBeat(opts.entity, {
    tenantId: opts.tenant,
    supabase: admin,
    beatText: "No-AI-Training Pledge (MSGF solo deep-test bootstrap).",
  });
  console.log("[bootstrap:solo] pledge:", pledge.created ? "created" : "exists", pledge.beatId);

  const brain = await bootstrapTenantBrain(admin, opts.tenant, opts.entity);
  console.log("[bootstrap:solo] pillars_created:", brain.pillars_created.join(", ") || "(none new)");
  console.log("[bootstrap:solo] brain_readiness:", {
    readiness_score: brain.readiness_score,
    brain_fully_initialized: brain.brain_fully_initialized,
    missing_pillars: brain.missing_pillars,
  });

  await ensureBiometricProfile(admin, opts.entity);
  console.log("[bootstrap:solo] biometric_profile: ready (baseline_training_remaining=0)");

  const baseUrl =
    process.env.MSGF_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_APP_URL?.trim() ||
    "http://127.0.0.1:3001";

  console.log("\n--- Add to packages/msgf/.env.local (or integrator .env) ---\n");
  console.log(`MSGF_APP_URL=${baseUrl}`);
  console.log(`MSGF_SOLO_TENANT_ID=${opts.tenant}`);
  console.log(`MSGF_SOLO_ENTITY_ID=${opts.entity}`);
  console.log("MSGF_CREDIT_GUARD_DISABLED=1");
  console.log("MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=1");

  if (!opts.skipLicense) {
    const { plainKey, row } = await mintLicense(admin, opts.tenant, opts.credits);
    console.log(`MSGF_CONTRACT_LICENSE_KEY=${plainKey}`);
    console.log("\nLicense row:", JSON.stringify(row, null, 2));
    console.log("\nIntegrator headers for POST /api/msgf/pulse:");
    console.log(`  Authorization: Bearer ${plainKey}`);
    console.log(`  x-msgf-license-key: ${plainKey}`);
    console.log(`  x-msgf-ide-pulse: 1`);
    console.log(`  x-msgf-entity-id: ${opts.entity}`);
    console.log(`  x-msgf-tenant-id: ${opts.tenant}`);
  }

  console.log("\nNext: npm run dev -w msgf  →  npm run probe:solo -w msgf");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
