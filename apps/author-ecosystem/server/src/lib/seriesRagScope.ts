import type { SupabaseClient } from "@supabase/supabase-js";

import { chunkMatchesManuscript, isScrappedWiki } from "./wikiEntryHelpers.js";

export type SeriesRagScope = {
  tenantId: string;
  activeManuscriptId: string | null;
  seriesId: string | null;
  seriesManuscriptIds: string[];
  isSeries: boolean;
};

export async function resolveSeriesRagScope(
  supabase: SupabaseClient,
  tenantId: string,
  activeManuscriptId?: string | null
): Promise<SeriesRagScope> {
  const base: SeriesRagScope = {
    tenantId,
    activeManuscriptId: activeManuscriptId?.trim() || null,
    seriesId: null,
    seriesManuscriptIds: [],
    isSeries: false,
  };

  const mid = base.activeManuscriptId;
  if (!mid) return base;

  const { data: ms, error } = await supabase
    .from("p4_manuscripts")
    .select("id, series_id")
    .eq("id", mid)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(`resolveSeriesRagScope: ${error.message}`);
  if (!ms) {
    return { ...base, seriesManuscriptIds: [mid] };
  }

  const seriesId = ms.series_id != null ? String(ms.series_id) : null;
  if (!seriesId) {
    return { ...base, seriesManuscriptIds: [mid] };
  }

  const { data: siblings, error: sibErr } = await supabase
    .from("p4_manuscripts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("series_id", seriesId);

  if (sibErr) throw new Error(`resolveSeriesRagScope siblings: ${sibErr.message}`);

  const ids = (siblings ?? []).map((r) => String(r.id));
  return {
    tenantId,
    activeManuscriptId: mid,
    seriesId,
    seriesManuscriptIds: ids.length > 0 ? ids : [mid],
    isSeries: true,
  };
}

export function isWikiSnapshot(meta: Record<string, unknown>): boolean {
  return String(meta.ledger ?? "") === "wiki_snapshot";
}

/** Wiki lore that finished revisions / canon commit should stay in RAG even when drafts are hidden. */
export function isWikiLockedForRag(meta: Record<string, unknown>): boolean {
  if (!isWikiSnapshot(meta)) return false;
  const locked = meta.wiki_hard_locked;
  if (locked === true || locked === "true" || locked === "1" || locked === "yes") return true;
  if (String(meta.wiki_visibility ?? "") === "canon") return true;
  if (meta.wiki_revision_locked_at) return true;
  return false;
}

export type ManuscriptScopeMatchOptions = {
  /** When true, chunks with no manuscript/series attribution are excluded. */
  strict?: boolean;
  seriesId?: string | null;
};

export function chunkMatchesManuscriptScope(
  meta: Record<string, unknown>,
  manuscriptIds: string[],
  options?: ManuscriptScopeMatchOptions
): boolean {
  if (manuscriptIds.length === 0) return true;

  for (const id of manuscriptIds) {
    if (chunkMatchesManuscript(meta, id)) return true;
  }

  const seriesId = options?.seriesId?.trim();
  if (seriesId && String(meta.series_id ?? "") === seriesId) return true;

  const mid = String(meta.manuscript_id ?? "").trim();
  const project = String(meta.project_id ?? "").trim();
  const src = String(meta.source_document ?? "").trim();
  if (!mid && !project && !src) {
    return options?.strict !== true;
  }

  return false;
}

function scopeMatchOptions(scope: SeriesRagScope): ManuscriptScopeMatchOptions | undefined {
  const scopeIds = scope.isSeries
    ? scope.seriesManuscriptIds
    : scope.activeManuscriptId
      ? [scope.activeManuscriptId]
      : [];
  if (scopeIds.length === 0) return undefined;
  return {
    strict: true,
    seriesId: scope.seriesId,
  };
}

export function chunkInActiveScope(meta: Record<string, unknown>, scope: SeriesRagScope): boolean {
  const scopeIds = scope.isSeries
    ? scope.seriesManuscriptIds
    : scope.activeManuscriptId
      ? [scope.activeManuscriptId]
      : [];
  if (scopeIds.length === 0) return true;
  return chunkMatchesManuscriptScope(meta, scopeIds, scopeMatchOptions(scope));
}

const SPOILER_RANK: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function spoilerRank(meta: Record<string, unknown>): number {
  const raw = String(meta.spoiler_level ?? meta["Spoiler Level"] ?? "high").toLowerCase();
  return SPOILER_RANK[raw] ?? 3;
}

export function shouldIncludeChunkForP4Rag(
  meta: Record<string, unknown>,
  scope: SeriesRagScope,
  opts: { includeWikiDrafts: boolean; audience: "fan" | "author" }
): boolean {
  if (isScrappedWiki(meta)) return false;

  if (!chunkInActiveScope(meta, scope)) return false;

  if (opts.audience === "fan") {
    if (isWikiSnapshot(meta) && !isWikiLockedForRag(meta)) return false;
    if (spoilerRank(meta) > 1) return false;
  }

  if (!isWikiSnapshot(meta)) return true;
  if (opts.includeWikiDrafts) return true;
  return isWikiLockedForRag(meta);
}

export function isOutlinePlotForScope(
  meta: Record<string, unknown>,
  scope: SeriesRagScope,
  activeManuscriptId: string
): boolean {
  const ids = scope.isSeries ? scope.seriesManuscriptIds : [activeManuscriptId];
  if (meta["outline"] === true || meta["is_outline"] === true) {
    return chunkMatchesManuscriptScope(meta, ids, scopeMatchOptions(scope));
  }
  return ids.some((id) => String(meta["manuscript_id"] ?? "") === id);
}
