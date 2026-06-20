import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProposedWikiEntry } from "./documentIngestGate.js";
import { areNearDuplicateTexts, synopsisFingerprint } from "./documentIngestCompile.js";
import { isUserOverrideChunk } from "./chunkLifecycle.js";
import { embedWikiExcerptForIngest } from "./wikiEntryHelpers.js";

export type ConvergenceStats = {
  inserted: number;
  updated: number;
  skipped: number;
  skipped_user_override: number;
};

export type ConvergeAction = "inserted" | "updated" | "skipped";

export type ConvergeResult = {
  action: ConvergeAction;
  id?: string;
  userOverride?: boolean;
};

const EMPTY_STATS = (): ConvergenceStats => ({
  inserted: 0,
  updated: 0,
  skipped: 0,
  skipped_user_override: 0,
});

export function entityFingerprint(manuscriptId: string, kind: string, title: string): string {
  const payload = `${manuscriptId}|${kind}|${synopsisFingerprint(title)}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 20);
}

export function plotBeatFingerprint(manuscriptId: string, synopsis: string, order: number): string {
  const payload = `${manuscriptId}|plot_point|${order}|${synopsisFingerprint(synopsis).slice(0, 120)}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 20);
}

function bump(stats: ConvergenceStats, result: ConvergeResult): void {
  if (result.userOverride) {
    stats.skipped_user_override += 1;
    stats.skipped += 1;
    return;
  }
  stats[result.action] += 1;
}

function mergeStats(into: ConvergenceStats, from: ConvergenceStats): void {
  into.inserted += from.inserted;
  into.updated += from.updated;
  into.skipped += from.skipped;
  into.skipped_user_override += from.skipped_user_override;
}

function resolveKind(entry: ProposedWikiEntry): string {
  return String(entry.wiki_metadata?.outline_entity_kind ?? entry.chunk_type ?? "note").trim();
}

function resolveChunkType(entry: ProposedWikiEntry): "lore" | "plot" | "character" {
  const ct = entry.chunk_type?.toLowerCase() ?? "";
  if (ct === "plot" || ct === "event") return "plot";
  if (ct === "character") return "character";
  return "lore";
}

function readExistingMeta(existing: { metadata?: unknown }): Record<string, unknown> {
  return existing.metadata && typeof existing.metadata === "object"
    ? (existing.metadata as Record<string, unknown>)
    : {};
}

export async function convergeUpsertWikiEntry(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    manuscriptId: string;
    entry: ProposedWikiEntry;
    extraMeta?: Record<string, unknown>;
    sourcePrefix?: string;
  }
): Promise<ConvergeResult> {
  const excerpt = params.entry.excerpt.trim();
  if (excerpt.length < 20) return { action: "skipped" };

  const kind = resolveKind(params.entry);
  const fp = entityFingerprint(params.manuscriptId, kind, params.entry.title);
  const sourceDocument = `${params.sourcePrefix ?? "wiki-entity"}/${params.manuscriptId}/${fp}`;

  const { data: existing } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, content, metadata, is_deleted")
    .eq("tenant_id", params.tenantId)
    .eq("source_document", sourceDocument)
    .maybeSingle();

  if (existing?.id) {
    if ((existing as { is_deleted?: boolean }).is_deleted === true) {
      return { action: "skipped" };
    }
    const prevMeta = readExistingMeta(existing);
    if (isUserOverrideChunk(prevMeta)) {
      return { action: "skipped", id: String(existing.id), userOverride: true };
    }
    const prev = String((existing as { content?: string }).content ?? "");
    if (areNearDuplicateTexts(prev, excerpt)) {
      return { action: "skipped", id: String(existing.id) };
    }
    const { embedding, embedding_degraded } = await embedWikiExcerptForIngest(excerpt);
    const meta = {
      ...prevMeta,
      ...params.entry.wiki_metadata,
      proposed_chunk_title: params.entry.title,
      outline_entity_kind: kind,
      entity_fingerprint: fp,
      manuscript_id: params.manuscriptId,
      wiki_author_entry: true,
      lore_extraction: true,
      ...(params.extraMeta ?? {}),
      ...(embedding_degraded ? { embedding_degraded: true } : {}),
    };
    const { error } = await supabase
      .from("p4_narrative_library_chunks")
      .update({
        content: excerpt,
        word_count: excerpt.split(/\s+/).filter(Boolean).length,
        embedding,
        metadata: meta,
      })
      .eq("id", existing.id);
    if (error) {
      console.warn("[ingestConverge] wiki update", error.message, params.entry.title);
      return { action: "skipped" };
    }
    return { action: "updated", id: String(existing.id) };
  }

  const { embedding, embedding_degraded } = await embedWikiExcerptForIngest(excerpt);
  const meta = {
    ...params.entry.wiki_metadata,
    proposed_chunk_title: params.entry.title,
    outline_entity_kind: kind,
    entity_fingerprint: fp,
    manuscript_id: params.manuscriptId,
    wiki_author_entry: true,
    lore_extraction: true,
    ...(params.extraMeta ?? {}),
    ...(embedding_degraded ? { embedding_degraded: true } : {}),
  };
  const { data, error } = await supabase
    .from("p4_narrative_library_chunks")
    .insert({
      tenant_id: params.tenantId,
      source_document: sourceDocument,
      chunk_type: resolveChunkType(params.entry),
      chunk_index: 0,
      content: excerpt,
      word_count: excerpt.split(/\s+/).filter(Boolean).length,
      embedding,
      metadata: meta,
      is_deleted: false,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[ingestConverge] wiki insert", error.message, params.entry.title);
    return { action: "skipped" };
  }
  return { action: "inserted", id: data?.id ? String(data.id) : undefined };
}

export async function convergeUpsertPlotBeatRow(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    manuscriptId: string;
    synopsis: string;
    order: number;
    metadata: Record<string, unknown>;
    sourcePrefix?: string;
  }
): Promise<ConvergeResult> {
  const excerpt = params.synopsis.trim();
  if (excerpt.length < 20) return { action: "skipped" };

  const fp = plotBeatFingerprint(params.manuscriptId, excerpt, params.order);
  const sourceDocument = `${params.sourcePrefix ?? "plot-beat"}/${params.manuscriptId}/${fp}`;

  const { data: existing } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, content, metadata, is_deleted")
    .eq("tenant_id", params.tenantId)
    .eq("source_document", sourceDocument)
    .maybeSingle();

  if (existing?.id) {
    if ((existing as { is_deleted?: boolean }).is_deleted === true) {
      return { action: "skipped" };
    }
    const prevMeta = readExistingMeta(existing);
    if (isUserOverrideChunk(prevMeta)) {
      return { action: "skipped", id: String(existing.id), userOverride: true };
    }
    const prev = String((existing as { content?: string }).content ?? "");
    if (areNearDuplicateTexts(prev, excerpt)) {
      return { action: "skipped", id: String(existing.id) };
    }
    const { embedding, embedding_degraded } = await embedWikiExcerptForIngest(excerpt);
    const meta = {
      ...prevMeta,
      ...params.metadata,
      entity_fingerprint: fp,
      manuscript_id: params.manuscriptId,
      ...(embedding_degraded ? { embedding_degraded: true } : {}),
    };
    const { error } = await supabase
      .from("p4_narrative_library_chunks")
      .update({
        content: excerpt,
        word_count: excerpt.split(/\s+/).filter(Boolean).length,
        embedding,
        metadata: meta,
      })
      .eq("id", existing.id);
    if (error) {
      console.warn("[ingestConverge] plot update", error.message);
      return { action: "skipped" };
    }
    return { action: "updated", id: String(existing.id) };
  }

  const { embedding, embedding_degraded } = await embedWikiExcerptForIngest(excerpt);
  const meta = {
    ...params.metadata,
    entity_fingerprint: fp,
    manuscript_id: params.manuscriptId,
    ...(embedding_degraded ? { embedding_degraded: true } : {}),
  };
  const { data, error } = await supabase
    .from("p4_narrative_library_chunks")
    .insert({
      tenant_id: params.tenantId,
      source_document: sourceDocument,
      chunk_type: "plot",
      chunk_index: params.order,
      content: excerpt,
      word_count: excerpt.split(/\s+/).filter(Boolean).length,
      embedding,
      metadata: meta,
      is_deleted: false,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[ingestConverge] plot insert", error.message);
    return { action: "skipped" };
  }
  return { action: "inserted", id: data?.id ? String(data.id) : undefined };
}

export async function convergeUpsertWikiEntries(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    manuscriptId: string;
    entries: ProposedWikiEntry[];
    extraMeta?: Record<string, unknown>;
    sourcePrefix?: string;
  }
): Promise<{ stats: ConvergenceStats; chunkIds: string[] }> {
  const stats = EMPTY_STATS();
  const chunkIds: string[] = [];
  for (const entry of params.entries) {
    const result = await convergeUpsertWikiEntry(supabase, {
      tenantId: params.tenantId,
      manuscriptId: params.manuscriptId,
      entry,
      extraMeta: params.extraMeta,
      sourcePrefix: params.sourcePrefix,
    });
    bump(stats, result);
    if (result.id) chunkIds.push(result.id);
  }
  return { stats, chunkIds };
}

export async function convergeUpsertPlotBeats(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    manuscriptId: string;
    beats: Array<{ synopsis: string; order: number; metadata: Record<string, unknown> }>;
    sourcePrefix?: string;
  }
): Promise<ConvergenceStats> {
  const stats = EMPTY_STATS();
  for (const beat of params.beats) {
    const result = await convergeUpsertPlotBeatRow(supabase, {
      tenantId: params.tenantId,
      manuscriptId: params.manuscriptId,
      synopsis: beat.synopsis,
      order: beat.order,
      metadata: beat.metadata,
      sourcePrefix: params.sourcePrefix,
    });
    bump(stats, result);
  }
  return stats;
}

export function addConvergenceStats(a: ConvergenceStats, b: ConvergenceStats): ConvergenceStats {
  const out = EMPTY_STATS();
  mergeStats(out, a);
  mergeStats(out, b);
  return out;
}
