#!/usr/bin/env node
/**
 * Copy Stripe TEST keys from local MSGF env into packages/msgf/.env.staging.local.
 * Optionally create a Stripe test-mode webhook for staging Cloud Run.
 * Refuses sk_live_. Does not print secret values.
 *
 *   node scripts/seed-staging-stripe-from-local.mjs
 *   node scripts/seed-staging-stripe-from-local.mjs --skip-webhook
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipWebhook = process.argv.includes("--skip-webhook");
const STAGING_WEBHOOK_URL =
  process.env.STAGING_STRIPE_WEBHOOK_URL?.trim() ||
  "https://staging.elphiesgatedai.elphiesyntax.com/api/webhooks/stripe";

const COPY_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRICE_PRO_INDIVIDUAL",
  "STRIPE_PRICE_PRO_INDIVIDUAL_YEARLY",
  "STRIPE_PRICE_STARTUP_TEAM",
  "STRIPE_PRICE_STARTUP_TEAM_YEARLY",
  "STRIPE_PRICE_ENTERPRISE",
  "STRIPE_PRICE_ENTERPRISE_YEARLY",
];

const SOURCES = [
  path.join(ROOT, "packages", "msgf", ".env.local"),
  path.join(ROOT, ".env.cloudrun"),
  path.join(ROOT, ".env.local"),
];
const TARGET = path.join(ROOT, "packages", "msgf", ".env.staging.local");

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function loadFile(p) {
  if (!fs.existsSync(p)) return {};
  return parseEnv(fs.readFileSync(p, "utf8"));
}

function isBlank(v) {
  const s = String(v ?? "").trim();
  return !s || s === "sk_test_" || s === "pk_test_" || s === "whsec_" || s === "price_";
}

function redact(key, value) {
  const v = String(value ?? "");
  if (key.startsWith("STRIPE_PRICE_")) {
    if (!v) return "(missing)";
    return v.startsWith("price_") ? `price_…${v.slice(-6)}` : "(set)";
  }
  if (v.startsWith("sk_test_")) return `sk_test_… len=${v.length}`;
  if (v.startsWith("pk_test_")) return `pk_test_… len=${v.length}`;
  if (v.startsWith("whsec_")) return `whsec_… len=${v.length}`;
  return v ? `(set len=${v.length})` : "(missing)";
}

function upsertEnvFile(filePath, updates) {
  let text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (text && !text.endsWith("\n")) text += "\n";
  const lines = text ? text.split(/\n/) : [];
  const seen = new Set();
  const out = [];
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
  const missing = Object.keys(updates).filter((k) => !seen.has(k) && !isBlank(updates[k]));
  if (missing.length) {
    if (out.length && out[out.length - 1] !== "") out.push("");
    out.push("# Stripe TEST (seeded locally — do not commit)");
    for (const k of missing) out.push(`${k}=${updates[k]}`);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  fs.writeFileSync(filePath, `${out.join("\n")}\n`, "utf8");
}

async function stripeForm(secret, method, resourcePath, body) {
  const res = await fetch(`https://api.stripe.com/v1/${resourcePath}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? body.toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

const merged = {};
for (const src of SOURCES) {
  const env = loadFile(src);
  for (const k of COPY_KEYS) {
    if (!isBlank(env[k]) && isBlank(merged[k])) merged[k] = env[k];
  }
}

const secret = String(merged.STRIPE_SECRET_KEY ?? "").trim();
if (!secret) {
  console.error("No STRIPE_SECRET_KEY found in local env files.");
  process.exit(1);
}
if (secret.startsWith("sk_live_")) {
  console.error("Refusing to copy sk_live_ into staging. Use Stripe TEST keys.");
  process.exit(1);
}
if (!secret.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY is not sk_test_. Staging Stripe must be test mode.");
  process.exit(1);
}

if (
  isBlank(merged.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) &&
  !isBlank(merged.STRIPE_PUBLISHABLE_KEY)
) {
  merged.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = merged.STRIPE_PUBLISHABLE_KEY;
}

const copied = {};
for (const k of COPY_KEYS) {
  if (!isBlank(merged[k])) copied[k] = merged[k];
}

if (!skipWebhook) {
  try {
    const listed = await stripeForm(secret, "GET", "webhook_endpoints?limit=100");
    const existing = (listed.data ?? []).find(
      (ep) => String(ep.url ?? "").replace(/\/$/, "") === STAGING_WEBHOOK_URL.replace(/\/$/, "")
    );
    if (existing) {
      const existingSecret = loadFile(TARGET).STRIPE_WEBHOOK_SECRET;
      if (!isBlank(existingSecret)) copied.STRIPE_WEBHOOK_SECRET = existingSecret;
      console.log(
        `Stripe test webhook already exists (${existing.id}). Keeping staging STRIPE_WEBHOOK_SECRET.`
      );
    } else {
      const form = new URLSearchParams();
      form.set("url", STAGING_WEBHOOK_URL);
      form.set("description", "MSGF staging Checkout");
      for (const eventName of [
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.payment_failed",
      ]) {
        form.append("enabled_events[]", eventName);
      }
      const created = await stripeForm(secret, "POST", "webhook_endpoints", form);
      if (created.secret) copied.STRIPE_WEBHOOK_SECRET = created.secret;
      console.log(`Created Stripe test webhook ${created.id} → staging Checkout URL`);
    }
  } catch (e) {
    console.warn(
      `Webhook create skipped: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

try {
  const listed = await stripeForm(secret, "GET", "prices?limit=100&active=true");
  const wanted = {
    "2900:month": "STRIPE_PRICE_PRO_INDIVIDUAL",
    "29000:year": "STRIPE_PRICE_PRO_INDIVIDUAL_YEARLY",
    "4900:month": "STRIPE_PRICE_STARTUP_TEAM",
    "49000:year": "STRIPE_PRICE_STARTUP_TEAM_YEARLY",
    "19900:month": "STRIPE_PRICE_ENTERPRISE",
    "199000:year": "STRIPE_PRICE_ENTERPRISE_YEARLY",
  };
  for (const p of listed.data ?? []) {
    const key = `${p.unit_amount}:${p.recurring?.interval || ""}`;
    const envKey = wanted[key];
    if (envKey && String(p.id || "").startsWith("price_")) copied[envKey] = p.id;
  }
} catch (e) {
  console.warn(
    `Price ID match skipped: ${e instanceof Error ? e.message : String(e)}`
  );
}

upsertEnvFile(TARGET, copied);

const priceKeys = COPY_KEYS.filter((k) => k.startsWith("STRIPE_PRICE_"));
console.log(`Wrote Stripe TEST keys into ${path.relative(ROOT, TARGET)}`);
console.log(`  STRIPE_SECRET_KEY ${redact("STRIPE_SECRET_KEY", copied.STRIPE_SECRET_KEY)}`);
console.log(
  `  STRIPE_WEBHOOK_SECRET ${redact("STRIPE_WEBHOOK_SECRET", copied.STRIPE_WEBHOOK_SECRET)}`
);
console.log(
  `  publishable ${redact(
    "STRIPE_PUBLISHABLE_KEY",
    copied.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || copied.STRIPE_PUBLISHABLE_KEY
  )}`
);
for (const k of priceKeys) {
  console.log(`  ${k} ${redact(k, copied[k])}`);
}
console.log("Next: npm run staging:prepare");
