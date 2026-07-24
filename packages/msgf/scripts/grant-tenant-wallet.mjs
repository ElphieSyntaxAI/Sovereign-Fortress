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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221141Z-internal
 */
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T220451Z-internal
 */
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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
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
 * Distribution Build ID: MSGF-48a02b8-20260530T050211Z-internal
 */
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045550Z-internal
 */
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045125Z-internal
 */
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
 * Distribution Build ID: MSGF-48a02b8-20260530T044603Z-internal
 */
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
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * Grant MSGF tenant token wallet balance (service role).
 *
 *   node scripts/grant-tenant-wallet.mjs --email=jessica@dealstar.io --amount=100000
 *   node scripts/grant-tenant-wallet.mjs --tenant=deckhostwmsgf/deck_host --amount=50000
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const msgfRoot = path.join(__dirname, "..");
const repoRoot = path.join(msgfRoot, "..", "..");
const require = createRequire(import.meta.url);

for (const p of [
  path.join(repoRoot, ".env"),
  path.join(repoRoot, ".env.local"),
  path.join(msgfRoot, ".env"),
  path.join(msgfRoot, ".env.local"),
]) {
  if (fs.existsSync(p)) require("dotenv").config({ path: p, override: true });
}

const { createClient } = await import("@supabase/supabase-js");

function parseArgs() {
  let email = "";
  let tenant = "";
  let amount = 100_000;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--email=")) email = arg.slice(8).trim().toLowerCase();
    else if (arg.startsWith("--tenant=")) tenant = arg.slice(9).trim();
    else if (arg.startsWith("--amount=")) amount = Math.max(0, Number.parseInt(arg.slice(9), 10) || 0);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  --email=<addr>   Resolve user → tenant via ide tokens / profile / projects
  --tenant=<id>    Skip lookup; credit this tenant_id directly
  --amount=<n>     Tokens to add (default: 100000)`);
      process.exit(0);
    }
  }
  return { email, tenant, amount };
}

async function findUserIdByEmail(admin, email) {
  let page = 1;
  const perPage = 200;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function resolveTenantForUser(admin, userId) {
  const tenants = new Set();

  const { data: ideRows } = await admin
    .from("msgf_ide_tokens")
    .select("tenant_id, expires_at, revoked_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("expires_at", { ascending: false })
    .limit(5);
  for (const row of ideRows ?? []) {
    if (row.tenant_id?.trim()) tenants.add(row.tenant_id.trim());
  }

  const { data: profile } = await admin
    .from("p4_profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.tenant_id?.trim()) tenants.add(profile.tenant_id.trim());

  const { data: projects } = await admin
    .from("msgf_user_projects")
    .select("project_origin")
    .eq("user_id", userId);
  for (const row of projects ?? []) {
    if (row.project_origin?.trim()) tenants.add(row.project_origin.trim());
  }

  return [...tenants];
}

async function addWalletBalance(admin, tenantId, amount) {
  const { data: existing, error: readErr } = await admin
    .from("msgf_tenant_token_wallet")
    .select("balance_tokens")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (readErr) throw new Error(`wallet read: ${readErr.message}`);

  const next = Number(existing?.balance_tokens ?? 0) + amount;
  const { error: upsertErr } = await admin.from("msgf_tenant_token_wallet").upsert(
    {
      tenant_id: tenantId,
      balance_tokens: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );
  if (upsertErr) throw new Error(`wallet upsert: ${upsertErr.message}`);
  return { previous: Number(existing?.balance_tokens ?? 0), next };
}

async function main() {
  const { email, tenant: tenantArg, amount } = parseArgs();
  if (!email && !tenantArg) {
    console.error("Provide --email= or --tenant=");
    process.exit(1);
  }
  if (amount <= 0) {
    console.error("--amount must be > 0");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let tenantIds = tenantArg ? [tenantArg] : [];

  if (!tenantIds.length && email) {
    const userId = await findUserIdByEmail(admin, email);
    if (!userId) {
      console.error(`No auth user found for ${email}`);
      process.exit(1);
    }
    console.log(`User: ${userId}`);
    tenantIds = await resolveTenantForUser(admin, userId);
    if (!tenantIds.length) {
      console.error(`No tenant found for ${email} (mint IDE token or complete dashboard setup first).`);
      process.exit(1);
    }
  }

  console.log(`Adding ${amount} tokens to ${tenantIds.length} tenant(s):`);
  for (const tenantId of tenantIds) {
    const { previous, next } = await addWalletBalance(admin, tenantId, amount);
    console.log(`  ${tenantId}: ${previous} → ${next}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
