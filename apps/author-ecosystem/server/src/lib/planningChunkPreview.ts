/** Human-readable labels for author planning dashboards (Outline / DashboardRouter). */

export type PlanningChunkRow = {
  id: string;
  chunk_type: string;
  source_document: string;
  chunk_index: number;
  word_count: number;
  excerpt: string;
  title: string;
  kind: string;
  ledger: string | null;
  plot_point_order?: number | null;
};

export function excerptText(text: string, max = 420): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function titleFromWikiSnapshotContent(content: string): string | null {
  const m = content.match(/^##\s+(.+)$/m);
  return m?.[1]?.trim() || null;
}

export function bodyFromWikiSnapshotContent(content: string): string {
  const lines = content.split("\n");
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.startsWith("## ")) bodyStart = i + 1;
    if (lines[i]?.trim() === "" && bodyStart > 0) {
      bodyStart = i + 1;
      break;
    }
  }
  const body = lines
    .slice(bodyStart)
    .filter((l) => !l.startsWith("**chunk_type:") && !l.startsWith("**tags:"))
    .join("\n")
    .trim();
  return body || content.trim();
}

export function planningChunkTitle(
  meta: Record<string, unknown>,
  content: string
): string {
  const fromMeta = String(
    meta.proposed_chunk_title ?? meta.beat_title ?? meta.tab_title ?? ""
  ).trim();
  if (fromMeta) return fromMeta;
  const fromBody = titleFromWikiSnapshotContent(content);
  if (fromBody) return fromBody;
  const first = content.split("\n").find((l) => l.trim().length > 2)?.trim();
  return first?.slice(0, 100) || "Untitled section";
}

export function isAuthorLoreChunk(meta: Record<string, unknown>, sourceDoc: string): boolean {
  if (String(meta.ledger ?? "") === "wiki_snapshot") {
    if (meta.scene_card === true && meta.file_import === true) return false;
    if (meta.wiki_author_entry === true || meta.lore_extraction === true) return true;
    if (String(meta.proposed_chunk_title ?? "").trim()) return true;
  }
  if (sourceDoc.startsWith("file-import-wiki/")) return true;
  if (sourceDoc.startsWith("wiki-entry/")) return true;
  return false;
}

/** Plot sandbox / outline beats — not encyclopedia rows stored as plot type. */
export function isAuthorOutlinePlotChunk(
  meta: Record<string, unknown>,
  sourceDoc: string
): boolean {
  const src = sourceDoc.trim();
  if (src.startsWith("wiki-entry/")) return false;
  if (src.startsWith("file-import-wiki/")) return false;
  if (meta.lore_extraction === true && meta.scene_card !== true) return false;
  if (meta.wiki_author_entry === true && meta.scene_card !== true) return false;
  if (meta.scene_card === true) return true;
  if (meta.is_outline === true || meta.outline === true) return true;
  if (src.startsWith("file-import-plot-beat/")) return true;
  if (src.includes("file_import_outline")) return true;
  return false;
}
