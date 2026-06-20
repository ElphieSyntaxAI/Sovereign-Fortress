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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * V3.2-ULTRA Step 7 (PERSIST) — 30-day automatic purge of non-critical LOW-tier Hall entries.
 *
 * Targets cold-layer Hall storage (`pillar_vectors`, `p4_narrative_logs`, `msgf_sandbox`)
 * and resolved LOW-tier `msgf_incidents` linked to stale failure telemetry.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isLowPriorityHallRecord } from "@/lib/services/ReportingEngine";

export const HALL_PURGE_DEFAULT_RETENTION_DAYS = 30;

export const HALL_PURGE_TABLES = [
  "pillar_vectors",
  "p4_narrative_logs",
  "msgf_sandbox",
] as const;

export type HallPurgeTableName = (typeof HALL_PURGE_TABLES)[number];

const PAGE_SIZE = 500;
const DELETE_CHUNK = 100;

export type HallPurgeTableResult = {
  table: string;
  scanned: number;
  retained: number;
  deleted: number;
  wouldDelete: number;
};

export type HallPurgeProtocolResult = {
  ok: true;
  protocol: "v3.2_hall_low_tier_30d";
  executed_at: string;
  cutoff: string;
  retention_days: number;
  dry_run: boolean;
  total_deleted: number;
  total_would_delete: number;
  tables: HallPurgeTableResult[];
  incidents: {
    scanned: number;
    retained: number;
    deleted: number;
    wouldDelete: number;
  };
};

export type RunHallPurgeProtocolOptions = {
  days?: number;
  dryRun?: boolean;
  /** When false, returns counts only (API still requires auth). */
  execute?: boolean;
  supabase?: SupabaseClient;
  supabaseUrl?: string;
  serviceRole?: string;
};

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function fetchHallPurgeCandidates(
  supabase: SupabaseClient,
  table: string,
  cutoff: string
): Promise<{ purgeIds: string[]; retained: number; scanned: number }> {
  const purgeIds: string[] = [];
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
      const meta = row.metadata;
      if (!isLowPriorityHallRecord(meta)) {
        retained += 1;
        continue;
      }
      purgeIds.push(row.id as string);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { purgeIds, retained, scanned };
}

async function deleteByIds(
  supabase: SupabaseClient,
  table: string,
  ids: string[]
): Promise<number> {
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

async function purgeHallTable(
  supabase: SupabaseClient,
  table: string,
  cutoff: string,
  dryRun: boolean
): Promise<HallPurgeTableResult> {
  const { purgeIds, retained, scanned } = await fetchHallPurgeCandidates(supabase, table, cutoff);

  if (dryRun) {
    return {
      table,
      scanned,
      retained,
      deleted: 0,
      wouldDelete: purgeIds.length,
    };
  }

  const deleted = purgeIds.length ? await deleteByIds(supabase, table, purgeIds) : 0;
  return { table, scanned, retained, deleted, wouldDelete: purgeIds.length };
}

async function purgeLowTierIncidents(
  supabase: SupabaseClient,
  cutoff: string,
  dryRun: boolean
): Promise<HallPurgeProtocolResult["incidents"]> {
  const purgeIds: string[] = [];
  let retained = 0;
  let scanned = 0;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("msgf_incidents")
      .select("id, metadata, status, created_at")
      .eq("status", "resolved")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`msgf_incidents scan failed: ${error.message}`);
    }

    const rows = data ?? [];
    if (!rows.length) break;

    scanned += rows.length;
    for (const row of rows) {
      if (!isLowPriorityHallRecord(row.metadata)) {
        retained += 1;
        continue;
      }
      purgeIds.push(row.id as string);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (dryRun) {
    return {
      scanned,
      retained,
      deleted: 0,
      wouldDelete: purgeIds.length,
    };
  }

  const deleted = purgeIds.length ? await deleteByIds(supabase, "msgf_incidents", purgeIds) : 0;
  return { scanned, retained, deleted, wouldDelete: purgeIds.length };
}

/**
 * Run V3.2 Hall LOW-tier hygiene (30-day default). Uses service-role Supabase client.
 */
export async function runHallPurgeProtocol(
  options: RunHallPurgeProtocolOptions = {}
): Promise<HallPurgeProtocolResult> {
  const days = options.days ?? HALL_PURGE_DEFAULT_RETENTION_DAYS;
  const dryRun = options.dryRun ?? false;
  const execute = options.execute ?? true;

  if (!execute && !dryRun) {
    throw new Error("Refusing to delete without execute=true or dryRun=true.");
  }

  const supabaseUrl =
    options.supabaseUrl?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const serviceRole =
    options.serviceRole?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!options.supabase && (!supabaseUrl || !serviceRole)) {
    throw new Error(
      "Missing Supabase client or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase =
    options.supabase ??
    createClient(supabaseUrl!, serviceRole!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  const cutoff = cutoffIso(days);
  const executedAt = new Date().toISOString();

  const tableResults: HallPurgeTableResult[] = [];
  for (const table of HALL_PURGE_TABLES) {
    tableResults.push(await purgeHallTable(supabase, table, cutoff, dryRun));
  }

  const incidents = await purgeLowTierIncidents(supabase, cutoff, dryRun);

  const totalDeleted = tableResults.reduce((sum, r) => sum + r.deleted, 0) + incidents.deleted;
  const totalWouldDelete =
    tableResults.reduce((sum, r) => sum + r.wouldDelete, 0) + incidents.wouldDelete;

  return {
    ok: true,
    protocol: "v3.2_hall_low_tier_30d",
    executed_at: executedAt,
    cutoff,
    retention_days: days,
    dry_run: dryRun,
    total_deleted: dryRun ? 0 : totalDeleted,
    total_would_delete: totalWouldDelete,
    tables: tableResults,
    incidents,
  };
}

