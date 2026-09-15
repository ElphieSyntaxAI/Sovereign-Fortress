/**
 * Lore Merges — Git MR-style conflict queue for wiki facts.
 * Stored as p4_narrative_library_chunks with metadata.ledger = "lore_merge" (no new table required).
 */

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { areNearDuplicateTexts, synopsisFingerprint } from "./documentIngestCompile.js";
import { entityFingerprint } from "./ingestConverge.js";
import {
  formatWikiProvenanceRef,
  readWikiProvenance,
  type WikiProvenance,
  withProvenanceMeta,
} from "./wikiProvenance.js";

export type LoreMergeReason = "same_entity" | "similar_entity" | "continuity_conflict";

export type LoreMergeStatus =
  | "open"
  | "merged"
  | "kept_base"
  | "accepted_incoming"
  | "dismissed";

export type LoreMergeSide = {
  chunk_id?: string;
  title: string;
  excerpt: string;
  chunk_type?: string;
  outline_entity_kind?: string;
  semantic_domain?: string;
  provenance?: WikiProvenance | null;
  ref_label?: string;
};

export type LoreMergeRecord = {
  id: string;
  tenant_id: string;
  manuscript_id: string;
  status: LoreMergeStatus;
  reason: LoreMergeReason;
  base: LoreMergeSide;
  incoming: LoreMergeSide;
  continuity_note?: string;
  notification_unread: boolean;
  created_at: string;
  resolved_at?: string | null;
  resolution_note?: string | null;
};

type WikiChunkRow = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  source_document?: string;
};

function mergeSourceDocument(manuscriptId: string, mergeId: string): string {
  return `lore-merge/${manuscriptId}/${mergeId}`;
}

function titleTokens(title: string): Set<string> {
  return new Set(
    synopsisFingerprint(title)
      .split(" ")
      .filter((w) => w.length > 2)
  );
}

function titlesSimilar(a: string, b: string): boolean {
  const fa = synopsisFingerprint(a);
  const fb = synopsisFingerprint(b);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  if (fa.includes(fb) || fb.includes(fa)) return true;
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union > 0 && inter / union >= 0.5;
}

function sideFromChunk(row: WikiChunkRow): LoreMergeSide {
  const meta = row.metadata ?? {};
  const title = String(meta.proposed_chunk_title ?? meta.title ?? "").trim() || "Wiki fact";
  const provenance = readWikiProvenance(meta);
  return {
    chunk_id: row.id,
    title,
    excerpt: String(row.content ?? "").trim(),
    chunk_type: String(row.chunk_type ?? meta.chunk_type ?? "lore"),
    outline_entity_kind: String(meta.outline_entity_kind ?? "").trim() || undefined,
    semantic_domain: String(meta.semantic_domain ?? "").trim() || undefined,
    provenance,
    ref_label: formatWikiProvenanceRef(provenance),
  };
}

function sideFromIncoming(input: {
  title: string;
  excerpt: string;
  chunk_type?: string;
  outline_entity_kind?: string;
  semantic_domain?: string;
  provenance?: WikiProvenance | null;
}): LoreMergeSide {
  return {
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    chunk_type: input.chunk_type,
    outline_entity_kind: input.outline_entity_kind,
    semantic_domain: input.semantic_domain,
    provenance: input.provenance ?? null,
    ref_label: formatWikiProvenanceRef(input.provenance ?? null),
  };
}

function parseMergeRow(row: {
  id: string;
  tenant_id?: string;
  content?: string;
  metadata?: unknown;
}): LoreMergeRecord | null {
  const meta =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  if (String(meta.ledger ?? "") !== "lore_merge") return null;
  const mergeId = String(meta.merge_id ?? row.id);
  const base = meta.base && typeof meta.base === "object" ? (meta.base as LoreMergeSide) : null;
  const incoming =
    meta.incoming && typeof meta.incoming === "object" ? (meta.incoming as LoreMergeSide) : null;
  if (!base || !incoming) return null;
  return {
    id: mergeId,
    tenant_id: String(row.tenant_id ?? meta.tenant_id ?? ""),
    manuscript_id: String(meta.manuscript_id ?? ""),
    status: (String(meta.merge_status ?? "open") as LoreMergeStatus) || "open",
    reason: (String(meta.reason ?? "same_entity") as LoreMergeReason) || "same_entity",
    base,
    incoming,
    continuity_note: meta.continuity_note != null ? String(meta.continuity_note) : undefined,
    notification_unread: meta.notification_unread !== false,
    created_at: String(meta.created_at ?? ""),
    resolved_at: meta.resolved_at != null ? String(meta.resolved_at) : null,
    resolution_note: meta.resolution_note != null ? String(meta.resolution_note) : null,
  };
}

export async function listLoreMerges(
  supabase: SupabaseClient,
  params: { tenantId: string; manuscriptId: string; status?: LoreMergeStatus | "all" }
): Promise<LoreMergeRecord[]> {
  const { data, error } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, tenant_id, content, metadata, is_deleted")
    .eq("tenant_id", params.tenantId)
    .eq("is_deleted", false)
    .like("source_document", `lore-merge/${params.manuscriptId}/%`)
    .limit(200);

  if (error) throw new Error(`listLoreMerges: ${error.message}`);

  const out: LoreMergeRecord[] = [];
  for (const row of data ?? []) {
    const rec = parseMergeRow(row as { id: string; tenant_id?: string; content?: string; metadata?: unknown });
    if (!rec) continue;
    if (params.status && params.status !== "all" && rec.status !== params.status) continue;
    out.push(rec);
  }
  out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return out;
}

export async function countOpenLoreMerges(
  supabase: SupabaseClient,
  tenantId: string,
  manuscriptId: string
): Promise<{ open: number; unread: number }> {
  const open = await listLoreMerges(supabase, {
    tenantId,
    manuscriptId,
    status: "open",
  });
  return {
    open: open.length,
    unread: open.filter((m) => m.notification_unread).length,
  };
}

export async function getLoreMerge(
  supabase: SupabaseClient,
  params: { tenantId: string; mergeId: string }
): Promise<LoreMergeRecord | null> {
  const { data, error } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, tenant_id, content, metadata, is_deleted")
    .eq("tenant_id", params.tenantId)
    .eq("is_deleted", false)
    .contains("metadata", { merge_id: params.mergeId })
    .limit(5);

  if (error) throw new Error(`getLoreMerge: ${error.message}`);
  for (const row of data ?? []) {
    const rec = parseMergeRow(row as { id: string; tenant_id?: string; content?: string; metadata?: unknown });
    if (rec?.id === params.mergeId) return rec;
  }
  // Fallback: scan by source_document suffix
  const { data: bySrc } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, tenant_id, content, metadata, is_deleted")
    .eq("tenant_id", params.tenantId)
    .like("source_document", `%/${params.mergeId}`)
    .limit(5);
  for (const row of bySrc ?? []) {
    const rec = parseMergeRow(row as { id: string; tenant_id?: string; content?: string; metadata?: unknown });
    if (rec) return rec;
  }
  return null;
}

/** Find an existing settled wiki row that conflicts with the incoming fact. */
export async function findConflictingWikiBase(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    manuscriptId: string;
    title: string;
    excerpt: string;
    outline_entity_kind?: string;
  }
): Promise<{ row: WikiChunkRow; reason: LoreMergeReason } | null> {
  const kind = String(params.outline_entity_kind ?? "note").trim() || "note";
  const fp = entityFingerprint(params.manuscriptId, kind, params.title);

  const { data: byFp } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, content, metadata, source_document, is_deleted")
    .eq("tenant_id", params.tenantId)
    .eq("is_deleted", false)
    .contains("metadata", { entity_fingerprint: fp, manuscript_id: params.manuscriptId })
    .limit(5);

  const candidates: WikiChunkRow[] = [];
  for (const row of byFp ?? []) {
    const meta = (row.metadata && typeof row.metadata === "object"
      ? row.metadata
      : {}) as Record<string, unknown>;
    if (String(meta.ledger ?? "") === "lore_merge") continue;
    if (meta.merge_pending === true) continue;
    if (String(meta.ledger ?? "") !== "wiki_snapshot" && meta.wiki_author_entry !== true) continue;
    candidates.push({
      id: String(row.id),
      content: String(row.content ?? ""),
      metadata: meta,
      source_document: row.source_document != null ? String(row.source_document) : undefined,
    });
  }

  if (candidates.length === 0) {
    const { data: wikiRows } = await supabase
      .from("p4_narrative_library_chunks")
      .select("id, content, metadata, source_document, is_deleted")
      .eq("tenant_id", params.tenantId)
      .eq("is_deleted", false)
      .contains("metadata", { manuscript_id: params.manuscriptId, ledger: "wiki_snapshot" })
      .limit(400);

    for (const row of wikiRows ?? []) {
      const meta = (row.metadata && typeof row.metadata === "object"
        ? row.metadata
        : {}) as Record<string, unknown>;
      if (meta.merge_pending === true) continue;
      const title = String(meta.proposed_chunk_title ?? "").trim();
      if (!title || !titlesSimilar(title, params.title)) continue;
      candidates.push({
        id: String(row.id),
        content: String(row.content ?? ""),
        metadata: meta,
        source_document: row.source_document != null ? String(row.source_document) : undefined,
      });
    }
  }

  for (const row of candidates) {
    const existingExcerpt = String(row.content ?? "").trim();
    if (!existingExcerpt) continue;
    if (areNearDuplicateTexts(existingExcerpt, params.excerpt)) {
      return null; // reinforce / same — not a conflict
    }
    const title = String(row.metadata.proposed_chunk_title ?? "").trim();
    const reason: LoreMergeReason =
      synopsisFingerprint(title) === synopsisFingerprint(params.title)
        ? "same_entity"
        : "similar_entity";
    return { row, reason };
  }
  return null;
}

export async function openLoreMerge(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    manuscriptId: string;
    base: WikiChunkRow;
    incoming: {
      title: string;
      excerpt: string;
      chunk_type?: string;
      outline_entity_kind?: string;
      semantic_domain?: string;
      provenance?: WikiProvenance | null;
    };
    reason: LoreMergeReason;
    continuityNote?: string;
  }
): Promise<LoreMergeRecord> {
  const mergeId = randomUUID();
  const created_at = new Date().toISOString();
  const base = sideFromChunk(params.base);
  const incoming = sideFromIncoming(params.incoming);
  const content = [
    `LORE MERGE (open): ${incoming.title}`,
    `Base Ref: ${base.ref_label}`,
    `Incoming Ref: ${incoming.ref_label}`,
    `Reason: ${params.reason}`,
    params.continuityNote ? `Note: ${params.continuityNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const metadata = {
    ledger: "lore_merge",
    merge_id: mergeId,
    merge_status: "open" as LoreMergeStatus,
    reason: params.reason,
    manuscript_id: params.manuscriptId,
    tenant_id: params.tenantId,
    base,
    incoming,
    continuity_note: params.continuityNote ?? null,
    notification_unread: true,
    created_at,
    wiki_visibility: "draft",
    merge_pending: true,
  };

  const embedding = new Array(1536).fill(0);
  const { error } = await supabase.from("p4_narrative_library_chunks").insert({
    tenant_id: params.tenantId,
    source_document: mergeSourceDocument(params.manuscriptId, mergeId),
    chunk_type: "lore",
    chunk_index: 0,
    content,
    word_count: content.split(/\s+/).filter(Boolean).length,
    embedding,
    metadata,
    is_deleted: false,
  });

  if (error) throw new Error(`openLoreMerge: ${error.message}`);

  return {
    id: mergeId,
    tenant_id: params.tenantId,
    manuscript_id: params.manuscriptId,
    status: "open",
    reason: params.reason,
    base,
    incoming,
    continuity_note: params.continuityNote,
    notification_unread: true,
    created_at,
  };
}

/**
 * If incoming conflicts with existing wiki, open a lore merge and return it.
 * If near-duplicate / no base, return null (caller may upsert normally).
 */
export async function openLoreMergeIfConflict(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    manuscriptId: string;
    title: string;
    excerpt: string;
    chunk_type?: string;
    outline_entity_kind?: string;
    semantic_domain?: string;
    provenance?: WikiProvenance | null;
    continuityNote?: string;
    forceReason?: LoreMergeReason;
  }
): Promise<LoreMergeRecord | null> {
  const hit = await findConflictingWikiBase(supabase, {
    tenantId: params.tenantId,
    manuscriptId: params.manuscriptId,
    title: params.title,
    excerpt: params.excerpt,
    outline_entity_kind: params.outline_entity_kind,
  });
  if (!hit && !params.forceReason) return null;
  if (!hit) return null;

  return openLoreMerge(supabase, {
    tenantId: params.tenantId,
    manuscriptId: params.manuscriptId,
    base: hit.row,
    incoming: {
      title: params.title,
      excerpt: params.excerpt,
      chunk_type: params.chunk_type,
      outline_entity_kind: params.outline_entity_kind,
      semantic_domain: params.semantic_domain,
      provenance: params.provenance,
    },
    reason: params.forceReason ?? hit.reason,
    continuityNote: params.continuityNote,
  });
}

export async function resolveLoreMerge(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    mergeId: string;
    action: "keep_base" | "accept_incoming" | "edit_merge" | "dismiss";
    edited?: { title?: string; excerpt?: string };
    note?: string;
  }
): Promise<LoreMergeRecord> {
  const rec = await getLoreMerge(supabase, {
    tenantId: params.tenantId,
    mergeId: params.mergeId,
  });
  if (!rec) throw new Error("Lore merge not found");
  if (rec.status !== "open") throw new Error(`Lore merge already ${rec.status}`);

  const resolved_at = new Date().toISOString();
  let status: LoreMergeStatus = "dismissed";

  if (params.action === "keep_base") {
    status = "kept_base";
  } else if (params.action === "dismiss") {
    status = "dismissed";
  } else if (params.action === "accept_incoming" || params.action === "edit_merge") {
    status = params.action === "edit_merge" ? "merged" : "accepted_incoming";
    const title =
      params.action === "edit_merge" && params.edited?.title?.trim()
        ? params.edited.title.trim()
        : rec.incoming.title;
    const excerpt =
      params.action === "edit_merge" && params.edited?.excerpt?.trim()
        ? params.edited.excerpt.trim()
        : rec.incoming.excerpt;
    if (excerpt.length < 20) throw new Error("excerpt must be at least 20 characters");

    const baseId = rec.base.chunk_id;
    const provenance = withProvenanceMeta(
      {
        ledger: "wiki_snapshot",
        manuscript_id: rec.manuscript_id,
        proposed_chunk_title: title,
        outline_entity_kind: rec.incoming.outline_entity_kind ?? rec.base.outline_entity_kind,
        semantic_domain: rec.incoming.semantic_domain ?? rec.base.semantic_domain,
        wiki_author_entry: true,
        lore_extraction: true,
        wiki_visibility: "draft",
        entity_fingerprint: entityFingerprint(
          rec.manuscript_id,
          String(rec.incoming.outline_entity_kind ?? rec.base.outline_entity_kind ?? "note"),
          title
        ),
      },
      {
        ...(rec.incoming.provenance ?? {
          source: "live_manuscript" as const,
          channel: "lore_merge" as const,
          manuscript_id: rec.manuscript_id,
          captured_at: resolved_at,
        }),
        resolved_via: "lore_merge",
        channel: "lore_merge",
        captured_at: rec.incoming.provenance?.captured_at ?? resolved_at,
      }
    );

    if (baseId) {
      const { error } = await supabase
        .from("p4_narrative_library_chunks")
        .update({
          content: excerpt,
          word_count: excerpt.split(/\s+/).filter(Boolean).length,
          metadata: provenance,
        })
        .eq("id", baseId)
        .eq("tenant_id", params.tenantId);
      if (error) throw new Error(`resolveLoreMerge update base: ${error.message}`);
    } else {
      const src = `wiki-entity/${rec.manuscript_id}/${createHash("sha256")
        .update(`${rec.manuscript_id}|${title}`)
        .digest("hex")
        .slice(0, 20)}`;
      const embedding = new Array(1536).fill(0);
      const { error } = await supabase.from("p4_narrative_library_chunks").insert({
        tenant_id: params.tenantId,
        source_document: src,
        chunk_type: "lore",
        chunk_index: 0,
        content: excerpt,
        word_count: excerpt.split(/\s+/).filter(Boolean).length,
        embedding,
        metadata: provenance,
        is_deleted: false,
      });
      if (error) throw new Error(`resolveLoreMerge insert: ${error.message}`);
    }
  }

  const { data: rows } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, metadata")
    .eq("tenant_id", params.tenantId)
    .like("source_document", `lore-merge/${rec.manuscript_id}/${params.mergeId}`)
    .limit(1);

  const row = rows?.[0];
  if (row?.id) {
    const prev =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    await supabase
      .from("p4_narrative_library_chunks")
      .update({
        metadata: {
          ...prev,
          merge_status: status,
          notification_unread: false,
          resolved_at,
          resolution_note: params.note ?? null,
          merge_pending: false,
        },
      })
      .eq("id", row.id);
  }

  return {
    ...rec,
    status,
    notification_unread: false,
    resolved_at,
    resolution_note: params.note ?? null,
  };
}

export async function markLoreMergeNotificationsRead(
  supabase: SupabaseClient,
  params: { tenantId: string; manuscriptId: string }
): Promise<number> {
  const open = await listLoreMerges(supabase, {
    tenantId: params.tenantId,
    manuscriptId: params.manuscriptId,
    status: "open",
  });
  let n = 0;
  for (const m of open) {
    if (!m.notification_unread) continue;
    const { data: rows } = await supabase
      .from("p4_narrative_library_chunks")
      .select("id, metadata")
      .eq("tenant_id", params.tenantId)
      .eq("source_document", mergeSourceDocument(params.manuscriptId, m.id))
      .limit(1);
    const row = rows?.[0];
    if (!row?.id) continue;
    const prev =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    await supabase
      .from("p4_narrative_library_chunks")
      .update({ metadata: { ...prev, notification_unread: false } })
      .eq("id", row.id);
    n += 1;
  }
  return n;
}
