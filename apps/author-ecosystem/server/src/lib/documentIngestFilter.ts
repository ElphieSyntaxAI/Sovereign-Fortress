import type { ProposedWikiEntry } from "./documentIngestGate.js";
import { synopsisFingerprint } from "./documentIngestCompile.js";
import type { IngestPlotBeat } from "./documentIngestOutline.js";

const PLACEHOLDER_TITLE_RE =
  /^(?:plot beat|scene|item|outline beat|untitled|chapter)\s*\d*$/i;

/** True when excerpt is title-only, placeholder, or too thin for a wiki row. */
export function isSubstantiveWikiExcerpt(excerpt: string, title = ""): boolean {
  const body = excerpt.replace(/\s+/g, " ").trim();
  if (body.length < 24) return false;

  const titleNorm = synopsisFingerprint(title);
  const bodyNorm = synopsisFingerprint(body);
  if (titleNorm && bodyNorm === titleNorm && body.split(/\s+/).length <= 8) return false;

  if (PLACEHOLDER_TITLE_RE.test(title.trim()) && body.split(/\s+/).length <= 12) return false;
  if (/^what happens\s*:\s*$/i.test(body)) return false;

  const meaningfulWords = bodyNorm.split(" ").filter((w) => w.length > 2);
  return meaningfulWords.length >= 4;
}

export function isSubstantivePlotBeat(beat: IngestPlotBeat): boolean {
  const synopsis = beat.synopsis.replace(/\s+/g, " ").trim();
  if (synopsis.length < 24) return false;
  if (beat.chapter_number != null) {
    const withoutHeading = synopsis
      .replace(/^(?:chapter|ch\.?)\s+\d+[^\n]*\n+/i, "")
      .trim();
    if (withoutHeading.length >= 20) return true;
    return synopsis.split(/\s+/).length >= 8;
  }
  return isSubstantiveWikiExcerpt(synopsis, beat.title ?? "");
}

/** Outline beats belong in plot outline — not duplicated as lore wiki plot_point cards. */
export function isOutlineBeatWikiDuplicate(entry: ProposedWikiEntry): boolean {
  const kind = String(entry.wiki_metadata?.outline_entity_kind ?? "").trim();
  if (kind === "chapter") return true;
  if (entry.wiki_metadata?.scene_card === true) return true;
  if (kind === "plot_point" && entry.tags?.includes("file_import")) return true;
  return false;
}

export function filterProposedWikiForCommit(entries: ProposedWikiEntry[]): ProposedWikiEntry[] {
  return entries.filter((entry) => {
    if (isOutlineBeatWikiDuplicate(entry)) return false;
    const kind = String(entry.wiki_metadata?.outline_entity_kind ?? entry.chunk_type ?? "");
    if (kind === "plot_point" || kind === "chapter") return false;
    return isSubstantiveWikiExcerpt(entry.excerpt, entry.title);
  });
}

export function filterOutlineBeatsForCommit(beats: IngestPlotBeat[]): IngestPlotBeat[] {
  return beats.filter(isSubstantivePlotBeat);
}

export function wikiBodyLooksEmpty(content: string): boolean {
  const lines = content.split("\n");
  const body = lines
    .filter(
      (l) =>
        !l.startsWith("# ") &&
        !l.startsWith("## ") &&
        !l.startsWith("**chunk_type:") &&
        !l.startsWith("**tags:")
    )
    .join("\n")
    .trim();
  return body.length < 20;
}
