#!/usr/bin/env node
/**
 * Dev kit scaffold smoke — template bundle + extension compile.
 * Usage: npm run smoke:dev-kit -w msgf
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
    console.error(`[smoke-dev-kit] FAIL: ${label}`);
    process.exit(r.status ?? 1);
  }
  console.log(`[smoke-dev-kit] OK: ${label}`);
}

console.log("[smoke-dev-kit] MSGF integrator dev kit smoke\n");

run("npx", ["tsx", "--test", "tests/dev-kit-scaffold.test.ts"], pulseGuard, "dev-kit-scaffold tests");
run("npm", ["run", "compile"], pulseGuard, "msgf-pulse-guard compile");

console.log("\n[smoke-dev-kit] All dev kit smoke checks passed.");
