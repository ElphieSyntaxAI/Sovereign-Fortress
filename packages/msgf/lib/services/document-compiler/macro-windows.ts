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
import { MAX_LLM_DOCUMENT_CHARS } from "./limits";
import type { DocumentCompilerStructuralSignals, StructuralMacroWindow } from "./types";

export type ConvergeTextChunk = {
  index: number;
  total: number;
  text: string;
};

const CHAPTER_HEADING_RE = /^(?:#{1,3}\s*)?(?:chapter|ch\.?)\s+(\d+)[\s:.\-—]/im;
const SCENE_HEADING_RE = /^(?:#{1,3}\s*)?(?:scene|sc\.?)\s+(\d+)[\s:.\-—]/im;

function formatTabSectionHeader(title: string, path?: string): string {
  const label = path?.trim() ? `${path.trim()} › ${title.trim()}` : title.trim();
  return `\n\n--- TAB: ${label} ---\n\n`;
}

function splitTabSections(text: string): Array<{ title: string; path?: string; body: string }> {
  const normalized = text.replace(/^\s*---\s*TAB:\s*/i, "\n--- TAB: ");
  const parts = normalized.split(/\n---\s*TAB:\s*/i);
  if (parts.length <= 1 && !/---\s*TAB:/i.test(normalized)) return [];

  const sections: Array<{ title: string; path?: string; body: string }> = [];
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i]!;
    const nl = chunk.indexOf("\n");
    const titleLine = (nl >= 0 ? chunk.slice(0, nl) : chunk).replace(/---\s*$/i, "").trim();
    const body = (nl >= 0 ? chunk.slice(nl + 1) : "").trim();
    if (!titleLine || body.length < 4) continue;
    const pathParts = titleLine.split("›").map((s) => s.trim());
    const title = pathParts[pathParts.length - 1] ?? titleLine;
    const path = pathParts.length > 1 ? pathParts.slice(0, -1).join(" › ") : undefined;
    sections.push({ title, path, body });
  }
  return sections;
}

function splitByParagraphLimit(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];

  const paras = text.split(/\n\s*\n+/);
  const out: string[] = [];
  let buf = "";

  const flush = () => {
    const trimmed = buf.trim();
    if (trimmed.length > 0) out.push(trimmed);
    buf = "";
  };

  for (const para of paras) {
    const block = para.trim();
    if (!block) continue;
    if (block.length > limit) {
      flush();
      for (let i = 0; i < block.length; i += limit) {
        out.push(block.slice(i, i + limit));
      }
      continue;
    }
    if (buf.length + block.length + 2 > limit && buf.length > 0) {
      flush();
      buf = block;
    } else {
      buf = buf ? `${buf}\n\n${block}` : block;
    }
  }
  flush();

  return out.length > 0 ? out : [text.slice(0, limit)];
}

function findMacroSplitOffsets(
  text: string
): Array<{ offset: number; label: string; kind: StructuralMacroWindow["kind"] }> {
  const lines = text.split("\n");
  const hits: Array<{ offset: number; label: string; kind: StructuralMacroWindow["kind"] }> = [];
  let charOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (/^---\s*TAB:/i.test(trimmed)) {
      hits.push({
        offset: charOffset,
        label: trimmed.replace(/^---\s*TAB:\s*/i, "").trim(),
        kind: "tab",
      });
    } else if (/^---\s*SECTION\s*---/i.test(trimmed)) {
      hits.push({ offset: charOffset, label: `Section ${hits.length + 1}`, kind: "section" });
    } else if (CHAPTER_HEADING_RE.test(trimmed)) {
      const m = CHAPTER_HEADING_RE.exec(trimmed);
      hits.push({
        offset: charOffset,
        label: m ? `Chapter ${m[1]}` : trimmed.slice(0, 48),
        kind: "chapter",
      });
    } else if (SCENE_HEADING_RE.test(trimmed)) {
      const m = SCENE_HEADING_RE.exec(trimmed);
      hits.push({
        offset: charOffset,
        label: m ? `Scene ${m[1]}` : trimmed.slice(0, 48),
        kind: "scene",
      });
    }

    charOffset += line.length + 1;
  }

  return hits;
}

export function splitDocumentForConverge(text: string): ConvergeTextChunk[] {
  if (text.length <= MAX_LLM_DOCUMENT_CHARS) {
    return [{ index: 0, total: 1, text }];
  }

  const tabs = splitTabSections(text);
  if (tabs.length > 1) {
    const chunks: string[] = [];
    let buf = "";

    const flush = () => {
      const trimmed = buf.trim();
      if (trimmed.length > 0) chunks.push(trimmed);
      buf = "";
    };

    for (const tab of tabs) {
      const block = formatTabSectionHeader(tab.title, tab.path) + tab.body.trim();
      if (block.length > MAX_LLM_DOCUMENT_CHARS) {
        flush();
        for (const part of splitByParagraphLimit(block, MAX_LLM_DOCUMENT_CHARS)) {
          chunks.push(part);
        }
        continue;
      }
      if (buf.length + block.length > MAX_LLM_DOCUMENT_CHARS && buf.length > 0) {
        flush();
        buf = block;
      } else {
        buf = buf ? `${buf}\n\n${block}` : block;
      }
    }
    flush();

    if (chunks.length > 0) {
      return chunks.map((t, index) => ({ index, total: chunks.length, text: t }));
    }
  }

  const parts = splitByParagraphLimit(text, MAX_LLM_DOCUMENT_CHARS);
  return parts.map((t, index) => ({ index, total: parts.length, text: t }));
}

export function buildStructuralMacroWindows(
  text: string,
  signals?: DocumentCompilerStructuralSignals
): StructuralMacroWindow[] {
  const splits = findMacroSplitOffsets(text);
  const useStructure =
    splits.length >= 2 ||
    signals?.has_chapter_headings ||
    signals?.has_scene_grid ||
    (signals?.tab_count ?? 0) >= 2;

  if (useStructure && splits.length >= 1) {
    const uniqueOffsets = [...new Set([0, ...splits.map((s) => s.offset), text.length])].sort(
      (a, b) => a - b
    );
    const windows: StructuralMacroWindow[] = [];

    for (let i = 0; i < uniqueOffsets.length - 1; i++) {
      const char_start = uniqueOffsets[i]!;
      const char_end = uniqueOffsets[i + 1]!;
      const slice = text.slice(char_start, char_end).trim();
      if (slice.length < 40) continue;

      const splitMeta = [...splits].reverse().find((s) => s.offset <= char_start && s.offset >= char_start - 4);
      const label = splitMeta?.label ?? `Block ${windows.length + 1}`;
      const kind = splitMeta?.kind ?? "section";

      windows.push({
        window_id: `macro_${kind}_${windows.length}`,
        index: windows.length,
        total: 0,
        label,
        text: slice,
        char_start,
        char_end,
        kind,
      });
    }

    if (windows.length > 0) {
      const total = windows.length;
      return windows.map((w) => ({ ...w, total }));
    }
  }

  const convergeChunks = splitDocumentForConverge(text);
  return convergeChunks.map((c, i) => {
    const char_start = text.indexOf(c.text.slice(0, Math.min(80, c.text.length)));
    const start = char_start >= 0 ? char_start : i * Math.floor(text.length / convergeChunks.length);
    const end = start + c.text.length;
    return {
      window_id: `macro_para_${i}`,
      index: c.index,
      total: c.total,
      label: `Part ${c.index + 1}`,
      text: c.text,
      char_start: start,
      char_end: Math.min(text.length, end),
      kind: "paragraph" as const,
    };
  });
}
