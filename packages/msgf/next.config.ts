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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { withSentryConfig } from "@sentry/nextjs";
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
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/apps/author-ecosystem/client/**",
          "**/apps/author-ecosystem/server/tests/**",
        ],
      };
    }
    return sanitizeWatchOptionsIgnored(config as Record<string, unknown>) as typeof config;
  },
};

/**
 * Webpack schema requires every `watchOptions.ignored` entry to be a non-empty string.
 * Sentry/Next can inject `""` on a sealed `watchOptions` object — replace the object, don't mutate.
 */
function sanitizeWatchOptionsIgnored(webpackConfig: Record<string, unknown>) {
  const watchOptions = webpackConfig.watchOptions as
    | { ignored?: unknown; [key: string]: unknown }
    | undefined;
  if (!watchOptions || watchOptions.ignored == null) return webpackConfig;

  const ignored = watchOptions.ignored;
  const list = (Array.isArray(ignored) ? ignored : [ignored]).filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
  );

  const nextWatchOptions: Record<string, unknown> = { ...watchOptions };
  if (list.length > 0) {
    nextWatchOptions.ignored = list;
  } else {
    delete nextWatchOptions.ignored;
  }

  try {
    webpackConfig.watchOptions = nextWatchOptions;
    return webpackConfig;
  } catch {
    return { ...webpackConfig, watchOptions: nextWatchOptions };
  }
}

function withSanitizedWatchOptions(config: NextConfig): NextConfig {
  const prior = config.webpack;
  return {
    ...config,
    webpack(webpackConfig, options) {
      const resolved =
        typeof prior === "function" ? prior(webpackConfig, options) : webpackConfig;
      return sanitizeWatchOptionsIgnored(resolved as Record<string, unknown>) as typeof resolved;
    },
  };
}

const hasSentryToken = Boolean(process.env.SENTRY_AUTH_TOKEN?.trim());

const sentryOptions = {
  org: process.env.SENTRY_ORG?.trim() || process.env.SENTRY_ORG_SLUG?.trim() || undefined,
  project:
    process.env.SENTRY_PROJECT?.trim() || process.env.SENTRY_PROJECT_SLUG?.trim() || undefined,
  authToken: process.env.SENTRY_AUTH_TOKEN?.trim() || undefined,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  // Docker/Cloud Build has no Sentry token — skip Sentry webpack injection (avoids empty
  // `watchOptions.ignored` schema failures during `next build`).
  webpack: {
    disableSentryConfig: !hasSentryToken,
  },
  sourcemaps: {
    disable: !hasSentryToken,
  },
};

// Sanitize must wrap Sentry so empty `ignored` entries are removed last.
export default withSanitizedWatchOptions(withSentryConfig(nextConfig, sentryOptions));
