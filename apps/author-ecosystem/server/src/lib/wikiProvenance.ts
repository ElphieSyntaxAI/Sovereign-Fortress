/**
 * Provenance Ref for every wiki fact — where the lore came from.
 * SSOT for document ingest, planning UI, and live manuscript / chapter facts.
 */

export type WikiProvenanceSource =
  | "planning_upload"
  | "planning_manual"
  | "live_manuscript";

export type WikiProvenanceChannel =
  | "document_ingest"
  | "planning_ui"
  | "chapter_facts"
  | "author_tag"
  | "lore_merge";

export type WikiProvenance = {
  source: WikiProvenanceSource;
  channel: WikiProvenanceChannel;
  manuscript_id?: string;
  chapter_number?: number | null;
  ingest_slot?: string;
  doc_title?: string;
  captured_at: string;
  resolved_via?: "lore_merge";
  last_edited_via?: WikiProvenanceChannel;
};

export function buildWikiProvenance(input: {
  source: WikiProvenanceSource;
  channel: WikiProvenanceChannel;
  manuscriptId?: string;
  chapterNumber?: number | null;
  ingestSlot?: string;
  docTitle?: string;
  capturedAt?: string;
}): WikiProvenance {
  return {
    source: input.source,
    channel: input.channel,
    ...(input.manuscriptId ? { manuscript_id: input.manuscriptId } : {}),
    ...(input.chapterNumber != null ? { chapter_number: input.chapterNumber } : {}),
    ...(input.ingestSlot ? { ingest_slot: input.ingestSlot } : {}),
    ...(input.docTitle ? { doc_title: input.docTitle } : {}),
    captured_at: input.capturedAt ?? new Date().toISOString(),
  };
}

export function readWikiProvenance(meta: Record<string, unknown> | null | undefined): WikiProvenance | null {
  const raw = meta?.provenance;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const source = String(p.source ?? "");
  if (
    source !== "planning_upload" &&
    source !== "planning_manual" &&
    source !== "live_manuscript"
  ) {
    return null;
  }
  return {
    source,
    channel: (String(p.channel ?? "planning_ui") as WikiProvenanceChannel) || "planning_ui",
    manuscript_id: p.manuscript_id != null ? String(p.manuscript_id) : undefined,
    chapter_number:
      p.chapter_number != null && Number.isFinite(Number(p.chapter_number))
        ? Number(p.chapter_number)
        : null,
    ingest_slot: p.ingest_slot != null ? String(p.ingest_slot) : undefined,
    doc_title: p.doc_title != null ? String(p.doc_title) : undefined,
    captured_at: String(p.captured_at ?? ""),
    resolved_via: p.resolved_via === "lore_merge" ? "lore_merge" : undefined,
    last_edited_via: p.last_edited_via
      ? (String(p.last_edited_via) as WikiProvenanceChannel)
      : undefined,
  };
}

/** Human-facing Ref line for wiki UI / extension. */
export function formatWikiProvenanceRef(p: WikiProvenance | null | undefined): string {
  if (!p) return "Ref: Unknown";
  if (p.source === "planning_upload") {
    const slot = p.ingest_slot ? ` · ${p.ingest_slot}` : "";
    return `Ref: Planning upload${slot}`;
  }
  if (p.source === "planning_manual") {
    return "Ref: Planning (manual)";
  }
  const ch = p.chapter_number != null ? ` · Ch. ${p.chapter_number}` : "";
  const via = p.channel === "author_tag" ? " · tagged" : "";
  return `Ref: Live manuscript${ch}${via}`;
}

export function withProvenanceMeta(
  meta: Record<string, unknown>,
  provenance: WikiProvenance
): Record<string, unknown> {
  return { ...meta, provenance };
}

/** Preserve origin provenance on manual edit; stamp last_edited_via. */
export function mergeProvenanceOnManualEdit(
  existingMeta: Record<string, unknown>,
  channel: WikiProvenanceChannel = "planning_ui"
): WikiProvenance {
  const prev = readWikiProvenance(existingMeta);
  if (prev) {
    return { ...prev, last_edited_via: channel };
  }
  return buildWikiProvenance({
    source: "planning_manual",
    channel: "planning_ui",
    manuscriptId: existingMeta.manuscript_id != null ? String(existingMeta.manuscript_id) : undefined,
  });
}
