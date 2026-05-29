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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
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
run("npx", ["tsx", "--test", "tests/dev-session-pulse.test.ts"], pulseGuard, "dev-session-pulse tests");
run("npm", ["run", "compile"], pulseGuard, "msgf-pulse-guard compile");

console.log("\n[smoke-dev-kit] All dev kit smoke checks passed.");
