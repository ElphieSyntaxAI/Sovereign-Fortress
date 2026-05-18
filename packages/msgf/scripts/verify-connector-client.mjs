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
 * Distribution Build ID: MSGF-4e22f0c-20260518T205132Z-internal
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
 * Distribution Build ID: MSGF-51d39b5-20260516T031044Z-internal
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
 * Distribution Build ID: MSGF-2d8d295-20260516T002421Z-internal
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
 * Distribution Build ID: MSGF-2d8d295-20260516T002100Z-internal
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
 * Distribution Build ID: MSGF-2d8d295-20260516T001739Z-internal
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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
/**
 * Ensures msgf/connector (client) does not pull PulseEngine, RemediationEngine, or prompt templates.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "connector");

const CLIENT_ENTRY_FILES = new Set([
  "client.ts",
  "index.ts",
  "MsgfBridge.ts",
  "brain-sensitivity.ts",
  "tenant.ts",
  "bearer-auth.ts",
  "error-mapper.ts",
  "exceptions.ts",
  "ingest-payload.ts",
  "notify-author-pulse-rejected.ts",
  "p1-standard.ts",
  "report-system-issue.ts",
  "self-heal-report-ui.ts",
  "sentinel-snapshot-bundle.ts",
  "session-store.ts",
]);

const FORBIDDEN_IMPORTS = [
  /services\/PulseEngine/,
  /services\/RemediationEngine/,
  /services\/logic-drift/,
  /services\/pillar-baseline/,
  /services\/IngestService/,
  /services\/self-heal-report/,
  /services\/p2-flow-roadmap/,
  /services\/emergency-lom/,
  /services\/local-state-gateway/,
  /services\/local-session-delta/,
  /msgf-shadow/,
  /msgf-vertex/,
  /redis-client/,
];

const FORBIDDEN_IDENTIFIERS = [
  /\bPulseEngine\b/,
  /\bRemediationEngine\b/,
  /\bMODULAR_STRATEGY_MATRIX\b/,
  /\bREMEDIATION_MATRIX\b/,
  /\bpromptTemplate\b/i,
  /\bPROMPT_/,
  /\bbuildRemediationFixTemplate\b/,
  /\brunFullPipeline\b/,
  /\bremediationEngine\b/,
  /\bpulseEngine\b/,
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, out);
    } else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) {
      out.push(path);
    }
  }
  return out;
}

const files = walk(root).filter((f) => CLIENT_ENTRY_FILES.has(relative(root, f).replace(/\\/g, "/")));

let failed = false;

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");

  for (const pattern of FORBIDDEN_IMPORTS) {
    if (pattern.test(text)) {
      console.error(`[verify-connector-client] forbidden import in ${rel}: ${pattern}`);
      failed = true;
    }
  }

  for (const pattern of FORBIDDEN_IDENTIFIERS) {
    if (pattern.test(text)) {
      console.error(`[verify-connector-client] forbidden symbol in ${rel}: ${pattern}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`[verify-connector-client] OK — ${files.length} client-safe connector files checked.`);
