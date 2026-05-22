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
 * Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
 */
/**
 * Resolve `next` CLI for npm workspaces: hoisted to monorepo root (Docker / npm ci)
 * or nested under packages/msgf (local installs). Avoids `npm exec`, which can
 * download a mismatched Next version when the binary is not on PATH.
 *
 * Uses filesystem paths + next/package.json resolution — require.resolve for
 * `next/dist/bin/next` can fail under some workspace / Node resolution paths.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.dirname(scriptDir);
const repoRoot = path.resolve(pkgRoot, "..", "..");

function resolveNextBin() {
  const binRel = path.join("dist", "bin");
  const candidateDirs = [
    path.join(repoRoot, "node_modules", "next"),
    path.join(pkgRoot, "node_modules", "next"),
    path.join(repoRoot, "node_modules", "msgf", "node_modules", "next"),
  ];
  for (const nextDir of candidateDirs) {
    for (const name of ["next", "next.js"]) {
      const p = path.join(nextDir, binRel, name);
      if (existsSync(p)) return p;
    }
  }
  for (const root of [repoRoot, pkgRoot]) {
    try {
      const manifest = require.resolve("next/package.json", { paths: [root] });
      const nextDir = path.dirname(manifest);
      for (const name of ["next", "next.js"]) {
        const p = path.join(nextDir, binRel, name);
        if (existsSync(p)) return p;
      }
    } catch {
      /* try next root */
    }
  }
  throw new Error(
    `Could not find Next.js CLI (dist/bin/next). Checked ${candidateDirs.join(", ")}. Run npm ci from the monorepo root.`
  );
}

const nextBin = resolveNextBin();
const args = process.argv.slice(2);

if (args[0] === "build") {
  // Next can leave generated server files that Windows/OneDrive later reports
  // as invalid readlinks. Start each production build from a clean generated
  // output directory; source, dist, and node_modules are untouched.
  rmSync(path.join(pkgRoot, ".next"), { recursive: true, force: true });
}

const child = spawnSync(process.execPath, [nextBin, ...args], {
  stdio: "inherit",
});
process.exit(child.status ?? 1);
