import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROOT = __dirname;

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, "packages", "msgf", ".env.local"));

const baseURL = (
  process.env.MSGF_APP_URL ||
  process.env.NEXT_PUBLIC_MSGF_APP_URL ||
  "http://127.0.0.1:3001"
).replace(/\/+$/, "");

const localHost = (() => {
  try {
    const { hostname } = new URL(baseURL);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1"
    );
  } catch {
    return true;
  }
})();

const reportsDir = path.join(ROOT, "tests", "reports");
fs.mkdirSync(reportsDir, { recursive: true });

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["./tests/msgf/helpers/msgf-file-reporter.ts"],
  ],
  use: {
    baseURL,
    extraHTTPHeaders: { Accept: "application/json" },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "api-stress",
      testMatch: "**/stress.pulse-ingest.spec.ts",
      fullyParallel: false,
    },
    {
      name: "ui-smoke",
      testMatch: "**/ui-smoke.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "checkout-paid",
      testMatch: "**/checkout-paid.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: localHost
    ? {
        command: "npm run dev -w msgf",
        url: `${baseURL}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});
