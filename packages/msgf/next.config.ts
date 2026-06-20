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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "..", "..");
dotenv.config({ path: path.join(monorepoRoot, ".env") });
dotenv.config({ path: path.join(monorepoRoot, ".env.local"), override: true });
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });

const nextConfig: NextConfig = {
  /** Minimal server trace for container / Cloud Run (see `packages/msgf/Dockerfile`). */
  output: "standalone",
  /** Include workspace siblings (e.g. `@elphie-syntax/core`) in file tracing. */
  outputFileTracingRoot: monorepoRoot,
  experimental: {
    // Allow importing `DashboardOrchestratorService` from `apps/author-ecosystem/server`.
    externalDir: true,
  },
  webpack(config, { dev }) {
    // Author-ecosystem sources use `.js` extensions in TypeScript ESM imports; resolve to `.ts` for bundling.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    // Bind-mounting the whole monorepo on Docker Desktop (esp. Windows/OneDrive) makes the
    // default watcher scan author-ecosystem + node_modules churn — high CPU in `next dev`.
    if (dev) {
      const ignored = [
        "**/node_modules/**",
        "**/.git/**",
        path.join(monorepoRoot, "apps/author-ecosystem/client/**"),
        path.join(monorepoRoot, "apps/author-ecosystem/server/tests/**"),
      ];
      const prev = config.watchOptions?.ignored;
      config.watchOptions = {
        ...config.watchOptions,
        ignored: prev ? (Array.isArray(prev) ? [...prev, ...ignored] : [prev, ...ignored]) : ignored,
      };
    }
    return config;
  },
};

export default nextConfig;
