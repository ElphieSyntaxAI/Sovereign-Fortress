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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Ops cron auth + Hall Redis purge helpers.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { msgfSecureSecretEqual } from "../lib/msgf-admin-auth";
import {
  HALL_REDIS_PURGE_DEFAULT_RETENTION_DAYS,
  shouldPurgeHallRedisEntry,
} from "../lib/services/hall-redis-purge";

describe("MSGF ops cron auth", () => {
  test("msgfSecureSecretEqual accepts matching secrets only", () => {
    assert.equal(msgfSecureSecretEqual("cron-secret-abc", "cron-secret-abc"), true);
    assert.equal(msgfSecureSecretEqual("cron-secret-abc", "cron-secret-abd"), false);
    assert.equal(msgfSecureSecretEqual("short", "longer-secret"), false);
    assert.equal(msgfSecureSecretEqual("", "x"), false);
  });
});

describe("Hall Redis purge helpers", () => {
  test("purges stale local_state_cache and old lineage payloads", () => {
    const cutoff = Date.now() - HALL_REDIS_PURGE_DEFAULT_RETENTION_DAYS * 86_400_000;
    const old = new Date(cutoff - 86_400_000).toISOString();
    const recent = new Date().toISOString();

    assert.equal(
      shouldPurgeHallRedisEntry(
        "msgf:local_state_cache:tenant:a:cache-1",
        JSON.stringify({ saved_at: old, metadata: { ledger: "vault" } }),
        cutoff
      ),
      true
    );

    assert.equal(
      shouldPurgeHallRedisEntry(
        "msgf:local_state_cache:tenant:a:cache-2",
        JSON.stringify({ saved_at: recent, metadata: { ledger: "hall" } }),
        cutoff
      ),
      true
    );

    assert.equal(
      shouldPurgeHallRedisEntry(
        "msgf:local_state_cache:tenant:a:cache-3",
        JSON.stringify({ saved_at: recent, metadata: { ledger: "vault" } }),
        cutoff
      ),
      false
    );

    assert.equal(
      shouldPurgeHallRedisEntry(
        "msgf:lineage:tenant:doc:dual-lawbook",
        JSON.stringify({ cached_at: old, p2_version: "v1" }),
        cutoff
      ),
      true
    );
  });
});
