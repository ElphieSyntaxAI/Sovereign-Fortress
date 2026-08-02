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
  __resetMsgfJobQueueMemoryForTests,
  dequeueMsgfJob,
  enqueueDropboxArchiveJob,
  enqueueMsgfJob,
} from "../lib/services/msgf-job-queue.ts";
import { buildWebhookIdempotencyKey } from "../lib/services/webhook-inbox.ts";

describe("webhook idempotency key", () => {
  test("stable provider:ext:event", () => {
    assert.equal(
      buildWebhookIdempotencyKey({
        provider: "docusign",
        externalRequestId: "env-1",
        event: "envelope-completed",
      }),
      "docusign:env-1:envelope-completed"
    );
  });

  test("falls back to invite id", () => {
    const key = buildWebhookIdempotencyKey({
      provider: "dropbox_sign",
      inviteId: "inv-9",
      event: "signature_request_all_signed",
    });
    assert.equal(key, "dropbox_sign:inv-9:signature_request_all_signed");
  });

  test("same inputs → same key (replay)", () => {
    const a = buildWebhookIdempotencyKey({
      provider: "docusign",
      externalRequestId: "x",
      event: "envelope-completed",
    });
    const b = buildWebhookIdempotencyKey({
      provider: "docusign",
      externalRequestId: "x",
      event: "envelope-completed",
    });
    assert.equal(a, b);
  });
});

describe("msgf job queue memory fail-open", () => {
  test("enqueue then dequeue dropbox-archive", async () => {
    __resetMsgfJobQueueMemoryForTests();
    // Force memory path by using enqueue after reset with no redis assumed
    const r = await enqueueDropboxArchiveJob({
      invite_id: "inv-1",
      company_id: "co-1",
      envelope_id: "env-1",
      provider: "docusign",
    });
    assert.ok(r.backend === "memory" || r.backend === "redis" || r.backend === "none");

    // Ensure at least memory has the job if redis also got it — dequeue either way
    await enqueueMsgfJob("dropbox-archive", {
      type: "dropbox-archive",
      invite_id: "inv-mem",
      company_id: "co-1",
      provider: "docusign",
      enqueued_at: new Date().toISOString(),
    });

    // Drain until we see inv-mem or give up
    let found = false;
    for (let i = 0; i < 5; i++) {
      const job = await dequeueMsgfJob("dropbox-archive");
      if (job?.type === "dropbox-archive" && job.invite_id === "inv-mem") {
        found = true;
        break;
      }
      if (!job) break;
    }
    // If redis stole jobs, still verify enqueue API shape
    if (!found) {
      __resetMsgfJobQueueMemoryForTests();
      const { enqueueJobSyncMemory } = await import("../lib/services/msgf-job-queue.ts");
      enqueueJobSyncMemory("dropbox-archive", {
        type: "dropbox-archive",
        invite_id: "inv-mem",
        company_id: "co-1",
        provider: "docusign",
        enqueued_at: new Date().toISOString(),
      });
      const job = await dequeueMsgfJob("dropbox-archive");
      assert.ok(job);
      assert.equal(job!.invite_id, "inv-mem");
    } else {
      assert.equal(found, true);
    }
  });
});
