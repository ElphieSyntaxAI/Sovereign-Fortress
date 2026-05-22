#!/usr/bin/env node
/**
 * Runs all unit tests for token savings / routing / ingest-hash / idempotency features.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SAVINGS_TESTS = [
  "test:token-usage-estimate",
  "test:heal-token-estimate",
  "test:credit-reservation",
  "test:pulse-eco-savings",
  "test:ingest-hash-cache",
  "test:pulse-idempotency",
  "test:usage-monitor",
  "test:heal-queue",
  "test:converge-context-budget",
  "test:dev-session-profile",
  "test:vault-active-file-shard",
  "test:dev-event",
  "test:converge-cache",
  "test:savings-qa-checkpoints",
  "test:brain-routing",
];

function resolveTsxCli() {
  for (const rel of ["node_modules/tsx/dist/cli.mjs", "../../node_modules/tsx/dist/cli.mjs"]) {
    const p = path.join(pkgRoot, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function main() {
  const failed = [];
  for (const script of SAVINGS_TESTS) {
    console.log(`\n--- ${script} ---\n`);
    const r = spawnSync("npm", ["run", script], {
      cwd: pkgRoot,
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    if ((r.status ?? 1) !== 0) failed.push(script);
  }
  if (failed.length) {
    console.error("\n[run-savings-tests] FAILED:", failed.join(", "));
    process.exit(1);
  }
  console.log("\n[run-savings-tests] All passed.");
}

main();
