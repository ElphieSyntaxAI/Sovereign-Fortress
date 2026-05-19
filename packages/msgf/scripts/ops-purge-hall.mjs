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
 * Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
 */
/**
 * V3.2 Automatic Purge — ops entry for the 30-day Hall protocol.
 *
 * Keeps the MSGF Brain vector index focused on recent, relevant protection patterns by
 * removing stale low-tier Hall drift from `pillar_vectors` and `p4_narrative_logs`.
 *
 * Deletes rows where:
 *   - metadata.ledger = 'hall'
 *   - created_at older than 30 days (override with --days=N)
 *   - NOT critical RED-tier (retains long-term training corpus)
 *
 * Retained (never purged):
 *   - metadata.tier = 'RED'
 *   - 1.1.1_HITL_TIEBREAKER
 *   - 1.1.1_LOM_RECURSION_LIMIT
 *
 * Usage (from repo root):
 *   npm run ops:purge-hall -w msgf -- --dry-run
 *   npm run ops:purge-hall -w msgf -- --yes
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */

import { runHallPurgeProtocol } from "../lib/services/hall-purge-protocol.ts";

const DEFAULT_RETENTION_DAYS = 30;

function parseArgs(argv) {
  const out = { days: DEFAULT_RETENTION_DAYS, dryRun: false, yes: false };

  for (const arg of argv) {
    if (arg.startsWith("--days=")) {
      const n = Number(arg.slice("--days=".length));
      if (!Number.isFinite(n) || n <= 0) throw new Error("--days must be a positive number");
      out.days = Math.floor(n);
    } else if (arg === "--dry-run") {
      out.dryRun = true;
    } else if (arg === "--yes") {
      out.yes = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: ops-purge-hall.mjs [options]

V3.2 30-day purge — non-critical Hall entries only (Brain vector hygiene).

Options:
  --days=<n>    Retention window in days (default: ${DEFAULT_RETENTION_DAYS})
  --dry-run     Count candidates only; no deletes
  --yes         Required to execute deletes (omit with --dry-run)

Tables: pillar_vectors, p4_narrative_logs, msgf_sandbox, msgf_incidents (resolved LOW/GREEN)
Keeps: RED-tier + 1.1.1_HITL_TIEBREAKER + 1.1.1_LOM_RECURSION_LIMIT; YELLOW Hall rows
`);
      process.exit(0);
    }
  }

  return out;
}

async function main() {
  const { days, dryRun, yes } = parseArgs(process.argv.slice(2));

  if (!dryRun && !yes) {
    throw new Error("Refusing to delete without --yes (use --dry-run to preview).");
  }

  console.log("MSGF ops-purge-hall — 30-day Brain hygiene protocol");
  console.log("  Goal    : drop stale non-critical Hall noise from vector + narrative stores");
  console.log(`  Mode    : ${dryRun ? "DRY RUN" : "EXECUTE"}`);
  console.log(`  Retain  : ${days} days of Hall drift; older non-RED rows are purged`);
  console.log("  Keep    : RED-tier + HITL / LOM recursion (long-term protection training)");
  console.log("");

  const result = await runHallPurgeProtocol({
    days,
    dryRun,
    execute: yes && !dryRun,
  });

  console.log(`  Cutoff  : created_at < ${result.cutoff}`);
  console.log("");

  for (const r of result.tables) {
    console.log(`Table: ${r.table}`);
    console.log(`  Scanned (hall, stale): ${r.scanned}`);
    console.log(`  Retained (non-LOW):    ${r.retained}`);
    console.log(
      `  ${dryRun ? "Would delete" : "Deleted"}:          ${dryRun ? r.wouldDelete : r.deleted}`
    );
    console.log("");
  }

  console.log("Table: msgf_incidents (resolved LOW/GREEN)");
  console.log(`  Scanned: ${result.incidents.scanned}`);
  console.log(`  Retained: ${result.incidents.retained}`);
  console.log(
    `  ${dryRun ? "Would delete" : "Deleted"}: ${dryRun ? result.incidents.wouldDelete : result.incidents.deleted}`
  );
  console.log("");

  const total = dryRun ? result.total_would_delete : result.total_deleted;
  console.log(
    dryRun
      ? `Dry run complete. ${total} row(s) would be purged — Brain index stays lean.`
      : `Purge complete. ${total} row(s) removed — vector search focused on recent protection patterns.`
  );
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("ops-purge-hall.mjs") || process.argv[1].endsWith("purge-hall.mjs"));

if (isMain) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
