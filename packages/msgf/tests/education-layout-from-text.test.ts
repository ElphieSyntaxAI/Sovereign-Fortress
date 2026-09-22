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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCatalogLayoutFromText } from "@/lib/education/layout-from-text";

describe("buildCatalogLayoutFromText", () => {
  it("builds chapters from Chapter headings", () => {
    const text = [
      "Chapter 1: Ecosystems",
      "Algae grow in ponds when light is available.",
      "",
      "Chapter 2: Weather",
      "Observations should be grouped by day and condition.",
    ].join("\n");
    const layout = buildCatalogLayoutFromText(text, "Grade 4 Science");
    assert.equal(layout.length, 1);
    assert.ok((layout[0]?.chapters.length ?? 0) >= 2);
    assert.match(layout[0]!.chapters[0]!.chapterTitle, /ecosystem|chapter 1/i);
  });

  it("falls back to full workbook when no headings", () => {
    const layout = buildCatalogLayoutFromText(
      "Short paragraph without structure. ".repeat(20),
      "Notes"
    );
    assert.equal(layout[0]?.chapters[0]?.chapterTitle, "Entire document");
  });
});
