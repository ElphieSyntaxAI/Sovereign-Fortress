/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import type { DocumentCompilerStructuralSignals } from "./types";

export function buildDocumentCompilerStructuralSignals(text: string): DocumentCompilerStructuralSignals {
  const tabRows = (text.match(/^[^\n]*\t[^\n\t]+\t/gm) ?? []).length;
  const markdownTableRows = (text.match(/^\|.+\|$/gm) ?? []).filter(
    (l) => !/^\|\s*-+\s*\|/.test(l)
  ).length;
  const sectionCount = (text.match(/^#{1,3}\s+\S/mg) ?? []).length;
  const hasChapterHeadings = /^(chapter|part)\s+\d+/im.test(text);
  const hasSceneGrid = /^\s*\d+\.\s+\S/m.test(text) && tabRows >= 2;
  const tableBeatEstimate = Math.max(tabRows, markdownTableRows);

  const parts: string[] = [];
  if (tabRows > 0) parts.push(`${tabRows} tab-separated rows`);
  if (markdownTableRows > 0) parts.push(`${markdownTableRows} markdown table rows`);
  if (sectionCount > 0) parts.push(`${sectionCount} heading sections`);
  if (hasChapterHeadings) parts.push("chapter headings detected");
  if (hasSceneGrid) parts.push("scene grid pattern");

  return {
    tab_count: tabRows,
    section_count: sectionCount,
    markdown_table_rows: markdownTableRows,
    table_beat_estimate: tableBeatEstimate,
    has_chapter_headings: hasChapterHeadings,
    has_scene_grid: hasSceneGrid,
    summary: parts.length ? parts.join("; ") : "prose document",
  };
}

export function formatSignalsForConvergePrompt(signals: DocumentCompilerStructuralSignals): string {
  return [
    `Structural signals: ${signals.summary}`,
    `tab_rows=${signals.tab_count} markdown_table_rows=${signals.markdown_table_rows}`,
    `table_beat_estimate=${signals.table_beat_estimate}`,
    signals.has_chapter_headings ? "Preserve chapter boundaries." : "",
    signals.has_scene_grid ? "Preserve scene grid row boundaries (one row → one beat when appropriate)." : "",
    signals.tab_count >= 3 ? "Tabular rows should map to distinct beats/entities — do not merge into one blob." : "",
  ]
    .filter(Boolean)
    .join("\n");
}
