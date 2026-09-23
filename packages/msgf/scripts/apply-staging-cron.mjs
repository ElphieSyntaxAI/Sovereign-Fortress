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
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const file = path.join(ROOT, "packages/msgf/.env.staging.local");
const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
let secret = "";
for (const line of text.split(/\r?\n/)) {
  if (
    line.startsWith("MSGF_STAGING_OPS_CRON_SECRET=") ||
    line.startsWith("MSGF_OPS_CRON_SECRET=")
  ) {
    const v = line.slice(line.indexOf("=") + 1).trim();
    if (v) {
      secret = v;
      break;
    }
  }
}
if (!secret) {
  secret = crypto.randomBytes(32).toString("hex");
  fs.appendFileSync(
    file,
    `\nMSGF_STAGING_OPS_CRON_SECRET=${secret}\nMSGF_OPS_CRON_SECRET=${secret}\n`
  );
  console.log("wrote_staging_cron=true");
} else {
  console.log("reused_staging_cron=true");
}

const bash = "C:/Program Files/Git/bin/bash.exe";
const r = spawnSync(
  bash,
  [
    "-lc",
    `gcloud run services update msgf-api-staging --project=msgf-shield --region=us-central1 --update-env-vars=MSGF_OPS_CRON_SECRET=${secret}`,
  ],
  { encoding: "utf8", timeout: 180000 }
);
const out = `${r.stdout || ""}${r.stderr || ""}`.replaceAll(secret, "[REDACTED]");
console.log(out.slice(-1800));
console.log("gcloud_exit", r.status ?? 1);
process.exit(r.status ?? 1);
