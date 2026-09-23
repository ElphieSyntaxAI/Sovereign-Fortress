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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
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
 * Distribution Build ID: MSGF-08289e1a-20260923T145027Z-internal
 */
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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
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
 * Distribution Build ID: MSGF-1826a636-20260922T233446Z-internal
 */
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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Copy AI provider keys from packages/msgf/.env.local onto msgf-api-staging.
 * Does not print secret values. Does not touch Stripe, Supabase, or Secret Manager mounts.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const LOCAL = path.join(ROOT, "packages/msgf/.env.local");
const ROOT_LOCAL = path.join(ROOT, ".env.local");
const STAGING_LOCAL = path.join(ROOT, "packages/msgf/.env.staging.local");

const COPY_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "XAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GCP_API_KEY",
  "GCP_MODEL_ID",
  "GCP_LOCATION",
];

const ALIASES = {
  ANTHROPIC_API_KEY: ["MASTER_ANTHROPIC_KEY"],
  GEMINI_API_KEY: ["MASTER_GEMINI_KEY"],
};

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v) out[k] = v;
  }
  return out;
}

const local = {
  ...parseEnv(ROOT_LOCAL),
  ...parseEnv(LOCAL),
};

const selected = {};
for (const key of COPY_KEYS) {
  let value = local[key];
  if (!value) {
    for (const alias of ALIASES[key] || []) {
      if (local[alias]) {
        value = local[alias];
        break;
      }
    }
  }
  if (value) selected[key] = value;
}

const found = Object.keys(selected);
if (!found.length) {
  console.error("no AI keys found in packages/msgf/.env.local or repo .env.local");
  process.exit(1);
}

for (const key of COPY_KEYS) {
  const v = selected[key];
  console.log(
    v
      ? `${key}=present len=${v.length} prefix=${v.slice(0, 3)}`
      : `${key}=missing`
  );
}

const staging = parseEnv(STAGING_LOCAL);
const extra = [];
for (const [key, value] of Object.entries(selected)) {
  if (staging[key] !== value) extra.push(`${key}=${value}`);
}
if (extra.length) {
  const suffix = extra.every((line) => !line.includes("\n"))
    ? `\n# AI keys from .env.local for staging smokes (${new Date().toISOString().slice(0, 10)})\n${extra.join("\n")}\n`
    : null;
  if (!suffix) {
    console.error("refusing to write multiline secret into .env.staging.local");
    process.exit(1);
  }
  fs.appendFileSync(STAGING_LOCAL, suffix);
  console.log("wrote_staging_local_ai_keys", extra.length);
} else {
  console.log("staging_local_ai_keys_already_current");
}

const pairs = found.map((k) => `${k}=${selected[k]}`).join(",");
if (pairs.includes("\n")) {
  console.error("refusing to send multiline env to gcloud");
  process.exit(1);
}

const bash = "C:/Program Files/Git/bin/bash.exe";
const r = spawnSync(
  bash,
  [
    "-lc",
    'gcloud run services update msgf-api-staging --project=msgf-shield --region=us-central1 --update-env-vars="$MSGF_STAGING_AI_ENV_PAIRS"',
  ],
  {
    encoding: "utf8",
    timeout: 180000,
    env: { ...process.env, MSGF_STAGING_AI_ENV_PAIRS: pairs },
  }
);

let out = `${r.stdout || ""}${r.stderr || ""}${r.error ? `\n${r.error.message}` : ""}`;
for (const value of Object.values(selected)) {
  if (value) out = out.split(value).join("[REDACTED]");
}
console.log(out.slice(-2000));
console.log("gcloud_exit", r.status ?? 1);
process.exit(r.status ?? 1);
