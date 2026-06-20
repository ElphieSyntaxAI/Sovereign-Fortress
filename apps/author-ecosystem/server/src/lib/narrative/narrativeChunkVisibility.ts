/** Soft-exclusion and curated-entry guards for p4_narrative_library_chunks. */

export function isRagExcluded(meta: Record<string, unknown>): boolean {
  if (String(meta.rag_excluded_at ?? "").trim()) return true;
  const feedback = meta.chunk_feedback;
  if (feedback && typeof feedback === "object" && !Array.isArray(feedback)) {
    const reported = (feedback as Record<string, unknown>).reported;
    if (reported === true || reported === "true") return true;
  }
  if (String(meta.wiki_scrapped_at ?? "").trim()) return true;
  return false;
}

/** Curated wiki / entity rows — never auto-excluded by bulk cleanup. */
export function isProtectedCuratedEntry(meta: Record<string, unknown>): boolean {
  if (meta.wiki_author_entry === true) return true;
  if (meta.lore_extraction === true && String(meta.proposed_chunk_title ?? "").trim()) return true;
  if (meta.scene_card === true && meta.wiki_author_entry !== false) return true;
  return false;
}

/** Bulk RAG shard eligible for author report/restore. */
export function isBulkRagShard(meta: Record<string, unknown>): boolean {
  if (isProtectedCuratedEntry(meta)) return false;
  if (meta.rag_index === true) return true;
  if (meta.planning_session_sync === true && !meta.wiki_author_entry) return true;
  if (meta.file_import === true && meta.wiki_author_entry !== true) return true;
  return false;
}
