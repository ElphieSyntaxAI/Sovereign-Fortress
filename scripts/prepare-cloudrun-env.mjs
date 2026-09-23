#!/usr/bin/env node
/**
 * Merge env.cloudrun.example + local .env files → .env.cloudrun (gitignored).
 * Staging: env.cloudrun.staging.example + .env.staging.local → .env.cloudrun.staging
 * Does not print secret values.
 *
 *   node scripts/prepare-cloudrun-env.mjs
 *   node scripts/prepare-cloudrun-env.mjs --staging
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isStaging = process.argv.includes("--staging");

const OUT = path.join(ROOT, isStaging ? ".env.cloudrun.staging" : ".env.cloudrun");
const EXAMPLE = path.join(
  ROOT,
  isStaging ? "env.cloudrun.staging.example" : "env.cloudrun.example"
);

const LOCAL_SOURCES = isStaging
  ? [
      path.join(ROOT, ".env.cloudrun.staging"),
      path.join(ROOT, ".env.staging.local"),
      path.join(ROOT, "packages", "msgf", ".env.staging.local"),
    ]
  : [
      path.join(ROOT, ".env.local"),
      path.join(ROOT, "packages", "msgf", ".env.local"),
      path.join(ROOT, ".env"),
    ];

const PROD_OVERRIDES = {
  DEPLOY_ENV: "production",
  MSGF_APP_URL: "https://elphiesgatedai.elphiesyntax.com",
  MSGF_BASE_URL: "https://elphiesgatedai.elphiesyntax.com",
  NEXT_PUBLIC_MSGF_APP_URL: "https://elphiesgatedai.elphiesyntax.com",
  NEXT_PUBLIC_AUTHOR_APP_URL: "https://authorecosystem.elphiesyntax.com",
  AUTHOR_APP_URL: "https://authorecosystem.elphiesyntax.com",
  VITE_AUTHOR_APP_URL: "https://authorecosystem.elphiesyntax.com",
  VITE_MSGF_APP_URL: "https://elphiesgatedai.elphiesyntax.com",
  MSGF_AUTH_COOKIE_DOMAIN: ".elphiesyntax.com",
  NEXT_PUBLIC_MSGF_AUTH_COOKIE_DOMAIN: ".elphiesyntax.com",
  MSGF_AUTH_COOKIE_SECURE: "1",
  NEXT_PUBLIC_MSGF_AUTH_COOKIE_SECURE: "1",
  MSGF_SIGNING_MOCK: "0",
  MSGF_DOCUSIGN_MOCK: "0",
  MSGF_DROPBOX_ARCHIVE_MOCK: "0",
  MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE: "0",
  ALLOW_DEMO_TENANT: "0",
  EDUCATION_DEMO_BOOTSTRAP: "0",
  EDUCATION_OPEN_LESSON_API: "0",
  MSGF_POST_MVP_SIGNING: "0",
  MSGF_POST_MVP_DROPBOX_ARCHIVE: "0",
  MSGF_POST_MVP_MCP: "0",
  AUTHOR_POST_MVP_FAN_HUB: "0",
  AUTHOR_POST_MVP_HELPER: "0",
  VITE_AUTHOR_POST_MVP_FAN_HUB: "0",
  VITE_AUTHOR_POST_MVP_HELPER: "0",
  BFF_ALLOWED_ORIGINS:
    "https://authorecosystem.elphiesyntax.com,https://elphiesgatedai.elphiesyntax.com",
  VITE_AUTHOR_BFF_URL: "",
};

const STAGING_OVERRIDES = {
  DEPLOY_ENV: "staging",
  GCP_PROJECT_ID: "msgf-shield",
  GCP_REGION: "us-central1",
  MSGF_APP_URL: "https://staging.elphiesgatedai.elphiesyntax.com",
  MSGF_BASE_URL: "https://staging.elphiesgatedai.elphiesyntax.com",
  NEXT_PUBLIC_MSGF_APP_URL: "https://staging.elphiesgatedai.elphiesyntax.com",
  VITE_MSGF_APP_URL: "https://staging.elphiesgatedai.elphiesyntax.com",
  NEXT_PUBLIC_AUTHOR_APP_URL: "https://staging.authorecosystem.elphiesyntax.com",
  AUTHOR_APP_URL: "https://staging.authorecosystem.elphiesyntax.com",
  VITE_AUTHOR_APP_URL: "https://staging.authorecosystem.elphiesyntax.com",
  AUTHOR_ECOSYSTEM_URL: "https://staging.authorecosystem.elphiesyntax.com",
  NEXT_PUBLIC_EDUCATION_APP_URL: "https://staging.syntaxeducates.elphiesyntax.com",
  EDUCATION_APP_URL: "https://staging.syntaxeducates.elphiesyntax.com",
  VITE_AUTHOR_BFF_URL: "https://staging-api.authorecosystem.elphiesyntax.com",
  AUTHOR_BFF_URL: "https://staging-api.authorecosystem.elphiesyntax.com",
  BFF_ALLOWED_ORIGINS:
    "https://staging.authorecosystem.elphiesyntax.com,https://staging.elphiesyntax.com,https://staging.elphiesgatedai.elphiesyntax.com",
  MSGF_AUTH_COOKIE_DOMAIN: ".elphiesyntax.com",
  NEXT_PUBLIC_MSGF_AUTH_COOKIE_DOMAIN: ".elphiesyntax.com",
  MSGF_AUTH_COOKIE_SECURE: "1",
  NEXT_PUBLIC_MSGF_AUTH_COOKIE_SECURE: "1",
  MSGF_SIGNING_MOCK: "1",
  MSGF_STRIPE_WEBHOOK_LIVE: "0",
  MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE: "1",
  ALLOW_DEMO_TENANT: "0",
  MSGF_HYBRID_KEM_ENABLED: "1",
  MSGF_TRI_CONSENSUS_ENABLED: "1",
  MSGF_TENANT_TRI_CONSENSUS_ENABLED: "1",
  MSGF_POST_MVP_SIGNING: "1",
  MSGF_POST_MVP_DROPBOX_ARCHIVE: "1",
  MSGF_POST_MVP_MCP: "1",
  AUTHOR_POST_MVP_FAN_HUB: "0",
  AUTHOR_POST_MVP_HELPER: "0",
  VITE_AUTHOR_POST_MVP_FAN_HUB: "0",
  VITE_AUTHOR_POST_MVP_HELPER: "0",
  MSGF_DOMAIN: "staging.elphiesgatedai.elphiesyntax.com",
  AUTHOR_CLIENT_DOMAIN: "staging.authorecosystem.elphiesyntax.com",
  AUTHOR_BFF_DOMAIN: "staging-api.authorecosystem.elphiesyntax.com",
};

const COPY_KEYS = [
  "GCP_PROJECT_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "REDIS_URL",
  "MSGF_AUTHOR_PULSE_LICENSE_KEY",
  "MSGF_AUTHOR_TENANT_ID",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GCP_API_KEY",
  "GCP_MODEL_ID",
  "GCP_LOCATION",
  "MSGF_OPS_CRON_SECRET",
  "MSGF_ARBITRATE_AUDIT_KEY",
  "MSGF_SKIP_AUDIT_SECRET",
  "MSGF_GLOBAL_ADMIN_EMAILS",
  "MSGF_INDIVIDUAL_ADMIN_EMAILS",
  "SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
  "XAI_API_KEY",
  "CRYPTO_SECRET_KEY",
  "MSGF_KMS_CRYPTO_KEY_PATH",
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
  "RESEND_API_KEY",
];

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

function isPlaceholderEnvValue(key, value) {
  const v = String(value ?? "").trim();
  if (!v) return true;
  if (/^eyJ\.\.\.$/i.test(v) || v === "change_me" || /^sk_test_$/.test(v)) return true;
  if (/YOUR_(PROJECT|STAGING)|YOUR-DB|your_staging_ref/i.test(v)) return true;
  return false;
}

function assignNonPlaceholder(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (isPlaceholderEnvValue(k, v)) continue;
    target[k] = v;
  }
}

if (!fs.existsSync(EXAMPLE)) {
  console.error(`Missing ${EXAMPLE}`);
  process.exit(1);
}

const merged = loadFile(EXAMPLE);
for (const src of LOCAL_SOURCES) {
  assignNonPlaceholder(merged, loadFile(src));
}
for (const k of COPY_KEYS) {
  const v = merged[k];
  if (v && !isPlaceholderEnvValue(k, v)) merged[k] = v;
}
if (
  isPlaceholderEnvValue(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    merged.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ) &&
  merged.STRIPE_PUBLISHABLE_KEY &&
  !isPlaceholderEnvValue("STRIPE_PUBLISHABLE_KEY", merged.STRIPE_PUBLISHABLE_KEY)
) {
  merged.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = merged.STRIPE_PUBLISHABLE_KEY;
}
Object.assign(merged, isStaging ? STAGING_OVERRIDES : PROD_OVERRIDES);

const authorBffFromEnv = merged.AUTHOR_BFF_URL?.trim();
const authorAppUrl = merged.AUTHOR_APP_URL?.trim();
merged.AUTHOR_BFF_URL =
  authorBffFromEnv ||
  authorAppUrl ||
  (isStaging
    ? "https://staging.authorecosystem.elphiesyntax.com"
    : "https://authorecosystem.elphiesyntax.com");
const authorEcosystemFromEnv = merged.AUTHOR_ECOSYSTEM_URL?.trim();
merged.AUTHOR_ECOSYSTEM_URL = authorEcosystemFromEnv || merged.AUTHOR_BFF_URL;

const redisUrl = merged.REDIS_URL?.trim() ?? "";
if (redisUrl && /localhost|127\.0\.0\.1/i.test(redisUrl)) {
  const upstashReady =
    merged.UPSTASH_REDIS_REST_URL?.trim() &&
    merged.UPSTASH_REDIS_REST_TOKEN?.trim() &&
    !isPlaceholderEnvValue("UPSTASH_REDIS_REST_URL", merged.UPSTASH_REDIS_REST_URL);
  delete merged.REDIS_URL;
  if (upstashReady) {
    console.warn(
      `Dropped local REDIS_URL from ${path.basename(OUT)} (Upstash REST is configured).`
    );
  } else {
    console.warn(
      `Dropped local REDIS_URL from ${path.basename(OUT)} — set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for hot-layer Redis on Cloud Run.`
    );
  }
}

const supabaseUrl = merged.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const publishable = merged.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

if (supabaseUrl && !isPlaceholderEnvValue("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl)) {
  if (isPlaceholderEnvValue("SUPABASE_URL", merged.SUPABASE_URL)) {
    merged.SUPABASE_URL = supabaseUrl;
  }
  if (isPlaceholderEnvValue("VITE_SUPABASE_URL", merged.VITE_SUPABASE_URL)) {
    merged.VITE_SUPABASE_URL = supabaseUrl;
  }
}
if (publishable && !isPlaceholderEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishable)) {
  if (isPlaceholderEnvValue("VITE_SUPABASE_ANON_KEY", merged.VITE_SUPABASE_ANON_KEY)) {
    merged.VITE_SUPABASE_ANON_KEY = publishable;
  }
}
if (!merged.GCP_PROJECT_ID) merged.GCP_PROJECT_ID = "msgf-shield";

const gac = merged.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? "";
if (gac) {
  const looksLocal =
    /^[A-Za-z]:\\/.test(gac) ||
    gac.includes("OneDrive") ||
    gac.includes("service-account.json") ||
    gac.includes("gcp-key.json");
  if (looksLocal) {
    delete merged.GOOGLE_APPLICATION_CREDENTIALS;
    console.warn(
      `Dropped GOOGLE_APPLICATION_CREDENTIALS from ${path.basename(OUT)} (use Cloud Run ADC + GCP_PROJECT_ID).`
    );
  }
}
if (merged.GCP_PROJECT_ID) {
  merged.GOOGLE_CLOUD_PROJECT = merged.GCP_PROJECT_ID;
}

const order = [
  ...new Set([
    ...Object.keys(parseEnv(fs.readFileSync(EXAMPLE, "utf8"))),
    ...Object.keys(merged),
  ]),
];

const lines = [
  `# Generated by scripts/prepare-cloudrun-env.mjs${isStaging ? " --staging" : ""} — do not commit`,
  `# ${new Date().toISOString()}`,
  "",
];
for (const k of order) {
  const v = merged[k];
  if (v === undefined || v === "" || isPlaceholderEnvValue(k, v)) continue;
  lines.push(`${k}=${v}`);
}

fs.writeFileSync(OUT, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${OUT} (${lines.length} lines). Review URLs and secrets before deploy.`);

if (isStaging) {
  const preflight = spawnSync(
    process.execPath,
    [path.join(ROOT, "scripts", "staging-preflight.mjs"), "--env-file", path.relative(ROOT, OUT)],
    { cwd: ROOT, stdio: "inherit" }
  );
  process.exit(preflight.status === 0 ? 0 : 1);
}

const missing = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MSGF_AUTHOR_PULSE_LICENSE_KEY",
].filter((k) => !merged[k]);
if (missing.length) {
  console.warn("Still missing:", missing.join(", "));
  process.exit(1);
}
