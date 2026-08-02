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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/**
 * Build curriculum catalog layout (Unit → Chapter → Section) from textbook text.
 * Uses the same chapter/section heading heuristics as the document compiler.
 */
import type { CatalogLayout } from "@/lib/education/curriculum-catalog";
import {
  buildDocumentCompilerStructuralSignals,
  buildStructuralMacroWindows,
} from "@/lib/services/document-compiler";

const SECTION_RE = /^(?:#{1,4}\s*)?(?:section|§)\s*([\d.]+)[\s:.\-—]*(.*)$/im;

/**
 * Derive a pickable catalog tree from raw curriculum text (admin book upload).
 */
export function buildCatalogLayoutFromText(text: string, titleHint?: string): CatalogLayout {
  const signals = buildDocumentCompilerStructuralSignals(text);
  const windows = buildStructuralMacroWindows(text, signals);

  const chapterWindows = windows.filter(
    (w) => w.kind === "chapter" || w.kind === "unit" || w.kind === "lesson"
  );

  if (chapterWindows.length === 0) {
    return [
      {
        unitId: "u1",
        unitTitle: titleHint?.trim() || "Full workbook",
        chapters: [
          {
            chapterId: "c1",
            chapterTitle: "Entire document",
            sections: [
              {
                sectionId: "s1",
                sectionTitle: "All pages",
                pageStart: 1,
                pageEnd: Math.max(1, Math.ceil(text.length / 1800)),
              },
            ],
          },
        ],
      },
    ];
  }

  const chapters = chapterWindows.map((w, i) => {
    const body = text.slice(w.char_start, w.char_end);
    const sections = extractSections(body, i);
    return {
      chapterId: w.window_id || `c${i + 1}`,
      chapterTitle: (w.label || `Chapter ${i + 1}`).slice(0, 256),
      pageStart: Math.floor(w.char_start / 1800) + 1,
      pageEnd: Math.max(
        Math.floor(w.char_start / 1800) + 1,
        Math.ceil(w.char_end / 1800)
      ),
      sections:
        sections.length > 0
          ? sections
          : [
              {
                sectionId: `c${i + 1}_s1`,
                sectionTitle: "Full chapter",
                pageStart: Math.floor(w.char_start / 1800) + 1,
                pageEnd: Math.ceil(w.char_end / 1800),
              },
            ],
    };
  });

  return [
    {
      unitId: "u1",
      unitTitle: titleHint?.trim() || "Textbook units",
      chapters,
    },
  ];
}

function extractSections(
  chapterBody: string,
  chapterIndex: number
): Array<{
  sectionId: string;
  sectionTitle: string;
  pageStart?: number;
  pageEnd?: number;
}> {
  const lines = chapterBody.split(/\r?\n/);
  const hits: Array<{ line: number; title: string; num: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(SECTION_RE);
    if (m) {
      hits.push({
        line: i,
        num: m[1] ?? String(hits.length + 1),
        title: (m[2] || `Section ${m[1]}`).trim().slice(0, 256) || `Section ${m[1]}`,
      });
    }
  }
  if (hits.length === 0) return [];

  return hits.map((h, idx) => {
    const next = hits[idx + 1];
    const startChar = lines.slice(0, h.line).join("\n").length;
    const endChar = next
      ? lines.slice(0, next.line).join("\n").length
      : chapterBody.length;
    return {
      sectionId: `c${chapterIndex + 1}_s${h.num}`.replace(/[^a-zA-Z0-9._-]/g, "_"),
      sectionTitle: h.title,
      pageStart: Math.floor(startChar / 1800) + 1,
      pageEnd: Math.max(Math.floor(startChar / 1800) + 1, Math.ceil(endChar / 1800)),
    };
  });
}
