#!/usr/bin/env node
/**
 * P2 smoke — dev heal cycle + report-issue unit tests, extension compile.
 * Usage: npm run smoke:p2-dev -w msgf
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
    console.error(`[smoke-p2] FAIL: ${label}`);
    process.exit(r.status ?? 1);
  }
  console.log(`[smoke-p2] OK: ${label}`);
}

console.log("[smoke-p2] P2 dev heal cycle smoke\n");

run("npx", ["tsx", "--test", "tests/dev-heal-config.test.ts"], root, "dev-heal-config tests");
run(
  "npx",
  ["tsx", "--test", "tests/agent-context-service.test.ts"],
  root,
  "agent-context-service tests"
);

run("npm", ["run", "compile"], pulseGuard, "msgf-pulse-guard compile");

console.log("\n[smoke-p2] All P2 smoke checks passed.");
