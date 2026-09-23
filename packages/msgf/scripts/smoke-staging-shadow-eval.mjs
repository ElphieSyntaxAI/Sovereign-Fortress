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
/** Shadow/Active gateway + projected eval row. Does not print secrets. */
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
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

const env = {
  ...parseEnv(path.join(ROOT, "packages/msgf/.env.local")),
  ...parseEnv(path.join(ROOT, "packages/msgf/.env.staging.local")),
};

const LICENSE = (env.MSGF_CONTRACT_LICENSE_KEY || "").trim();
const TENANT = (env.MSGF_SOLO_TENANT_ID || "staging_readiness").trim();
const OPENAI = (env.OPENAI_API_KEY || "").trim();
const ANTHROPIC = (env.ANTHROPIC_API_KEY || env.MASTER_ANTHROPIC_KEY || "").trim();

function redact(s) {
  let out = String(s || "");
  for (const [label, value] of [
    ["LICENSE", LICENSE],
    ["OPENAI", OPENAI],
    ["ANTHROPIC", ANTHROPIC],
  ]) {
    if (value) out = out.split(value).join(`[${label}]`);
  }
  return out;
}

async function postGateway(name, mode) {
  if (OPENAI) {
    const res = await fetch(`${BASE}/api/v1/chat/completions`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI}`,
        "x-msgf-key": LICENSE,
        "x-msgf-mode": mode,
        "x-msgf-tenant-id": mode === "active" ? "spoofed-rc-tenant" : TENANT,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: `MSGF staging ${mode} eval` }],
        max_tokens: 8,
        stream: false,
      }),
    });
    const text = await res.text();
    return {
      name,
      status: res.status,
      routing: res.headers.get("x-msgf-routing"),
      spoofed: /spoofed-rc-tenant/i.test(text),
      snippet: redact(text).slice(0, 240),
    };
  }
  const res = await fetch(`${BASE}/api/v1/messages`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": ANTHROPIC,
      "anthropic-version": "2023-06-01",
      "x-msgf-key": LICENSE,
      "x-msgf-mode": mode,
      "x-msgf-tenant-id": mode === "active" ? "spoofed-rc-tenant" : TENANT,
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8,
      messages: [{ role: "user", content: `MSGF staging ${mode} eval` }],
    }),
  });
  const text = await res.text();
  return {
    name,
    status: res.status,
    routing: res.headers.get("x-msgf-routing"),
    spoofed: /spoofed-rc-tenant/i.test(text),
    snippet: redact(text).slice(0, 240),
  };
}

if (!LICENSE || (!OPENAI && !ANTHROPIC)) {
  console.error("missing license or AI key");
  process.exit(1);
}

const shadow = await postGateway("shadow", "shadow");
console.log(JSON.stringify(shadow));
const active = await postGateway("active", "active");
console.log(JSON.stringify(active));

await new Promise((r) => setTimeout(r, 3000));

const auth = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/token?grant_type=password`,
  {
    method: "POST",
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: env.STAGING_OPERATOR_EMAIL,
      password: env.STAGING_OPERATOR_PASSWORD,
    }),
  }
);
const aj = await auth.json();
if (!aj.access_token) {
  console.log("operator_login", auth.status, "failed");
  process.exit(1);
}
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookie = `sb-${ref}-auth-token=${encodeURIComponent(JSON.stringify(aj))}`;
const evalRes = await fetch(
  `${BASE}/api/msgf/dashboard/shadow-eval?tenant_id=${encodeURIComponent(TENANT)}`,
  { headers: { accept: "application/json", cookie } }
);
const ev = await evalRes.json();
const recent = Array.isArray(ev.recent) ? ev.recent : [];
console.log(
  JSON.stringify({
    eval_status: evalRes.status,
    recent: recent.length,
    first: recent[0]
      ? {
          endpoint: recent[0].endpoint,
          provider: recent[0].provider,
          mode: recent[0].mode,
          recommended: recent[0].recommended_action,
          projected: recent[0].projected_tokens ?? recent[0].projected_cost_usd,
        }
      : null,
    summary_keys: ev.summary ? Object.keys(ev.summary) : [],
    proof: ev.summary?.proof
      ? {
          evals: ev.summary.proof.eval_count ?? ev.summary.proof.evaluations,
          promoted: ev.summary.proof.would_have_promoted,
          blocked: ev.summary.proof.would_have_blocked,
        }
      : null,
    err: ev.error || null,
  })
);
