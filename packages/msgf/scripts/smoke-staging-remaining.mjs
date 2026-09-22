#!/usr/bin/env node
/**
 * One-tenant staging smokes we can run without a card or expired Shadow trial.
 * Does not print secrets.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BASE = (
  process.env.MSGF_APP_URL || "https://staging.elphiesgatedai.elphiesyntax.com"
).replace(/\/+$/, "");

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

const env = {
  ...parseEnv(path.join(ROOT, "packages/msgf/.env.staging.local")),
  ...process.env,
};

const LICENSE = (env.MSGF_CONTRACT_LICENSE_KEY || "").trim();
const TENANT = (env.MSGF_SOLO_TENANT_ID || "staging_readiness").trim();
const ENTITY = (env.MSGF_SOLO_ENTITY_ID || crypto.randomUUID()).trim();
const CRON = (env.MSGF_STAGING_OPS_CRON_SECRET || env.MSGF_OPS_CRON_SECRET || "").trim();

if (!LICENSE) {
  console.error("missing MSGF_CONTRACT_LICENSE_KEY");
  process.exit(1);
}

const results = [];

function licenseHeaders(extra = {}) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${LICENSE}`,
    "x-msgf-license-key": LICENSE,
    "x-msgf-key": LICENSE,
    "x-msgf-ide-pulse": "1",
    "x-msgf-tenant-id": TENANT,
    "X-MSGF-Tenant-Key": TENANT,
    "x-msgf-entity-id": ENTITY,
    ...extra,
  };
}

async function hit(name, url, init = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    const row = {
      name,
      status: res.status,
      ok: res.ok,
      ms: Date.now() - started,
      json,
      text: text.slice(0, 700),
      headers: {
        routing: res.headers.get("x-msgf-routing"),
      },
    };
    results.push(row);
    return row;
  } catch (e) {
    const row = {
      name,
      status: 0,
      ok: false,
      ms: Date.now() - started,
      json: null,
      text: e instanceof Error ? e.message : String(e),
      headers: {},
    };
    results.push(row);
    return row;
  }
}

function sampleKeystrokes() {
  let ts = Date.now();
  return ["h", "e", "l", "l", "o"].map((key, i) => {
    ts += 40 + i * 3;
    return { ts, key, type: "keydown", flightMs: 40, dwellMs: 70, target: "staging-smoke" };
  });
}

function summarize(row, extra = {}) {
  const mark = row.ok ? "PASS" : "FAIL";
  const bits = {
    status: row.status,
    routing: row.headers.routing || undefined,
    ...extra,
  };
  console.log(`[${mark}] ${row.name} HTTP ${row.status} ${row.ms}ms ${JSON.stringify(bits)}`);
}

const foreign = "not_this_tenant_zzz";

const features = await hit("GET /features", `${BASE}/features`, { method: "GET" });
summarize(features);

const ingest = await hit("POST /api/msgf/ingest", `${BASE}/api/msgf/ingest`, {
  method: "POST",
  headers: licenseHeaders({ "x-msgf-api-key": LICENSE }),
  body: JSON.stringify({
    tenant_id: TENANT,
    project_origin: "staging-readiness-smoke",
    files: [
      {
        path: "docs/staging-readiness-smoke.md",
        content: "# Staging readiness ingest\nTenant-scoped SWEEP smoke. No secrets.\n",
      },
    ],
  }),
});
summarize(ingest, {
  lineage: Boolean(ingest.json?.lineage_map),
  brain: ingest.json?.brain_fully_initialized ?? ingest.json?.readiness_score,
  err: ingest.json?.error,
});

const heal = await hit(
  "GET /api/msgf/heal-queue user",
  `${BASE}/api/msgf/heal-queue?tenant_id=${encodeURIComponent(TENANT)}`,
  { headers: licenseHeaders() }
);
summarize(heal, {
  audience: heal.json?.audience_scope,
  arb: Array.isArray(heal.json?.human_arbitration_packages)
    ? heal.json.human_arbitration_packages.length
    : undefined,
  tasks: Array.isArray(heal.json?.remediation_tasks)
    ? heal.json.remediation_tasks.length
    : undefined,
});

const periodForeign = await hit(
  "GET period-reports foreign",
  `${BASE}/api/msgf/dashboard/period-reports?tenant_id=${encodeURIComponent(foreign)}`,
  { headers: licenseHeaders({ "x-msgf-tenant-id": foreign, "X-MSGF-Tenant-Key": foreign }) }
);
summarize(periodForeign, { tenant: periodForeign.json?.tenant_id, err: periodForeign.json?.error });

const shadowEvalForeign = await hit(
  "GET shadow-eval foreign",
  `${BASE}/api/msgf/dashboard/shadow-eval?tenant_id=${encodeURIComponent(foreign)}`,
  { headers: licenseHeaders({ "x-msgf-tenant-id": foreign, "X-MSGF-Tenant-Key": foreign }) }
);
summarize(shadowEvalForeign, {
  tenant: shadowEvalForeign.json?.tenant_id,
  err: shadowEvalForeign.json?.error,
});

const periodOwn = await hit(
  "GET period-reports own",
  `${BASE}/api/msgf/dashboard/period-reports?tenant_id=${encodeURIComponent(TENANT)}`,
  { headers: licenseHeaders() }
);
summarize(periodOwn, { tenant: periodOwn.json?.tenant_id, err: periodOwn.json?.error });

const savings = await hit(
  "GET savings-features",
  `${BASE}/api/msgf/dashboard/savings-features?tenant_id=${encodeURIComponent(TENANT)}`,
  { headers: licenseHeaders() }
);
summarize(savings, { err: savings.json?.error, keys: savings.json ? Object.keys(savings.json).slice(0, 8) : [] });

const completionsBody = JSON.stringify({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "MSGF staging shadow eval — do not spend." }],
  max_tokens: 8,
  stream: false,
});

const shadow = await hit("POST completions shadow", `${BASE}/api/v1/chat/completions`, {
  method: "POST",
  headers: licenseHeaders({
    "x-msgf-mode": "shadow",
    Authorization: "Bearer sk-staging-placeholder-no-live-spend",
  }),
  body: completionsBody,
});
summarize(shadow, {
  code: shadow.json?.error?.code || shadow.json?.error,
  spoofed: /spoofed-rc-tenant/i.test(shadow.text),
});

const active = await hit("POST completions active", `${BASE}/api/v1/chat/completions`, {
  method: "POST",
  headers: licenseHeaders({
    "x-msgf-mode": "active",
    "x-msgf-tenant-id": "spoofed-rc-tenant",
    "X-MSGF-Tenant-Key": "spoofed-rc-tenant",
    Authorization: "Bearer sk-staging-placeholder-no-live-spend",
  }),
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "MSGF staging active routing check." }],
    max_tokens: 8,
    stream: false,
  }),
});
summarize(active, {
  code: active.json?.error?.code || active.json?.error,
  spoofed: /spoofed-rc-tenant/i.test(active.text),
});

const swarm = await hit("POST pulse swarm abort", `${BASE}/api/msgf/pulse`, {
  method: "POST",
  headers: licenseHeaders({
    "x-msgf-agent-id": `rc-child-${crypto.randomUUID().slice(0, 8)}`,
    "x-msgf-parent-agent-id": `rc-parent-${crypto.randomUUID().slice(0, 8)}`,
    "x-msgf-agent-role": "secondary",
  }),
  body: JSON.stringify({ keystrokes: sampleKeystrokes() }),
});
summarize(swarm, {
  err: swarm.json?.error,
  code: swarm.json?.code,
  hasKeyLists: /"(blocked_keys|promoted_keys)"\s*:\s*\[/.test(swarm.text),
});

const sentry = await hit("GET /api/sentry-test", `${BASE}/api/sentry-test`);
summarize(sentry, { err: sentry.json?.error });

if (CRON) {
  const hb = await hit("POST v32-heartbeat dry_run", `${BASE}/api/msgf/ops/v32-heartbeat`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON}`,
      "X-MSGF-Ops-Cron-Secret": CRON,
    },
    body: JSON.stringify({ dry_run: true, skip_hall_purge: true, skip_scheduled_heal: true }),
  });
  summarize(hb, { err: hb.json?.error, okFlag: hb.json?.ok });
} else {
  console.log("[SKIP] v32-heartbeat — no staging cron secret in env");
}

const shadowEvalOwn = await hit(
  "GET shadow-eval own after gateway",
  `${BASE}/api/msgf/dashboard/shadow-eval?tenant_id=${encodeURIComponent(TENANT)}`,
  { headers: licenseHeaders() }
);
summarize(shadowEvalOwn, {
  tenant: shadowEvalOwn.json?.tenant_id,
  err: shadowEvalOwn.json?.error,
  rows: shadowEvalOwn.json?.rows?.length ?? shadowEvalOwn.json?.items?.length,
});

const out = {
  base: BASE,
  tenant: TENANT,
  ingest_lineage: Boolean(ingest.json?.lineage_map),
  ingest_brain: ingest.json?.brain_fully_initialized ?? null,
  heal_audience: heal.json?.audience_scope ?? null,
  heal_arbitration: heal.json?.human_arbitration_packages ?? null,
  foreign_period: periodForeign.status,
  foreign_shadow: shadowEvalForeign.status,
  shadow_status: shadow.status,
  active_status: active.status,
  active_routing: active.headers.routing,
  swarm_status: swarm.status,
  swarm_error: swarm.json?.error ?? swarm.json?.code ?? null,
  features_status: features.status,
  sentry_status: sentry.status,
};
console.log("\nSUMMARY " + JSON.stringify(out));
