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
 * Distribution Build ID: MSGF-dde0b5b-20260519T185358Z-internal
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsup";

function readDistributionBuildId(): string {
  const manifest = resolve(__dirname, ".msgf", "BUILD_ID");
  if (!existsSync(manifest)) return "MSGF-unstamped";
  const id = readFileSync(manifest, "utf8").trim();
  return id || "MSGF-unstamped";
}

const distributionBuildId = readDistributionBuildId();
const sdkJsBanner =
  `/*! Proprietary & Confidential — Elphie Syntax LLC. ` +
  `Build ID: ${distributionBuildId}. ` +
  `Unauthorized reproduction or reverse-engineering prohibited. */`;

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const dependencyNames = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];

const isProduction =
  process.env.NODE_ENV === "production" || process.env.MSGF_SDK_PRODUCTION === "1";

const dtsOnly = process.env.MSGF_SDK_DTS_ONLY === "1";

/** Browser-safe SDK entries — declaration emit via `MSGF_SDK_DTS_ONLY=1` pass. */
export const clientSdkEntries = {
  index: "lib/index.ts",
  connector: "lib/connector/client.ts",
  "connector/MsgfBridge": "lib/connector/MsgfBridge.ts",
  "lib/msgf-auth-cookies": "lib/msgf-auth-cookies.ts",
  "lib/platform-persona-auth": "lib/platform-persona-auth.ts",
  "universal/p1-hal-standard": "src/lib/universal/p1HalStandard.ts",
  ui: "ui/index.ts",
  "ide-connector": "lib/ide-connector.ts",
} as const;

/** Server / BFF — minified JS + stub .d.ts from scripts/generate-server-dts.mjs */
export const serverSdkEntries = {
  "connector/server": "lib/connector/server.ts",
  onboarding: "lib/msgf-onboarding.ts",
  remediation: "lib/services/RemediationEngine.ts",
} as const;

const allSdkEntries = { ...clientSdkEntries, ...serverSdkEntries };

export default defineConfig({
  entry: dtsOnly ? clientSdkEntries : allSdkEntries,
  outDir: "dist",
  format: ["esm"],
  target: "es2020",
  platform: "neutral",
  bundle: true,
  splitting: false,
  treeshake: true,
  clean: !dtsOnly,
  dts: dtsOnly
    ? {
        only: true,
        compilerOptions: {
          skipLibCheck: true,
        },
      }
    : false,
  sourcemap: false,
  minify: !dtsOnly && isProduction,
  skipNodeModulesBundle: true,
  external: [...dependencyNames, "react", "react-dom", "next"],
  tsconfig: "tsconfig.sdk.json",
  esbuildOptions(options) {
    options.banner = { js: sdkJsBanner };
    options.alias = {
      "@": resolve(__dirname, "."),
      "@msgf": resolve(__dirname, "src"),
      "@msgf/lib": resolve(__dirname, "src/lib"),
    };
    options.legalComments = "none";
    if (isProduction && !dtsOnly) {
      options.drop = ["console", "debugger"];
    }
  },
  outExtension() {
    return { js: ".js" };
  },
});
