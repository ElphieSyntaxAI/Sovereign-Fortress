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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/**
 * Read-only SWEEP shard index for active files (P5 shadow ingest cache in pillar_vectors).
 * No local AST parsing — lightweight line/export hints only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import { normalizeTenantId } from "@/lib/services/msgf-metadata-scope";

const SHARD_CHAR_CAP =
  (Number(process.env.MSGF_CONVERGE_MAX_CONTEXT_TOKENS?.trim()) || 2400) * 4;

export type ShadowScanFileShard = {
  file_path: string;
  naive_char_count: number;
  sharded_char_count: number;
  line_count: number;
  boundary_summary: string;
  ast_hints: string[];
  governance_pillar: string | null;
  ingested_at: string | null;
};

export type ShadowScanShardLookupResult = {
  files: ShadowScanFileShard[];
  naive_char_total: number;
  sharded_char_total: number;
};

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function lightweightAstHints(content: string, filePath: string): string[] {
  const hints: string[] = [];
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (/export\s+(async\s+)?function\s+\w+/m.test(content)) {
    hints.push("exports named functions");
  }
  if (/export\s+(default\s+)?class\s+\w+/m.test(content)) {
    hints.push("exports class");
  }
  if (/export\s+(type|interface)\s+\w+/m.test(content)) {
    hints.push("exports types");
  }
  if (/\bimport\s+.+\s+from\s+['"]/m.test(content)) {
    hints.push("has ES module imports");
  }
  if (ext === "ts" || ext === "tsx") {
    const iface = (content.match(/\binterface\s+\w+/g) ?? []).length;
    const types = (content.match(/\btype\s+\w+\s*=/g) ?? []).length;
    if (iface + types > 0) hints.push(`${iface + types} type surface(s)`);
  }
  if (!hints.length) hints.push("module body (no export signature detected)");
  return hints.slice(0, 6);
}

function boundarySummary(lineCount: number, naive: number, sharded: number): string {
  const cappedLines = Math.max(1, Math.min(lineCount, Math.floor(sharded / 48)));
  return `scope lines 1–${cappedLines} · ${sharded}/${naive} chars (P5 cap ${SHARD_CHAR_CAP})`;
}

/**
 * Latest SWEEP row per path for tenant (server-side filter; bounded paths).
 */
export async function lookupShadowScanShardsForPaths(
  admin: SupabaseClient,
  tenantId: string,
  activeFilePaths: readonly string[]
): Promise<ShadowScanShardLookupResult> {
  const tid = normalizeTenantId(tenantId);
  const paths = [...new Set(activeFilePaths.map(normalizePath).filter(Boolean))].slice(0, 32);

  if (!paths.length) {
    return { files: [], naive_char_total: 0, sharded_char_total: 0 };
  }

  const { data, error } = await fromPillarVectors(admin, tid)
    .select("content, metadata")
    .eq("metadata->>ingest_source", "sweep")
    .eq("metadata->>tenant_id", tid)
    .limit(500);

  if (error) {
    console.warn("[shadow-scan-shard-lookup]", error.message);
    return { files: [], naive_char_total: 0, sharded_char_total: 0 };
  }

  const pathSet = new Set(paths);
  const latestByPath = new Map<string, { content: string; meta: Record<string, unknown> }>();

  for (const row of data ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const original =
      typeof meta.original_path === "string" ? normalizePath(meta.original_path) : "";
    if (!original || !pathSet.has(original)) continue;

    const ingestedAt =
      typeof meta.ingested_at === "string" ? meta.ingested_at : "";
    const prior = latestByPath.get(original);
    if (!prior || ingestedAt > (prior.meta.ingested_at as string)) {
      latestByPath.set(original, {
        content: typeof row.content === "string" ? row.content : "",
        meta,
      });
    }
  }

  const files: ShadowScanFileShard[] = [];

  for (const filePath of paths) {
    const hit = latestByPath.get(filePath);
    if (!hit) {
      files.push({
        file_path: filePath,
        naive_char_count: 0,
        sharded_char_count: 0,
        line_count: 0,
        boundary_summary: "no SWEEP shard — run shadow scan / ingest for this path",
        ast_hints: ["not indexed"],
        governance_pillar: null,
        ingested_at: null,
      });
      continue;
    }

    const content = hit.content;
    const naive = content.length;
    const sharded = Math.min(naive, SHARD_CHAR_CAP);
    const lineCount = content ? content.split(/\n/).length : 0;

    files.push({
      file_path: filePath,
      naive_char_count: naive,
      sharded_char_count: sharded,
      line_count: lineCount,
      boundary_summary: boundarySummary(lineCount, naive, sharded),
      ast_hints: lightweightAstHints(content, filePath),
      governance_pillar:
        typeof hit.meta.governance_pillar === "string" ? hit.meta.governance_pillar : null,
      ingested_at: typeof hit.meta.ingested_at === "string" ? hit.meta.ingested_at : null,
    });
  }

  const naive_char_total = files.reduce((s, f) => s + f.naive_char_count, 0);
  const sharded_char_total = files.reduce((s, f) => s + f.sharded_char_count, 0);

  return { files, naive_char_total, sharded_char_total };
}
