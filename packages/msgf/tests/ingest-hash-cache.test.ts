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
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  contentSha256Hex,
  isIngestAuditSkipOnHashHit,
  isIngestHashSkipEnabled,
  partitionIngestFilesByContentHash,
} from "../lib/services/ingest-hash-cache.js";

describe("ingest-hash-cache", () => {
  test("contentSha256Hex is stable for same content", () => {
    const a = contentSha256Hex("hello");
    const b = contentSha256Hex("hello");
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  test("contentSha256Hex differs for different content", () => {
    assert.notEqual(contentSha256Hex("a"), contentSha256Hex("b"));
  });

  test("audit skip on hash hit defaults on", () => {
    const prev = process.env.MSGF_INGEST_SKIP_AUDIT_ON_HASH_HIT;
    delete process.env.MSGF_INGEST_SKIP_AUDIT_ON_HASH_HIT;
    assert.equal(isIngestAuditSkipOnHashHit(), true);
    process.env.MSGF_INGEST_SKIP_AUDIT_ON_HASH_HIT = "0";
    assert.equal(isIngestAuditSkipOnHashHit(), false);
    if (prev === undefined) delete process.env.MSGF_INGEST_SKIP_AUDIT_ON_HASH_HIT;
    else process.env.MSGF_INGEST_SKIP_AUDIT_ON_HASH_HIT = prev;
  });

  test("partition treats all files as changed when hash skip disabled", async () => {
    const prev = process.env.MSGF_INGEST_HASH_SKIP;
    process.env.MSGF_INGEST_HASH_SKIP = "0";
    const files = [
      { path: "a.ts", content: "one" },
      { path: "b.ts", content: "two" },
    ];
    const part = await partitionIngestFilesByContentHash("tenant-test", files);
    assert.equal(part.changed.length, 2);
    assert.equal(part.unchanged.length, 0);
    assert.equal(part.skipped_paths.length, 0);
    if (prev === undefined) delete process.env.MSGF_INGEST_HASH_SKIP;
    else process.env.MSGF_INGEST_HASH_SKIP = prev;
  });

  test("hash skip enabled by default", () => {
    const prev = process.env.MSGF_INGEST_HASH_SKIP;
    delete process.env.MSGF_INGEST_HASH_SKIP;
    assert.equal(isIngestHashSkipEnabled(), true);
    if (prev === undefined) delete process.env.MSGF_INGEST_HASH_SKIP;
    else process.env.MSGF_INGEST_HASH_SKIP = prev;
  });
});
