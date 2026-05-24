import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hard-lock wiki lore for a manuscript after the author confirms Finished revisions.
 */
export async function lockWikiForManuscriptRevision(
  supabase: SupabaseClient,
  tenantId: string,
  manuscriptId: string
): Promise<{ chunks_updated: number }> {
  const { data: rows, error: readErr } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .eq("chunk_type", "lore");

  if (readErr) throw new Error(readErr.message);

  const now = new Date().toISOString();
  let updated = 0;

  for (const row of rows ?? []) {
    const meta = (row.metadata && typeof row.metadata === "object"
      ? row.metadata
      : {}) as Record<string, unknown>;
    const src = String(meta.source_document ?? meta.manuscript_id ?? "");
    const matchesManuscript =
      String(meta.manuscript_id ?? "") === manuscriptId ||
      src.includes(manuscriptId) ||
      String(meta.project_id ?? "") === manuscriptId;

    if (!matchesManuscript && rows!.length > 20) {
      continue;
    }
    if (!matchesManuscript) continue;

    const nextMeta = {
      ...meta,
      ledger: meta.ledger ?? "wiki_snapshot",
      wiki_hard_locked: true,
      wiki_visibility: "canon",
      wiki_revision_locked_at: now,
      wiki_published_at: meta.wiki_published_at ?? now,
    };

    const { error } = await supabase
      .from("p4_narrative_library_chunks")
      .update({ metadata: nextMeta })
      .eq("id", row.id);

    if (!error) updated += 1;
  }

  if (updated === 0 && (rows?.length ?? 0) > 0) {
    for (const row of rows ?? []) {
      const meta = (row.metadata && typeof row.metadata === "object"
        ? row.metadata
        : {}) as Record<string, unknown>;
      const nextMeta = {
        ...meta,
        wiki_hard_locked: true,
        wiki_revision_locked_at: now,
        manuscript_id: manuscriptId,
      };
      const { error } = await supabase
        .from("p4_narrative_library_chunks")
        .update({ metadata: nextMeta })
        .eq("id", row.id);
      if (!error) updated += 1;
    }
  }

  return { chunks_updated: updated };
}
