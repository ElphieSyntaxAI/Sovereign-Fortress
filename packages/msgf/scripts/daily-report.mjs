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
 * V3.2 BATCH — Logic Drift Summary CLI (last 24h narrative logs).
 *
 * Usage (from repo root):
 *   npm run daily-report -w msgf
 *
 * Usage (from packages/msgf):
 *   npx tsx --env-file-if-exists=../../.env --env-file-if-exists=../../.env.local \
 *     scripts/daily-report.mjs
 *
 * Optional: --hours=48  --json
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import {
  ReportingEngine,
  formatLogicDriftSummary,
} from "../lib/services/ReportingEngine.ts";

function parseArgs(argv) {
  let hours = 24;
  let jsonOnly = false;

  for (const arg of argv) {
    if (arg.startsWith("--hours=")) {
      const n = Number(arg.slice("--hours=".length));
      if (!Number.isFinite(n) || n <= 0) throw new Error("--hours must be a positive number");
      hours = n;
    } else if (arg === "--json") {
      jsonOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: daily-report.mjs [options]

Options:
  --hours=<n>   Trailing window in hours (default: 24)
  --json        Print raw JSON only (no formatted summary)
`);
      process.exit(0);
    }
  }

  return { hours, jsonOnly };
}

async function main() {
  const { hours, jsonOnly } = parseArgs(process.argv.slice(2));

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRole) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const engine = new ReportingEngine(hours);
  const summary = await engine.generateDailySummary(admin, { hours });

  if (jsonOnly) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(formatLogicDriftSummary(summary));
    console.log("");
    console.log("Structured JSON:");
    console.log(JSON.stringify(summary, null, 2));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
