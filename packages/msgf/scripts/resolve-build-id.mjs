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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
/**
 * Resolves a traceable MSGF distribution build ID for license headers and tester handoffs.
 *
 * Env (optional):
 *   MSGF_BUILD_ID           — override entire ID
 *   MSGF_DISTRIBUTION_ID    — tester / cohort slug (e.g. "acme-qa-2026-05")
 *   MSGF_TESTER_ID          — alias for MSGF_DISTRIBUTION_ID
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = join(fileURLToPath(new URL("..", import.meta.url)));

function gitShortSha() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: pkgRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "nogit";
  }
}

function utcStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function resolveMsgfBuildId() {
  const override = process.env.MSGF_BUILD_ID?.trim();
  if (override) return override;

  const distribution =
    process.env.MSGF_DISTRIBUTION_ID?.trim() ||
    process.env.MSGF_TESTER_ID?.trim() ||
    "internal";

  const slug = distribution.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 64);
  return `MSGF-${gitShortSha()}-${utcStamp()}-${slug}`;
}

export function writeBuildIdManifest(buildId) {
  const dir = join(pkgRoot, ".msgf");
  mkdirSync(dir, { recursive: true });
  const manifestPath = join(dir, "BUILD_ID");
  writeFileSync(manifestPath, `${buildId}\n`, "utf8");
  return manifestPath;
}

