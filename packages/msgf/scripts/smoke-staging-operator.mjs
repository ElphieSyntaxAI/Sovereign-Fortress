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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BASE = "https://staging.elphiesgatedai.elphiesyntax.com";

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = parseEnv(path.join(ROOT, "packages/msgf/.env.staging.local"));
const email = env.STAGING_OPERATOR_EMAIL || env.MSGF_GLOBAL_ADMIN_EMAILS?.split(",")[0];
const password = env.STAGING_OPERATOR_PASSWORD;
const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/+$/, "");
const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const tenant = env.MSGF_SOLO_TENANT_ID || "staging_readiness";

if (!email || !password || !supabaseUrl || !anon) {
  console.error("missing operator or supabase env");
  process.exit(1);
}

const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: {
    apikey: anon,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password }),
});
const authJson = await authRes.json();
if (!authRes.ok || !authJson.access_token) {
  console.log("operator_login", authRes.status, authJson.error_description || authJson.msg || authJson.error);
  process.exit(1);
}
console.log("operator_login", authRes.status, "ok");

const ref = new URL(supabaseUrl).hostname.split(".")[0];
const cookieName = `sb-${ref}-auth-token`;
const cookieVal = encodeURIComponent(JSON.stringify(authJson));
const cookie = `${cookieName}=${cookieVal}`;

async function hit(name, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Cookie: cookie,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const extra = {
    audience: json?.audience_scope,
    err: json?.error,
    ok: json?.ok,
    tenant: json?.tenant_id,
    rows: json?.rows?.length ?? json?.items?.length ?? json?.events?.length,
    chips: json?.p7 ?? json?.filters,
  };
  console.log(`[${res.ok ? "PASS" : "FAIL"}] ${name} HTTP ${res.status} ${JSON.stringify(extra)}`);
  return { status: res.status, ok: res.ok, json, text: text.slice(0, 500) };
}

await hit(
  "heal-queue admin session",
  `${BASE}/api/msgf/heal-queue?tenant_id=${encodeURIComponent(tenant)}`
);
await hit(
  "period-reports own session",
  `${BASE}/api/msgf/dashboard/period-reports?tenant_id=${encodeURIComponent(tenant)}`
);
await hit(
  "period-reports foreign session",
  `${BASE}/api/msgf/dashboard/period-reports?tenant_id=${encodeURIComponent("not_this_tenant_zzz")}`
);
await hit(
  "shadow-eval own session",
  `${BASE}/api/msgf/dashboard/shadow-eval?tenant_id=${encodeURIComponent(tenant)}`
);
await hit(
  "savings-features session",
  `${BASE}/api/msgf/dashboard/savings-features?tenant_id=${encodeURIComponent(tenant)}`
);
await hit("audit-hub p7=blocked", `${BASE}/api/msgf/admin/audit-hub?p7=blocked&tenant_id=${encodeURIComponent(tenant)}`);
await hit("audit-hub p7=promoted", `${BASE}/api/msgf/admin/audit-hub?p7=promoted&tenant_id=${encodeURIComponent(tenant)}`);
await hit("audit-hub q=bot_swarm", `${BASE}/api/msgf/admin/audit-hub?q=bot_swarm&tenant_id=${encodeURIComponent(tenant)}`);
await hit(
  "period-reports pdf",
  `${BASE}/api/msgf/dashboard/period-reports/pdf?tenant_id=${encodeURIComponent(tenant)}&scope=all`
);
