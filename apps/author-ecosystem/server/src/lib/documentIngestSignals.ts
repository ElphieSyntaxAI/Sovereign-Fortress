/**
 * Structural signals for MSGF document ingest (SWEEP phase).
 * Generic heuristics — not tied to a single author's doc layout.
 */

import { matchKeywordHintsInText, loadDocumentIngestKeywords } from "./documentIngestKeywords.js";
import { extractBeatsFromTables } from "./documentIngestOutline.js";
import { detectContentSignals, type ContentSignal } from "./documentIngestStructure.js";

export type DocumentIngestStructuralSignals = {
  tab_count: number;
  section_count: number;
  markdown_table_rows: number;
  tab_separated_rows: number;
  table_beat_estimate: number;
  has_chapter_headings: boolean;
  has_scene_grid: boolean;
  content_signals: ContentSignal[];
  keyword_hits: string[];
  summary: string;
};

export function buildDocumentIngestSignals(text: string): DocumentIngestStructuralSignals {
  const sample = text.slice(0, 96_000);
  const tab_count = (sample.match(/^---\s*TAB:/gim) ?? []).length;
  const section_count = (sample.match(/^---\s*SECTION\s*---/gim) ?? []).length;
  const markdown_table_rows = (sample.match(/^\|.+\|$/gm) ?? []).filter(
    (l) => !/^\|\s*-+\s*\|/.test(l)
  ).length;
  const tab_separated_rows = (sample.match(/^[^\n]*\t[^\n\t]+\t/gm) ?? []).length;
  const table_beat_estimate = extractBeatsFromTables(sample).length;
  const has_chapter_headings = /\bchapter\s+\d+\b/i.test(sample);
  const has_scene_grid =
    /\bscene\s+\d+\b/i.test(sample) || (table_beat_estimate >= 3 && markdown_table_rows >= 3);

  const keywords = loadDocumentIngestKeywords();
  const keyword_hits = matchKeywordHintsInText(sample, keywords);
  const content_signals = detectContentSignals(sample);

  const parts: string[] = [];
  if (tab_count >= 2) parts.push(`${tab_count} tabs`);
  if (section_count >= 1) parts.push(`${section_count} sections`);
  if (table_beat_estimate >= 2) parts.push(`~${table_beat_estimate} table rows`);
  if (has_chapter_headings) parts.push("chapter headings");
  if (has_scene_grid) parts.push("scene grid");
  if (keyword_hits.length) parts.push(`hints: ${keyword_hits.slice(0, 6).join(", ")}`);

  const summary =
    parts.length > 0
      ? `Structural signals: ${parts.join("; ")}.`
      : "Structural signals: prose or unstructured notes — infer wiki from content.";

  return {
    tab_count,
    section_count,
    markdown_table_rows,
    tab_separated_rows,
    table_beat_estimate,
    has_chapter_headings,
    has_scene_grid,
    content_signals,
    keyword_hits,
    summary,
  };
}

export function formatSignalsForConvergePrompt(signals: DocumentIngestStructuralSignals): string {
  return [
    signals.summary,
    `Content signals: ${signals.content_signals.map((s) => s.kind).join(", ") || "mixed"}`,
    `Tables: markdown_rows=${signals.markdown_table_rows} tab_rows=${signals.tab_separated_rows} beat_estimate=${signals.table_beat_estimate}`,
    `Tabs=${signals.tab_count} sections=${signals.section_count}`,
  ].join("\n");
}
