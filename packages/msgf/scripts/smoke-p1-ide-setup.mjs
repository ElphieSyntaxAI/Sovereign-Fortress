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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
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
