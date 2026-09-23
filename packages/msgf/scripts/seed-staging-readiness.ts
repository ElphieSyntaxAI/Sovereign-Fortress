#!/usr/bin/env tsx
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
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-08289e1a-20260923T145027Z-internal
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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
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
 * Distribution Build ID: MSGF-1826a636-20260922T233446Z-internal
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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Seed the STAGING Supabase project for product-readiness tests.
 * Refuses production DEPLOY_ENV and production Supabase hosts.
 *
 *   npm run staging:seed
 *   npm run staging:seed -- --reset-operator-password
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

import {
  STAGING_AUTHOR_TENANT_ID,
  STAGING_BUYER_EMAIL_DEFAULT,
  assertStagingSeedTarget,
  firstGlobalAdminEmail,
  hostOf,
  runStagingReadinessSeed,
} from "../lib/staging-readiness-seed.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const STAGING_LOCAL = path.join(ROOT, "packages", "msgf", ".env.staging.local");
const CLOUDRUN_STAGING = path.join(ROOT, ".env.cloudrun.staging");

function parseEnv(text: string) {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}

function loadFile(p: string) {
  if (!fs.existsSync(p)) return {};
  return parseEnv(fs.readFileSync(p, "utf8"));
}

function upsertEnvFile(filePath: string, updates: Record<string, string>) {
  let text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (text && !text.endsWith("\n")) text += "\n";
  const lines = text ? text.split(/\n/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const raw = line.replace(/\r$/, "");
    const t = raw.trim();
    if (t && !t.startsWith("#") && t.includes("=")) {
      const k = t.slice(0, t.indexOf("=")).trim();
      if (Object.prototype.hasOwnProperty.call(updates, k)) {
        out.push(`${k}=${updates[k]}`);
        seen.add(k);
        continue;
      }
    }
    out.push(raw);
  }
  const missing = Object.keys(updates).filter((k) => !seen.has(k) && updates[k]);
  if (missing.length) {
    if (out.length && out[out.length - 1] !== "") out.push("");
    out.push("# Staging readiness seed (gitignored)");
    for (const k of missing) out.push(`${k}=${updates[k]}`);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  fs.writeFileSync(filePath, `${out.join("\n")}\n`, "utf8");
}

function productionSupabaseHosts() {
  const hosts = new Set<string>();
  for (const rel of [".env.cloudrun", "packages/msgf/.env.local", ".env.local"]) {
    const env = loadFile(path.join(ROOT, rel));
    const h = hostOf(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "");
    if (h) hosts.add(h);
  }
  return hosts;
}

function parseArgs(argv: string[]) {
  let operatorEmail = "";
  let operatorPassword = "";
  let resetOperatorPassword = false;
  let applyBff = false;
  for (const arg of argv) {
    if (arg.startsWith("--email=")) operatorEmail = arg.slice("--email=".length).trim();
    else if (arg.startsWith("--password=")) operatorPassword = arg.slice("--password=".length);
    else if (arg === "--reset-operator-password") resetOperatorPassword = true;
    else if (arg === "--apply-bff") applyBff = true;
  }
  return { operatorEmail, operatorPassword, resetOperatorPassword, applyBff };
}

const merged = {
  ...loadFile(path.join(ROOT, ".env.staging.local")),
  ...loadFile(STAGING_LOCAL),
  ...loadFile(CLOUDRUN_STAGING),
};

assertStagingSeedTarget({
  deployEnv: merged.DEPLOY_ENV || "staging",
  supabaseUrl: merged.NEXT_PUBLIC_SUPABASE_URL || merged.SUPABASE_URL,
  productionSupabaseHosts: productionSupabaseHosts(),
});

const url = (merged.NEXT_PUBLIC_SUPABASE_URL || merged.SUPABASE_URL || "").trim();
const serviceRole = (merged.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url || !serviceRole) {
  console.error("Missing staging NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const operatorEmail =
  args.operatorEmail || firstGlobalAdminEmail(merged.MSGF_GLOBAL_ADMIN_EMAILS);

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const result = await runStagingReadinessSeed(admin, {
  operatorEmail,
  operatorPassword: args.operatorPassword || undefined,
  resetOperatorPassword: args.resetOperatorPassword,
  buyerEmail: merged.STAGING_BUYER_EMAIL || STAGING_BUYER_EMAIL_DEFAULT,
});

const updates: Record<string, string> = {
  MSGF_SOLO_TENANT_ID: result.soloTenantId,
  MSGF_SOLO_ENTITY_ID: result.operator.userId,
  MSGF_AUTHOR_TENANT_ID: result.authorTenantId,
  MSGF_GLOBAL_ADMIN_EMAILS: result.operator.email,
  STAGING_OPERATOR_EMAIL: result.operator.email,
  STAGING_BUYER_EMAIL: result.buyer.email,
};
if (result.soloLicense.plaintextKey) {
  updates.MSGF_CONTRACT_LICENSE_KEY = result.soloLicense.plaintextKey;
}
if (result.authorLicense.plaintextKey) {
  updates.MSGF_AUTHOR_PULSE_LICENSE_KEY = result.authorLicense.plaintextKey;
}
if (result.operator.password) {
  updates.STAGING_OPERATOR_PASSWORD = result.operator.password;
}
if (result.buyer.password) {
  updates.STAGING_BUYER_PASSWORD = result.buyer.password;
}
upsertEnvFile(STAGING_LOCAL, updates);

const msgfUrl = "https://staging.elphiesgatedai.elphiesyntax.com";
console.log("Staging readiness seed complete.");
console.log(`  supabase_host=${hostOf(url)}`);
console.log(`  operator=${result.operator.email} created=${result.operator.created}`);
console.log(`  buyer=${result.buyer.email} created=${result.buyer.created}`);
console.log(`  solo_tenant=${result.soloTenantId} license_minted=${result.soloLicense.created}`);
console.log(
  `  author_tenant=${result.authorTenantId} license_minted=${result.authorLicense.created}`
);
if (result.operator.password) {
  console.log("  operator password written to packages/msgf/.env.staging.local (STAGING_OPERATOR_PASSWORD)");
} else {
  console.log("  operator already existed — password not rotated");
}
if (result.buyer.password) {
  console.log("  buyer password written to packages/msgf/.env.staging.local (STAGING_BUYER_PASSWORD)");
}
console.log(`  sign in: ${msgfUrl}/admin/sign-in?next=/admin/seed`);
console.log(`  seed UI: ${msgfUrl}/admin/seed`);
console.log("  Next: npm run staging:prepare  then redeploy author-bff-staging if a new pulse license was minted.");

if (args.applyBff) {
  const license =
    result.authorLicense.plaintextKey ||
    loadFile(STAGING_LOCAL).MSGF_AUTHOR_PULSE_LICENSE_KEY ||
    "";
  if (!license) {
    console.warn("  --apply-bff skipped: no MSGF_AUTHOR_PULSE_LICENSE_KEY available.");
  } else {
    const applied = spawnSync(
      "gcloud",
      [
        "run",
        "services",
        "update",
        "author-bff-staging",
        "--project=msgf-shield",
        "--region=us-central1",
        `--update-env-vars=MSGF_AUTHOR_PULSE_LICENSE_KEY=${license},MSGF_AUTHOR_TENANT_ID=${STAGING_AUTHOR_TENANT_ID},MSGF_APP_URL=${msgfUrl},MSGF_AUTHOR_HAL_PULSE_ENABLED=1`,
      ],
      { stdio: "inherit", cwd: ROOT, shell: process.platform === "win32" }
    );
    if (applied.status !== 0) {
      console.error("gcloud BFF env update failed.");
      process.exit(applied.status ?? 1);
    }
  }
}
