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
import { describe, test } from "node:test";
import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";

import {
  buildDropboxArchiveRelativePath,
  dropboxArchiveMockMode,
  uploadSignedArchive,
} from "../lib/services/dropbox-archive.ts";

describe("dropbox-archive paths", () => {
  test("relative path layout", () => {
    const rel = buildDropboxArchiveRelativePath({
      companySlug: "Acme Co!",
      inviteId: "inv-123",
      year: 2026,
    });
    assert.equal(rel.pdf, "Acme_Co_/2026/inv-123/signed.pdf");
    assert.equal(rel.audit, "Acme_Co_/2026/inv-123/audit.json");
  });

  test("mock mode when MSGF_DROPBOX_ARCHIVE_MOCK=1", () => {
    assert.equal(dropboxArchiveMockMode({ MSGF_DROPBOX_ARCHIVE_MOCK: "1" }), true);
    assert.equal(
      dropboxArchiveMockMode({ MSGF_DROPBOX_ARCHIVE_MOCK: "0", DROPBOX_ACCESS_TOKEN: "t" }),
      false
    );
    assert.equal(
      dropboxArchiveMockMode({
        NODE_ENV: "production",
        DEPLOY_ENV: "production",
        MSGF_DROPBOX_ARCHIVE_MOCK: "1",
      }),
      false
    );
  });
});

describe("dropbox-archive mock upload", () => {
  test("writes signed.pdf and audit.json under tmp root", async () => {
    const prevCwd = process.cwd();
    const tmp = await mkdtemp(path.join(os.tmpdir(), "msgf-dbx-"));
    const prevMock = process.env.MSGF_DROPBOX_ARCHIVE_MOCK;
    const prevToken = process.env.DROPBOX_ACCESS_TOKEN;
    process.env.MSGF_DROPBOX_ARCHIVE_MOCK = "1";
    delete process.env.DROPBOX_ACCESS_TOKEN;

    try {
      process.chdir(tmp);
      const result = await uploadSignedArchive({
        companyId: "co-1",
        companySlug: "demo",
        inviteId: "invite-abc",
        provider: "docusign",
        pdfBytes: Buffer.from("%PDF-1.4 mock"),
      });
      assert.equal(result.mocked, true);
      assert.ok(result.signed_pdf_sha256.length === 64);
      const pdf = await readFile(result.archive_path);
      assert.ok(pdf.length > 0);
      const audit = JSON.parse(await readFile(result.audit_path, "utf8")) as {
        invite_id: string;
      };
      assert.equal(audit.invite_id, "invite-abc");
    } finally {
      process.chdir(prevCwd);
      if (prevMock === undefined) delete process.env.MSGF_DROPBOX_ARCHIVE_MOCK;
      else process.env.MSGF_DROPBOX_ARCHIVE_MOCK = prevMock;
      if (prevToken === undefined) delete process.env.DROPBOX_ACCESS_TOKEN;
      else process.env.DROPBOX_ACCESS_TOKEN = prevToken;
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
