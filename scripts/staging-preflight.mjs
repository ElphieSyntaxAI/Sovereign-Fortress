#!/usr/bin/env node
/**
 * Isolation gate for MSGF staging. Refuses production Supabase, live Stripe,
 * signing mocks, and placeholder hosts. Does not print secret values.
 *
 *   node scripts/staging-preflight.mjs
 *   node scripts/staging-preflight.mjs --env-file .env.cloudrun.staging
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { envFile: path.join(ROOT, ".env.cloudrun.staging") };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--env-file" && argv[i + 1]) {
      args.envFile = path.resolve(ROOT, argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

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

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return parseEnv(fs.readFileSync(filePath, "utf8"));
}

function hostOf(url) {
  try {
    return new URL(String(url || "").trim()).host.toLowerCase();
  } catch {
    return "";
  }
}

function isOn(v) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function isPlaceholder(value) {
  const v = String(value ?? "").trim();
  if (!v) return true;
  return /YOUR_STAGING|YOUR_PROJECT|YOUR-DB|changeme|^eyJ\.\.\.$/i.test(v);
}

function productionSupabaseHosts() {
  const hosts = new Set();
  for (const rel of [
    ".env.cloudrun",
    "packages/msgf/.env.local",
    ".env.local",
  ]) {
    const env = loadEnv(path.join(ROOT, rel));
    if (!env) continue;
    const h = hostOf(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL);
    if (h && !isPlaceholder(h) && !/your_staging_ref/i.test(h)) hosts.add(h);
  }
  return hosts;
}

const { envFile } = parseArgs(process.argv.slice(2));
const failures = [];
const warnings = [];

if (!fs.existsSync(envFile)) {
  console.error(`FAIL: missing ${path.relative(ROOT, envFile)}`);
  console.error("Create it with: npm run staging:prepare");
  process.exit(1);
}

const env = loadEnv(envFile);
const deployEnv = String(env.DEPLOY_ENV ?? "").trim().toLowerCase();
if (deployEnv !== "staging") {
  failures.push(`DEPLOY_ENV must be staging (got ${deployEnv || "empty"})`);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
const supabaseHost = hostOf(supabaseUrl);
if (!supabaseHost || isPlaceholder(supabaseUrl) || /your_staging_ref/i.test(supabaseHost)) {
  failures.push(
    "Staging Supabase URL is still a placeholder — create project elphie-staging and put the real https://<ref>.supabase.co in packages/msgf/.env.staging.local, then re-run npm run staging:prepare"
  );
} else {
  const prodHosts = productionSupabaseHosts();
  if (prodHosts.has(supabaseHost)) {
    failures.push(
      `Staging Supabase host matches production (${supabaseHost}). Staging must be a separate project.`
    );
  }
}

if (isPlaceholder(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
  failures.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing or placeholder");
}
if (isPlaceholder(env.SUPABASE_SERVICE_ROLE_KEY)) {
  failures.push("SUPABASE_SERVICE_ROLE_KEY is missing — copy the staging project service role, never production");
}

const stripe = String(env.STRIPE_SECRET_KEY ?? "").trim();
if (stripe) {
  if (stripe.startsWith("sk_live_")) {
    failures.push("STRIPE_SECRET_KEY is live — staging must use sk_test_");
  } else if (!stripe.startsWith("sk_test_")) {
    warnings.push("STRIPE_SECRET_KEY does not look like sk_test_");
  }
}
if (isOn(env.MSGF_STRIPE_WEBHOOK_LIVE)) {
  warnings.push(
    "MSGF_STRIPE_WEBHOOK_LIVE is on — keep it off on staging until a Stripe test Checkout smoke"
  );
}

for (const k of [
  "MSGF_SIGNING_MOCK",
  "MSGF_DOCUSIGN_MOCK",
  "MSGF_DROPBOX_ARCHIVE_MOCK",
]) {
  if (isOn(env[k])) {
    failures.push(`${k}=1 is not allowed on staging/prod — mocks off (code stays, claims stay hidden)`);
  }
}

if (isOn(env.ALLOW_DEMO_TENANT)) {
  failures.push("ALLOW_DEMO_TENANT must be off on staging");
}

const msgfUrl = env.NEXT_PUBLIC_MSGF_APP_URL || env.MSGF_APP_URL || "";
if (msgfUrl && /elphiesgatedai\.elphiesyntax\.com/i.test(msgfUrl) && !/staging\./i.test(msgfUrl)) {
  failures.push(
    "MSGF public URL points at production gatedai — use staging.elphiesgatedai.elphiesyntax.com or the Cloud Run *.run.app URL"
  );
}

const required = [
  "NEXT_PUBLIC_MSGF_APP_URL",
  "MSGF_APP_URL",
  "GCP_PROJECT_ID",
];
for (const k of required) {
  if (!String(env[k] ?? "").trim()) failures.push(`Missing ${k}`);
}

if (!String(env.UPSTASH_REDIS_REST_URL ?? "").trim() || isPlaceholder(env.UPSTASH_REDIS_REST_URL)) {
  warnings.push("Upstash REST is empty — Pulse hot layer / SHARD will be degraded until a staging Redis exists");
}

console.log(`Staging preflight: ${path.relative(ROOT, envFile)}`);
console.log(`  DEPLOY_ENV=${deployEnv || "(empty)"}`);
console.log(`  supabase_host=${supabaseHost || "(none)"}`);
console.log(`  msgf_url=${msgfUrl || "(none)"}`);

if (warnings.length) {
  console.log("WARN:");
  for (const w of warnings) console.log(`  - ${w}`);
}
if (failures.length) {
  console.error("FAIL:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("OK — staging env is isolated from production.");
