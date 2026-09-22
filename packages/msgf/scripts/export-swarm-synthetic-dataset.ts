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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * Export synthetic swarm stress cases as JSONL (no tenant rows, no user prompts).
 *
 *   npm run export:swarm-synthetic -w msgf
 *   npm run export:swarm-synthetic -w msgf -- --out=./swarm-synthetic.jsonl
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { collectSyntheticSwarmDataset } from "../lib/services/swarm-synthetic-catalog";

function parseOutPath(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg.startsWith("--out=")) return arg.slice("--out=".length).trim() || null;
  }
  return null;
}

async function main() {
  const rows = await collectSyntheticSwarmDataset();
  const jsonl = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  const out = parseOutPath(process.argv.slice(2));
  if (out) {
    const abs = resolve(out);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, jsonl, "utf8");
    console.error(`wrote ${rows.length} synthetic swarm cases → ${abs}`);
  } else {
    process.stdout.write(jsonl);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
