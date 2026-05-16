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

import { createClient } from "@supabase/supabase-js";
import { isRedTierHallRecord } from "../lib/services/ReportingEngine.ts";

const PAGE_SIZE = 500;
const DELETE_CHUNK = 100;
const DEFAULT_RETENTION_DAYS = 30;

const TABLES = ["pillar_vectors", "p4_narrative_logs"];

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

Tables: pillar_vectors, p4_narrative_logs
Keeps: RED-tier + 1.1.1_HITL_TIEBREAKER + 1.1.1_LOM_RECURSION_LIMIT
`);
      process.exit(0);
    }
  }

  return out;
}

function cutoffIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function fetchHallCandidates(supabase, table, cutoff) {
  const purgeIds = [];
  let retained = 0;
  let scanned = 0;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("id, metadata, created_at")
      .eq("metadata->>ledger", "hall")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`${table} scan failed: ${error.message}`);
    }

    const rows = data ?? [];
    if (!rows.length) break;

    scanned += rows.length;
    for (const row of rows) {
      if (isRedTierHallRecord(row.metadata)) {
        retained += 1;
        continue;
      }
      purgeIds.push(row.id);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { purgeIds, retained, scanned };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function deleteByIds(supabase, table, ids) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_CHUNK);
    const { error, count } = await supabase.from(table).delete({ count: "exact" }).in("id", chunk);
    if (error) {
      throw new Error(`${table} delete failed: ${error.message}`);
    }
    deleted += count ?? chunk.length;
  }
  return deleted;
}

async function purgeTable(supabase, table, cutoff, dryRun) {
  const { purgeIds, retained, scanned } = await fetchHallCandidates(supabase, table, cutoff);

  if (dryRun) {
    return { table, scanned, retained, deleted: 0, wouldDelete: purgeIds.length };
  }

  const deleted = purgeIds.length ? await deleteByIds(supabase, table, purgeIds) : 0;
  return { table, scanned, retained, deleted, wouldDelete: purgeIds.length };
}

export async function runHallPurgeProtocol(options = {}) {
  const days = options.days ?? DEFAULT_RETENTION_DAYS;
  const dryRun = options.dryRun ?? false;
  const yes = options.yes ?? false;

  if (!dryRun && !yes) {
    throw new Error("Refusing to delete without yes=true (use dryRun to preview).");
  }

  const supabaseUrl =
    options.supabaseUrl?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const serviceRole =
    options.serviceRole?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRole) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const cutoff = cutoffIso(days);
  const supabase =
    options.supabase ??
    createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  const results = [];
  for (const table of TABLES) {
    results.push(await purgeTable(supabase, table, cutoff, dryRun));
  }

  const total = results.reduce(
    (sum, r) => sum + (dryRun ? r.wouldDelete : r.deleted),
    0
  );

  return { cutoff, days, dryRun, results, total };
}

async function main() {
  const { days, dryRun, yes } = parseArgs(process.argv.slice(2));

  console.log("MSGF ops-purge-hall — 30-day Brain hygiene protocol");
  console.log("  Goal    : drop stale non-critical Hall noise from vector + narrative stores");
  console.log(`  Mode    : ${dryRun ? "DRY RUN" : "EXECUTE"}`);
  console.log(`  Retain  : ${days} days of Hall drift; older non-RED rows are purged`);
  console.log("  Keep    : RED-tier + HITL / LOM recursion (long-term protection training)");
  console.log("");

  const { cutoff, results, total } = await runHallPurgeProtocol({ days, dryRun, yes });

  console.log(`  Cutoff  : created_at < ${cutoff}`);
  console.log("");

  for (const r of results) {
    console.log(`Table: ${r.table}`);
    console.log(`  Scanned (hall, stale): ${r.scanned}`);
    console.log(`  Retained (critical):   ${r.retained}`);
    console.log(
      `  ${dryRun ? "Would delete" : "Deleted"}:          ${dryRun ? r.wouldDelete : r.deleted}`
    );
    console.log("");
  }

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
