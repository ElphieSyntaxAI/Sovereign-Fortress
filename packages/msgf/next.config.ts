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
