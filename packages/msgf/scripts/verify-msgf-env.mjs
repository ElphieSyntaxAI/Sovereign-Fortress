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
 * Phase 0 — MSGF environment verification (modular path).
 *
 * Checks monorepo root `.env` / `.env.local` (via npm --env-file-if-exists) for MSGF variables
 * and validates Vertex `service-account.json` in packages/msgf.
 *
 * Usage (from repo root):
 *   npm run verify:msgf-env -w msgf
 *
 * Usage (from packages/msgf):
 *   node --env-file-if-exists=../../.env --env-file-if-exists=../../.env.local scripts/verify-msgf-env.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const msgfRoot = path.join(__dirname, "..");
const repoRoot = path.join(msgfRoot, "..", "..");
const require = createRequire(import.meta.url);

/** Fallback when Node --env-file-if-exists skips paths on Windows. */
function loadDotenvFallback() {
  try {
    const dotenv = require("dotenv");
    for (const p of [
      path.join(repoRoot, ".env"),
      path.join(repoRoot, ".env.local"),
      path.join(msgfRoot, ".env"),
      path.join(msgfRoot, ".env.local"),
    ]) {
      if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
    }
  } catch {
    /* dotenv optional */
  }
}
const { assertServiceAccountPresent, getServiceAccountPath } = require("../msgf-init.cjs");

const REQUIRED_ENV = [
  {
    keys: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
    label: "Supabase project URL",
    hint: "Dashboard → Project Settings → API",
  },
  {
    keys: ["SUPABASE_SERVICE_ROLE_KEY"],
    label: "Supabase service role key",
    hint: "Required for admin scripts and LOM DB assertions",
  },
];

// Stripe should not block free-tier / BYOK readiness.
// Mirror the runtime behavior in `middleware/entitlementGuard.ts`:
// by default we mock Stripe unless the webhook is explicitly marked live.
const stripeWebhookLive = process.env.MSGF_STRIPE_WEBHOOK_LIVE?.trim().toLowerCase() === "true";
const mockStripeActive = (() => {
  const v = process.env.MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  // Default mock ON until Stripe webhook is production-ready.
  return process.env.MSGF_STRIPE_WEBHOOK_LIVE?.trim().toLowerCase() !== "true";
})();

// Only require Stripe secrets when Stripe is truly live (mock off).
if (stripeWebhookLive && !mockStripeActive) {
  REQUIRED_ENV.push(
    {
      keys: ["STRIPE_SECRET_KEY"],
      label: "Stripe secret key",
      hint: "Dashboard → Developers → API keys (test mode for dev)",
    },
    {
      keys: ["STRIPE_WEBHOOK_SECRET"],
      label: "Stripe webhook signing secret",
      hint: "From `stripe listen` or Dashboard → Webhooks",
    }
  );
}

const RECOMMENDED_ENV = [
  {
    keys: ["MSGF_ENABLE_LOM_TEST"],
    label: "LOM test harness flag",
    hint: 'Set to "1" or "true" before npm run test:lom-disagreement',
  },
  {
    keys: ["MSGF_INGEST_API_KEY"],
    label: "Tenant ingest API key",
    hint: "Only when MSGF_TENANT_API_KEYS / ingest key-gating is enabled",
  },
  {
    keys: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"],
    label: "Supabase anon/publishable key",
    hint: "Next middleware session + credit guard actor resolution",
  },
  {
    keys: ["MSGF_AUTH_COOKIE_DOMAIN"],
    label: "Shared auth cookie domain",
    hint: "Optional until Author cross-subdomain integration (e.g. .elphiesyntax.com)",
  },
];

function firstSet(keys) {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return { key: k, value: v };
  }
  return null;
}

function mask(value) {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
}

function checkEnvGroup(entries, { required }) {
  let failed = 0;
  for (const entry of entries) {
    const hit = firstSet(entry.keys);
    if (hit) {
      console.log(`OK: ${entry.label} (${hit.key}=${mask(hit.value)})`);
      if (entry.keys[0] === "MSGF_ENABLE_LOM_TEST") {
        const v = hit.value.toLowerCase();
        if (v !== "1" && v !== "true" && v !== "yes") {
          console.warn(
            `WARN: MSGF_ENABLE_LOM_TEST is set but not enabled (${hit.value}). LOM test needs "1" or "true".`
          );
        }
      }
    } else {
      const names = entry.keys.join(" or ");
      if (required) {
        console.error(`FAIL: Missing ${entry.label} — set ${names}`);
        console.error(`      ${entry.hint}`);
        failed += 1;
      } else {
        console.warn(`WARN: Missing ${entry.label} — optional: ${names}`);
        console.warn(`      ${entry.hint}`);
      }
    }
  }
  return failed;
}

function checkRedisHotLayer() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (upstashUrl && upstashToken) {
    if (upstashUrl.includes("-box-") || upstashToken.startsWith("box_")) {
      console.warn(
        "WARN: UPSTASH_* looks like Upstash Box, not Redis REST. Create a Redis database in console.upstash.com and use its REST URL/token, or use REDIS_URL locally."
      );
    } else {
      console.log(`OK: Upstash Redis REST (${mask(upstashToken)})`);
      return 0;
    }
  } else if (upstashUrl || upstashToken) {
    console.warn(
      "WARN: Incomplete Upstash Redis env (need both URL and TOKEN). Falling back to REDIS_HOST / REDIS_URL check."
    );
  }

  const hit = firstSet(["REDIS_HOST", "REDIS_URL"]);
  if (hit) {
    console.log(`OK: Redis TCP (${hit.key}=${mask(hit.value)})`);
    return 0;
  }
  console.error("FAIL: Missing Redis (V3.2 hot layer)");
  console.error(
    "      Upstash Redis: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (console → Redis → REST)"
  );
  console.error("      Or local/Memorystore: REDIS_URL or REDIS_HOST");
  return 1;
}

function checkServiceAccount() {
  const saPath = getServiceAccountPath();
  try {
    assertServiceAccountPresent();
    console.log(`OK: service-account.json at ${saPath}`);
    return 0;
  } catch (e) {
    const gcp = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    if (gcp && fs.existsSync(gcp)) {
      console.log(`OK: GOOGLE_APPLICATION_CREDENTIALS → ${gcp}`);
      return 0;
    }
    console.error(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    if (gcp) {
      console.error(`      GOOGLE_APPLICATION_CREDENTIALS is set but file not found: ${gcp}`);
    } else {
      console.error(
        "      Place packages/msgf/service-account.json or set GOOGLE_APPLICATION_CREDENTIALS."
      );
    }
    return 1;
  }
}

function main() {
  loadDotenvFallback();
  console.log("MSGF Phase 0 — verify-msgf-env");
  console.log(`MSGF package root: ${msgfRoot}`);
  console.log("");

  let failed = 0;
  failed += checkEnvGroup(
    REQUIRED_ENV.filter((e) => !e.label.includes("Redis")),
    { required: true }
  );
  failed += checkRedisHotLayer();
  console.log("");
  checkEnvGroup(RECOMMENDED_ENV, { required: false });
  console.log("");
  failed += checkServiceAccount();

  console.log("");
  if (failed > 0) {
    console.error(
      `verify-msgf-env: ${failed} required check(s) failed. Copy .env.example → .env.local at repo root.`
    );
    process.exit(1);
  }
  console.log("verify-msgf-env: all required MSGF Phase 0 checks passed.");
}

main();
