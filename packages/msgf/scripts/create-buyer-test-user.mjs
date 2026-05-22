#!/usr/bin/env node
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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
/**
 * Create a fresh Supabase auth user for MSGF buyer walkthrough (no integrator license).
 *
 *   npm run create:buyer-user -w msgf
 *   npm run create:buyer-user -w msgf -- --email=buyer@example.com --password='TestPass123!'
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  let email = "";
  let password = `BuyerTest!${crypto.randomBytes(4).toString("hex")}`;
  for (const arg of argv) {
    if (arg.startsWith("--email=")) email = arg.slice("--email=".length).trim();
    else if (arg.startsWith("--password=")) password = arg.slice("--password=".length);
    else if (arg === "--help" || arg === "-h") {
      console.log(`create-buyer-test-user
  --email=...       Default: buyer+<timestamp>@msgf-buyer.test
  --password=...    Default: random BuyerTest!<hex>
`);
      process.exit(0);
    }
  }
  if (!email) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    email = `buyer+${stamp}@msgf-buyer.test`;
  }
  return { email, password };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    console.error("[create:buyer-user] Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const { email, password } = parseArgs(process.argv.slice(2));
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error("[create:buyer-user] failed:", error.message);
    process.exit(1);
  }

  const userId = data.user?.id ?? "";
  console.log("\n[buyer-user] Created — use incognito / separate browser\n");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  User id:  ${userId}`);
  console.log("\nNext (buyer journey):");
  console.log("  1. npm run dev -w msgf");
  console.log("  2. Comment out MSGF_CONTRACT_LICENSE_KEY in packages/msgf/.env.local");
  console.log("  3. http://127.0.0.1:3000/sign-in  (not sign-up if email already confirmed)");
  console.log("  4. Open /dashboard once (onboarding: pledge + pillars + p4_profiles)");
  console.log("  5. Optional: /pricing → Stripe test checkout");
  console.log("  6. Copy session cookie → MSGF_PULSE_COOKIE → npm run probe:buyer -w msgf");
  console.log("\nDocs: docs/MSGF_BUYER_WALKTHROUGH.md\n");
}

main();
