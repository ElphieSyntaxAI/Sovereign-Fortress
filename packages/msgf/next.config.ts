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
 * Distribution Build ID: MSGF-2d8d295-20260516T002421Z-internal
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
  webpack(config) {
    // Author-ecosystem sources use `.js` extensions in TypeScript ESM imports; resolve to `.ts` for bundling.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
