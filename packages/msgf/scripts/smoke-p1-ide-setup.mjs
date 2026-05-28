#!/usr/bin/env node
/**
 * P1 smoke — IDE setup + connectivity unit tests, extension compile.
 * Usage: npm run smoke:p1-ide -w msgf
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
    console.error(`[smoke-p1] FAIL: ${label}`);
    process.exit(r.status ?? 1);
  }
  console.log(`[smoke-p1] OK: ${label}`);
}

console.log("[smoke-p1] P1 IDE setup smoke\n");

run("npx", ["tsx", "--test", "tests/ide-connectivity-check.test.ts"], root, "ide-connectivity-check tests");
run("npx", ["tsx", "--test", "tests/workspace-ide-setup-p1.test.ts"], root, "workspace-ide-setup tests");

run("npm", ["run", "compile"], pulseGuard, "msgf-pulse-guard compile");

console.log("\n[smoke-p1] All P1 smoke checks passed.");
