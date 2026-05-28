#!/usr/bin/env node
/**
 * P4 smoke — IDE token, deep link, compliance export schema, extension compile.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "../..");
const pulseGuard = path.join(repoRoot, "packages", "msgf-pulse-guard");

function run(cmd, args, cwd, label) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true, env: process.env });
  if (r.status !== 0) {
    console.error(`[smoke-p4] FAIL: ${label}`);
    process.exit(r.status ?? 1);
  }
  console.log(`[smoke-p4] OK: ${label}`);
}

console.log("[smoke-p4] P4 IDE token + workspace smoke\n");

run("npx", ["tsx", "--test", "tests/ide-token-service.test.ts"], root, "ide-token-service tests");
run("npx", ["tsx", "--test", "tests/heal-queue-bulk-gate.test.ts"], root, "heal-queue-bulk-gate tests");
run("npx", ["tsx", "--test", "tests/credit-heal-reservation.test.ts"], root, "credit-heal-reservation tests");
run("npx", ["tsx", "--test", "tests/msgf-report-url.test.ts"], root, "msgf-report-url tests");

run("npm", ["run", "compile"], pulseGuard, "msgf-pulse-guard compile");

console.log("\n[smoke-p4] All P4 smoke checks passed.");
console.log("[smoke-p4] Apply migration 20260628130000_msgf_ide_tokens_workspaces.sql before minting tokens in prod.");
