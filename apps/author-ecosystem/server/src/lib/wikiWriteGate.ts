/**
 * Wiki write gate: direct upsert or open Lore Merge on conflict.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProposedWikiEntry } from "./documentIngestGate.js";
import { convergeUpsertWikiEntry, type ConvergeResult } from "./ingestConverge.js";
import {
  openLoreMergeIfConflict,
  type LoreMergeRecord,
} from "./wikiLoreMerges.js";
import {
  buildWikiProvenance,
  readWikiProvenance,
  type WikiProvenance,
  withProvenanceMeta,
} from "./wikiProvenance.js";

export type WikiWriteGateResult =
  | { kind: "upserted"; result: ConvergeResult }
  | { kind: "merge_opened"; merge: LoreMergeRecord };

export async function writeWikiEntryWithMergeGate(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    manuscriptId: string;
    entry: ProposedWikiEntry;
    provenance: WikiProvenance;
    extraMeta?: Record<string, unknown>;
    sourcePrefix?: string;
    continuityNote?: string;
    /** When continuity already flagged conflict, force merge if base exists. */
    preferMergeOnConflictFlag?: boolean;
  }
): Promise<WikiWriteGateResult> {
  const kind = String(
    params.entry.wiki_metadata?.outline_entity_kind ?? params.entry.chunk_type ?? "note"
  );
  const stamped: ProposedWikiEntry = {
    ...params.entry,
    wiki_metadata: withProvenanceMeta(
      {
        ...(params.entry.wiki_metadata ?? {}),
        manuscript_id: params.manuscriptId,
        wiki_author_entry: true,
        lore_extraction: true,
        ledger: "wiki_snapshot",
        wiki_visibility: "draft",
        ...(params.extraMeta ?? {}),
      },
      params.provenance
    ),
  };

  const merge = await openLoreMergeIfConflict(supabase, {
    tenantId: params.tenantId,
    manuscriptId: params.manuscriptId,
    title: stamped.title,
    excerpt: stamped.excerpt,
    chunk_type: stamped.chunk_type,
    outline_entity_kind: kind,
    semantic_domain:
      stamped.wiki_metadata?.semantic_domain != null
        ? String(stamped.wiki_metadata.semantic_domain)
        : undefined,
    provenance: params.provenance,
    continuityNote: params.continuityNote,
    forceReason: params.preferMergeOnConflictFlag ? "continuity_conflict" : undefined,
  });

  if (merge) {
    return { kind: "merge_opened", merge };
  }

  const result = await convergeUpsertWikiEntry(supabase, {
    tenantId: params.tenantId,
    manuscriptId: params.manuscriptId,
    entry: stamped,
    extraMeta: params.extraMeta,
    sourcePrefix: params.sourcePrefix ?? "wiki-entity",
  });
  return { kind: "upserted", result };
}

export function provenanceForIngestSlot(
  manuscriptId: string,
  slot: string,
  filename?: string
): WikiProvenance {
  return buildWikiProvenance({
    source: "planning_upload",
    channel: "document_ingest",
    manuscriptId,
    ingestSlot: slot,
    docTitle: filename,
  });
}

export function provenanceForManual(manuscriptId: string): WikiProvenance {
  return buildWikiProvenance({
    source: "planning_manual",
    channel: "planning_ui",
    manuscriptId,
  });
}

export function provenanceFromMetaOr(
  meta: Record<string, unknown>,
  fallback: WikiProvenance
): WikiProvenance {
  return readWikiProvenance(meta) ?? fallback;
}
