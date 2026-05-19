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
 * Distribution Build ID: MSGF-753c05a-20260519T051006Z-internal
 */
/**
 * Mint a contract-based MSGF license key (shown once; only the SHA-256 hash is stored).
 *
 * Usage (from repo root):
 *   npm run mint:license -w msgf -- --tenant=author_ecosystem --tier=brain_contract --credits=10000
 *
 * Usage (from packages/msgf):
 *   node --env-file-if-exists=../../.env --env-file-if-exists=../../.env.local scripts/mint-license.mjs \
 *     --tenant=author_ecosystem --tier=brain_contract --credits=10000
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 * Migration: 20260527120000_msgf_licensing.sql applied on the target project.
 */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const out = {
    tenant: "author_ecosystem",
    tier: "brain_contract",
    credits: 10_000,
    status: "active",
  };

  for (const arg of argv) {
    if (arg.startsWith("--tenant=")) out.tenant = arg.slice("--tenant=".length).trim();
    else if (arg.startsWith("--tier=")) out.tier = arg.slice("--tier=".length).trim();
    else if (arg.startsWith("--credits=")) {
      const n = Number(arg.slice("--credits=".length));
      if (!Number.isFinite(n) || n < 0) throw new Error("--credits must be a non-negative number");
      out.credits = Math.floor(n);
    } else if (arg.startsWith("--status=")) out.status = arg.slice("--status=".length).trim();
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: mint-license.mjs [options]

Options:
  --tenant=<slug>     Tenant id (default: author_ecosystem)
  --tier=<slug>       Contract tier slug (default: brain_contract)
  --credits=<n>       credits_total (default: 10000)
  --status=<text>     active | revoked | suspended | expired (default: active)
`);
      process.exit(0);
    }
  }

  const allowed = new Set(["active", "revoked", "suspended", "expired"]);
  if (!allowed.has(out.status)) {
    throw new Error(`Invalid --status=${out.status}; allowed: ${[...allowed].join(", ")}`);
  }
  if (!out.tenant) throw new Error("--tenant is required");
  if (!out.tier) throw new Error("--tier is required");

  return out;
}

function sha256HexUtf8(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function mintPlaintextKey() {
  const secret = crypto.randomBytes(32);
  return `msgf_live_${secret.toString("base64url")}`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRole) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  const plainKey = mintPlaintextKey();
  const licenseKeyHash = sha256HexUtf8(plainKey);

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("msgf_licenses")
    .insert({
      license_key_hash: licenseKeyHash,
      tenant_id: opts.tenant,
      tier_id: opts.tier,
      credits_total: opts.credits,
      credits_used: 0,
      status: opts.status,
    })
    .select("id, tenant_id, tier_id, credits_total, status, created_at")
    .single();

  if (error) {
    console.error("Insert failed:", error.message);
    if (error.code === "42P01") {
      console.error("Hint: apply migration 20260527120000_msgf_licensing.sql to this Supabase project.");
    }
    process.exit(1);
  }

  console.log("MSGF license minted (store the key below securely; it cannot be recovered):");
  console.log("");
  console.log(plainKey);
  console.log("");
  console.log("Record (hash only in database):");
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
