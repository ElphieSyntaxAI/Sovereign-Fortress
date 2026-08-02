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
 * SWEEP ingest index — list ingested paths and project_origin tags for a tenant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import { normalizeTenantId } from "@/lib/services/msgf-metadata-scope";

export type SweepIngestIndex = {
  project_origins: string[];
  ingested_paths: string[];
  folder_roots: string[];
};

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function deriveFolderRoots(paths: readonly string[]): string[] {
  const roots = new Set<string>();
  for (const p of paths) {
    const parts = normalizePath(p).split("/").filter(Boolean);
    if (parts.length >= 2) {
      roots.add(`${parts[0]}/${parts[1]}`);
    } else if (parts.length === 1) {
      roots.add(parts[0]!);
    }
  }
  return [...roots].sort().slice(0, 12);
}

function originMatches(stored: string, requested: string): boolean {
  const s = stored.trim().toLowerCase();
  const r = requested.trim().toLowerCase();
  if (!r) return true;
  if (s === r) return true;
  if (s.endsWith(`/${r}`) || r.endsWith(`/${s}`)) return true;
  const sLeaf = s.split("/").pop() ?? s;
  const rLeaf = r.split("/").pop() ?? r;
  return sLeaf === rLeaf;
}

/**
 * Latest SWEEP paths for tenant, optionally filtered by mapped project_origin.
 */
export async function listSweepIngestIndex(
  admin: SupabaseClient,
  tenantId: string,
  projectOrigin?: string | null
): Promise<SweepIngestIndex> {
  const tid = normalizeTenantId(tenantId);
  const { data, error } = await fromPillarVectors(admin, tid)
    .select("metadata")
    .eq("metadata->>ingest_source", "sweep")
    .eq("metadata->>tenant_id", tid)
    .limit(2000);

  if (error) {
    console.warn("[sweep-ingest-index]", error.message);
    return { project_origins: [], ingested_paths: [], folder_roots: [] };
  }

  const originSet = new Set<string>();
  const pathLatest = new Map<string, string>();

  for (const row of data ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const origin =
      typeof meta.project_origin === "string" ? meta.project_origin.trim() : "";
    const original =
      typeof meta.original_path === "string" ? normalizePath(meta.original_path) : "";
    const ingestedAt =
      typeof meta.ingested_at === "string" ? meta.ingested_at : "";

    if (origin) originSet.add(origin);
    if (!original) continue;
    if (projectOrigin?.trim() && origin && !originMatches(origin, projectOrigin)) {
      continue;
    }

    const prior = pathLatest.get(original);
    if (!prior || ingestedAt > prior) {
      pathLatest.set(original, ingestedAt);
    }
  }

  const ingested_paths = [...pathLatest.keys()].sort().slice(0, 200);

  return {
    project_origins: [...originSet].sort(),
    ingested_paths,
    folder_roots: deriveFolderRoots(ingested_paths),
  };
}

export type ComposerAttachmentBlock = {
  file_lines: string[];
  folder_lines: string[];
};

/** Cursor / VS Code Composer @ attachments for minimal context. */
export function buildComposerAttachments(paths: readonly string[]): ComposerAttachmentBlock {
  const file_lines = [...new Set(paths.map((p) => `@${normalizePath(p)}`))].slice(0, 12);
  const folders = new Set<string>();
  for (const p of paths) {
    const norm = normalizePath(p);
    const idx = norm.lastIndexOf("/");
    if (idx > 0) {
      folders.add(`@folder/${norm.slice(0, idx)}`);
    }
  }
  const folder_lines = [...folders].sort().slice(0, 8);
  return { file_lines, folder_lines };
}
