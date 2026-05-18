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
 * Distribution Build ID: MSGF-4e22f0c-20260518T205132Z-internal
 */
/**
 * Apply packages/msgf/supabase/migrations to the linked or configured remote Postgres.
 *
 * Loads env: ../../.env, ../../.env.local, .env, .env.local
 *
 * Usage (from repo root): npm run db:push
 *
 * Executes: npx supabase db push --db-url "<DATABASE_URL>" --yes
 * cwd: packages/msgf
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(pkgRoot, "../..");
const migrationsDir = path.join(pkgRoot, "supabase", "migrations");

function loadEnvFiles() {
  for (const rel of ["../../.env", "../../.env.local", ".env", ".env.local"]) {
    const p = path.resolve(pkgRoot, rel);
    if (fs.existsSync(p)) {
      dotenv.config({ path: p, override: true });
    }
  }
}

function trimEnv(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function projectRefFromSupabaseUrl(url) {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.trim()).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function redactDbUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

function assertMigrationsDir() {
  if (!fs.existsSync(migrationsDir)) {
    console.error(`FAIL: migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }
  const sqlFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  if (sqlFiles.length === 0) {
    console.error(`FAIL: no .sql files in ${migrationsDir}`);
    process.exit(1);
  }
  console.log(`MSGF migrations: ${migrationsDir} (${sqlFiles.length} files)`);
}

function assertDbUrlUsable(url) {
  if (!url) return;
  if (url.includes("[YOUR_DB_PASSWORD]") || url.includes("[password]")) {
    console.error(
      [
        "DATABASE_URL still contains a placeholder password.",
        "Edit packages/msgf/.env.local and set your Supabase database password, then re-run:",
        "  npm run db:push",
      ].join("\n")
    );
    process.exit(1);
  }
}

/**
 * Run `npx …` without cmd.exe parsing the Postgres URL.
 * On Windows, .cmd shims need shell:true (breaks URLs); use node + npx-cli.js instead.
 */
function resolveNpxSpawn() {
  const nodeCandidates = [];
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const installedNode = path.join(programFiles, "nodejs", "node.exe");
  if (fs.existsSync(installedNode)) nodeCandidates.push(installedNode);
  if (process.execPath) nodeCandidates.push(process.execPath);

  for (const nodeExe of nodeCandidates) {
    const npxCli = path.join(path.dirname(nodeExe), "node_modules", "npm", "bin", "npx-cli.js");
    if (fs.existsSync(npxCli)) {
      return { command: nodeExe, argsPrefix: [npxCli] };
    }
  }

  const repoNpx = path.join(repoRoot, "node_modules", "npm", "bin", "npx-cli.js");
  if (fs.existsSync(repoNpx)) {
    return { command: process.execPath, argsPrefix: [repoNpx] };
  }

  return { command: "npx", argsPrefix: [] };
}

function runNpx(npxArgs) {
  const { command, argsPrefix } = resolveNpxSpawn();
  const spawnArgs = [...argsPrefix, ...npxArgs];
  const result = spawnSync(command, spawnArgs, {
    cwd: pkgRoot,
    stdio: "inherit",
    shell: false,
    env: process.env,
    windowsHide: true,
  });

  if (result.error) {
    console.error(result.error.message);
    console.error(
      "Could not run npx. Install Node.js from https://nodejs.org and ensure `npx supabase --version` works in your shell."
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function dbPush(dbUrl) {
  assertDbUrlUsable(dbUrl);
  console.log(`Command: npx supabase db push --db-url "${redactDbUrl(dbUrl)}" --yes`);
  console.log(`Working directory: ${pkgRoot}`);
  runNpx(["supabase", "db", "push", "--db-url", dbUrl, "--yes"]);
}

loadEnvFiles();
assertMigrationsDir();

const dbUrl =
  trimEnv(process.env.DATABASE_URL) ||
  trimEnv(process.env.SUPABASE_DATABASE_URL) ||
  trimEnv(process.env.POSTGRES_URL) ||
  "";

const supabaseUrl =
  trimEnv(process.env.SUPABASE_URL) || trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || "";

const projectRef =
  trimEnv(process.env.SUPABASE_PROJECT_REF) || projectRefFromSupabaseUrl(supabaseUrl) || "";

const dbPassword = trimEnv(process.env.SUPABASE_DB_PASSWORD) || "";

if (dbUrl) {
  console.log("Pushing via DATABASE_URL / SUPABASE_DATABASE_URL …");
  dbPush(dbUrl);
  console.log("Done. Run post-push validation:");
  console.log("  npm run verify:db-schema -w msgf");
  console.log("  (or from repo root: npm run verify:supabase-schema)");
  process.exit(0);
}

if (projectRef && dbPassword) {
  console.log(`Linking project ref ${projectRef} …`);
  runNpx(["supabase", "link", "--project-ref", projectRef, "-p", dbPassword]);
  console.log("Pushing migrations to linked project …");
  runNpx(["supabase", "db", "push", "--yes"]);
  console.log("Done. Run: npm run verify:supabase-schema");
  process.exit(0);
}

console.error(
  [
    "Missing database credentials for supabase db push.",
    "",
    "Option A (recommended): set in packages/msgf/.env.local or repo root .env.local:",
    '  DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"',
    "",
    "Option B: link then push:",
    "  SUPABASE_PROJECT_REF=<from https://xxx.supabase.co>",
    "  SUPABASE_DB_PASSWORD=<database password>",
    "  SUPABASE_ACCESS_TOKEN=<personal access token from supabase.com/dashboard/account/tokens>",
    "",
    `Detected SUPABASE_URL host ref: ${projectRef || "(none)"}`,
  ].join("\n")
);
process.exit(1);
