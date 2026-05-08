import type { NextConfig } from "next";

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
