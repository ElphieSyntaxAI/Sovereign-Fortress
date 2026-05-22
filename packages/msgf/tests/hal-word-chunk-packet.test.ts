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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildHalWordChunks,
  filterChunksAfterIndex,
  filterEventsForWordChunk,
  HAL_PACKET_OVERLAP_WORDS,
  HAL_PACKET_WORDS,
} from "../lib/hal-word-chunk-packet.ts";
import {
  authorHalEventsToUniversalKeystrokes,
  buildChunkedAuthorPulseBodiesFromContent,
} from "../lib/hal-author-bridge.ts";

describe("hal-word-chunk-packet", () => {
  test("175 words with 10 overlap produces sliding windows", () => {
    const words = Array.from({ length: 200 }, (_, i) => `w${i}`);
    const text = words.join(" ");
    const chunks = buildHalWordChunks(text);
    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0]!.wordCount, HAL_PACKET_WORDS);
    assert.equal(chunks[1]!.wordStart, HAL_PACKET_WORDS - HAL_PACKET_OVERLAP_WORDS);
  });

  test("filterChunksAfterIndex skips already synced", () => {
    const chunks = buildHalWordChunks("a ".repeat(400).trim());
    const next = filterChunksAfterIndex(chunks, 0);
    assert.ok(next.every((c) => c.chunkIndex > 0));
  });

  test("authorHalEventsToUniversalKeystrokes preserves dwell and paste", () => {
    const ks = authorHalEventsToUniversalKeystrokes([
      { key: "a", timestamp: 1000, flightTime: 50, dwellTime: 80 },
      { key: "PASTE_EVENT", timestamp: 1100, isSystemEvent: true, wordsPasted: 12 },
    ]);
    assert.equal(ks.length, 2);
    assert.equal(ks[0]!.dwellMs, 80);
    assert.equal(ks[0]!.flightMs, 50);
    assert.equal(ks[1]!.isSystemEvent, true);
    assert.equal(ks[1]!.wordsPasted, 12);
  });

  test("buildChunkedAuthorPulseBodiesFromContent aligns packets", () => {
    const content = Array.from({ length: 180 }, (_, i) => `word${i}`).join(" ");
    const events = Array.from({ length: 360 }, (_, i) => ({
      key: "k",
      flightTime: 40 + (i % 5),
      dwellTime: 60,
    }));
    const packets = buildChunkedAuthorPulseBodiesFromContent({
      contentDelta: content,
      events,
      targetPrefix: "author:test-ms",
    });
    assert.ok(packets.length >= 1);
    assert.ok(packets[0]!.body.keystrokes.length > 0);
  });
});
