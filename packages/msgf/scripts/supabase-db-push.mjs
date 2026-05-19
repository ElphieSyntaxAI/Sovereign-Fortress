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
 * Distribution Build ID: MSGF-2b663b7-20260519T155850Z-internal
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
 * Distribution Build ID: MSGF-81e8259-20260519T153428Z-internal
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
 * Distribution Build ID: MSGF-463028d-20260519T150411Z-internal
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
 * Distribution Build ID: MSGF-463028d-20260519T145611Z-internal
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
 * Distribution Build ID: MSGF-853c3b6-20260519T054901Z-internal
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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
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
 * Distribution Build ID: MSGF-2790974-20260519T053039Z-internal
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
 * Distribution Build ID: MSGF-753c05a-20260519T051006Z-internal
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
 * Distribution Build ID: MSGF-753c05a-20260519T050509Z-internal
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
 * Distribution Build ID: MSGF-f70c13c-20260519T044237Z-internal
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
 * Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
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

import {
  connectionFailureHint,
  normalizeDatabaseUrl,
  resolveDatabaseUrl,
  trimEnv,
  validateDatabaseHostname,
} from "./lib/normalize-database-url.mjs";

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

function runNpx(npxArgs, { troubleshootOnFailure = false } = {}) {
  const { command, argsPrefix } = resolveNpxSpawn();
  const spawnArgs = [...argsPrefix, ...npxArgs];
  const result = spawnSync(command, spawnArgs, {
    cwd: pkgRoot,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, CI: "true" },
    windowsHide: true,
    input: npxArgs.includes("db") && npxArgs.includes("push") ? "y\n" : undefined,
  });

  if (result.error) {
    console.error(result.error.message);
    console.error(
      "Could not run npx. Install Node.js from https://nodejs.org and ensure `npx supabase --version` works in your shell."
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    if (troubleshootOnFailure) {
      console.error(
        "\nIf migrations were skipped, the CLI may require --include-all (already passed by this script)."
      );
      console.error(
        "\nIf you see tenant/user not found: set SUPABASE_POOLER_AWS_PREFIX=aws-1 (or aws-0) to match your dashboard URI."
      );
      console.error(
        "If you see prepared statement already exists: db:push uses session pooler port 5432 (not 6543)."
      );
      console.error(
        "If you see policy/relation already exists: partial migrations — use Supabase SQL editor or `supabase migration repair`."
      );
    }
    process.exit(result.status ?? 1);
  }
}

function dbPush(dbUrl) {
  assertDbUrlUsable(dbUrl);
  const hostError = validateDatabaseHostname(dbUrl);
  if (hostError) {
    console.error(hostError);
    process.exit(1);
  }
  const normalized = normalizeDatabaseUrl(dbUrl);
  console.log(
    `Command: npx supabase db push --db-url "${redactDbUrl(normalized)}" --yes --include-all`
  );
  console.log(`Working directory: ${pkgRoot}`);
  runNpx(
    ["supabase", "db", "push", "--db-url", normalized, "--yes", "--include-all"],
    { troubleshootOnFailure: true }
  );
}

loadEnvFiles();
assertMigrationsDir();

/** Migrations need session pooler (:5432); transaction pooler (:6543) breaks with prepared statements. */
const { url: dbUrl, warnings } = resolveDatabaseUrl({
  ...process.env,
  SUPABASE_POOLER_PORT: trimEnv(process.env.SUPABASE_DB_PUSH_POOLER_PORT) || "5432",
});
for (const w of warnings) console.warn(`Note: ${w}`);

const projectRef = trimEnv(process.env.SUPABASE_PROJECT_REF) || "";
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
    "Set in packages/msgf/.env.local:",
    "  SUPABASE_DB_PASSWORD=<database password from Supabase Dashboard → Database>",
    "  DATABASE_URL=postgresql://postgres@db.<project-ref>.supabase.co:5432/postgres",
    "",
    `SUPABASE_PROJECT_REF: ${projectRef || "(set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL)"}`,
  ].join("\n")
);
process.exit(1);
