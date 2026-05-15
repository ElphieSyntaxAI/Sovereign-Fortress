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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
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
const require = createRequire(import.meta.url);
const { assertServiceAccountPresent, getServiceAccountPath } = require("../msgf-init.js");

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
  {
    keys: ["REDIS_HOST", "REDIS_URL"],
    label: "Redis (V3.2 hot layer)",
    hint:
      "REDIS_HOST (+ optional REDIS_PORT, REDIS_PASSWORD) for Memorystore/Docker DNS; or REDIS_URL e.g. redis://127.0.0.1:6379 / Upstash / rediss://",
  },
  {
    keys: ["STRIPE_SECRET_KEY"],
    label: "Stripe secret key",
    hint: "Dashboard → Developers → API keys (test mode for dev)",
  },
  {
    keys: ["STRIPE_WEBHOOK_SECRET"],
    label: "Stripe webhook signing secret",
    hint: "From `stripe listen` or Dashboard → Webhooks",
  },
  {
    keys: ["MSGF_ENABLE_LOM_TEST"],
    label: "LOM test harness flag",
    hint: 'Set to "1" or "true" before npm run test:lom-disagreement',
  },
  {
    keys: ["MSGF_INGEST_API_KEY"],
    label: "Tenant ingest API key",
    hint: "Matches MSGF tenant key config when ingest is key-gated",
  },
];

const RECOMMENDED_ENV = [
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
  console.log("MSGF Phase 0 — verify-msgf-env");
  console.log(`MSGF package root: ${msgfRoot}`);
  console.log("");

  let failed = 0;
  failed += checkEnvGroup(REQUIRED_ENV, { required: true });
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
