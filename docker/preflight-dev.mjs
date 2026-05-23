#!/usr/bin/env node
/**
 * Preflight before `docker compose -f docker-compose.dev.yml up`.
 * Reads packages/msgf/.env.local (same file compose uses via env_file).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "packages", "msgf", ".env.local");

const REQUIRED = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL"],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "Supabase publishable key (sb_publishable_... or legacy anon)"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase secret key (sb_secret_... or legacy service_role)"],
];

function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function main() {
  console.log("Elphie Syntax — Docker dev preflight\n");

  if (!existsSync(envPath)) {
    console.error(`Missing ${envPath}`);
    console.error("Copy from .env.example and fill Supabase keys, or symlink your existing env.");
    process.exit(1);
  }

  const env = parseEnv(readFileSync(envPath, "utf8"));
  const missing = [];
  for (const [key, label] of REQUIRED) {
    const v = env[key]?.trim();
    if (!v || v.includes("your-project") || v === "change_me") {
      missing.push(`${key} (${label})`);
    } else {
      console.log(`OK  ${key}`);
    }
  }

  if (missing.length) {
    console.error("\nFix packages/msgf/.env.local — add:\n");
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }

  if (env.SUPABASE_JWT_SECRET?.trim() || env.JWT_SECRET?.trim()) {
    console.log("OK  SUPABASE_JWT_SECRET (optional — local HS256 verify)");
  } else {
    console.log(
      "OK  (no JWT secret — expected with new Supabase publishable + secret keys; BFF uses Auth API)"
    );
  }

  console.log("\nPreflight passed. Run: npm run docker:dev\n");
}

main();
