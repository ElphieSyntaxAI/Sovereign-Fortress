#!/usr/bin/env node
/**
 * Optional live API smoke for integrator workspaces.
 * Skips gracefully when MSGF_AUTH_TOKEN is unset.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.resolve(scriptDir, "../..");
const envFile = path.join(kitRoot, "dev/env.local.json");

function loadEnvFile() {
  if (!fs.existsSync(envFile)) return;
  const j = JSON.parse(fs.readFileSync(envFile, "utf8"));
  for (const k of ["MSGF_API_URL", "MSGF_AUTH_TOKEN", "MSGF_TENANT_KEY"]) {
    if (j[k] && !process.env[k]) process.env[k] = String(j[k]);
  }
}

loadEnvFile();

const base = (process.env.MSGF_API_URL ?? "").replace(/\/$/, "");
const token = process.env.MSGF_AUTH_TOKEN ?? "";
const tenant = process.env.MSGF_TENANT_KEY ?? "";

if (!token) {
  console.log("[smoke-integrator] SKIP — set MSGF_AUTH_TOKEN or dev/env.local.json");
  process.exit(0);
}

if (!base || !tenant) {
  console.error("[smoke-integrator] FAIL — need MSGF_API_URL and MSGF_TENANT_KEY");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "X-MSGF-Tenant-Key": tenant,
  "x-msgf-tenant-id": tenant,
};

async function get(pathname) {
  const url = `${base}${pathname}`;
  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${pathname} → ${res.status} ${text.slice(0, 200)}`);
  }
  return text;
}

console.log("[smoke-integrator] MSGF integrator live smoke\n");

await get("/api/msgf/ide/connectivity-check");
console.log("[smoke-integrator] OK connectivity-check");

await get("/api/msgf/agent-context?mode=guided");
console.log("[smoke-integrator] OK agent-context");

console.log("\n[smoke-integrator] Passed.");
