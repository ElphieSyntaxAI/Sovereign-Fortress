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
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildLocalChildProjectInput,
  deriveProjectOriginFromLocalPath,
  joinParentAndRelativeChild,
  normalizePathSegment,
} from "../lib/services/user-project-paths.ts";
import {
  BulkCreateUserProjectsBodySchema,
  CreateUserProjectBodySchema,
  resolveProjectOriginInput,
} from "../lib/services/user-projects.ts";

describe("user-project-paths", () => {
  test("normalizePathSegment collapses slashes and trims edges", () => {
    assert.equal(normalizePathSegment("C:\\\\dev\\\\app\\\\"), "C:/dev/app");
    assert.equal(normalizePathSegment("/a//b/"), "a/b");
  });

  test("deriveProjectOriginFromLocalPath uses last two segments", () => {
    assert.equal(
      deriveProjectOriginFromLocalPath("C:/Users/me/Desktop/ElphieSyntaxLLC/apps/author-ecosystem"),
      "apps/author-ecosystem"
    );
    assert.equal(deriveProjectOriginFromLocalPath("solo-app"), "solo-app");
  });

  test("joinParentAndRelativeChild builds nested path", () => {
    assert.equal(
      joinParentAndRelativeChild("C:/dev/ElphieSyntaxLLC", "packages/msgf"),
      "C:/dev/ElphieSyntaxLLC/packages/msgf"
    );
  });

  test("buildLocalChildProjectInput sets display name from leaf", () => {
    const body = buildLocalChildProjectInput({
      parentPath: "C:/dev/ElphieSyntaxLLC",
      relativeChild: "apps/author-ecosystem",
    });
    assert.equal(body.source_type, "local");
    assert.equal(body.display_name, "author-ecosystem");
    assert.equal(body.local_path, "C:/dev/ElphieSyntaxLLC/apps/author-ecosystem");
    assert.equal(body.project_origin, undefined);
  });
});

describe("user-projects schemas + origin", () => {
  test("CreateUserProjectBodySchema accepts github repo", () => {
    const parsed = CreateUserProjectBodySchema.safeParse({
      source_type: "github",
      display_name: "owner/repo",
      github_url: "https://github.com/owner/repo",
    });
    assert.equal(parsed.success, true);
  });

  test("BulkCreateUserProjectsBodySchema rejects empty list", () => {
    const parsed = BulkCreateUserProjectsBodySchema.safeParse({ projects: [] });
    assert.equal(parsed.success, false);
  });

  test("BulkCreateUserProjectsBodySchema accepts multiple local children", () => {
    const projects = [
      buildLocalChildProjectInput({
        parentPath: "C:/dev/ElphieSyntaxLLC",
        relativeChild: "apps/author-ecosystem",
      }),
      buildLocalChildProjectInput({
        parentPath: "C:/dev/ElphieSyntaxLLC",
        relativeChild: "packages/msgf",
      }),
    ];
    const parsed = BulkCreateUserProjectsBodySchema.safeParse({ projects });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.projects.length, 2);
    }
  });

  test("resolveProjectOriginInput prefers explicit override", () => {
    assert.equal(
      resolveProjectOriginInput({
        source_type: "local",
        display_name: "x",
        local_path: "C:/a/b/c",
        project_origin: "Andrew/starmap",
      }),
      "Andrew/starmap"
    );
  });

  test("resolveProjectOriginInput derives from github url", () => {
    assert.equal(
      resolveProjectOriginInput({
        source_type: "github",
        display_name: "starmap",
        github_url: "https://github.com/Andrew/starmap",
      }),
      "Andrew/starmap"
    );
  });
});

describe("github token encryption (CryptoService)", () => {
  test("encryptKey/decryptKey roundtrip for provider_token shape", async () => {
    process.env.NODE_ENV = "test";
    process.env.CRYPTO_SECRET_KEY =
      process.env.CRYPTO_SECRET_KEY || "0123456789abcdef0123456789abcdef";
    const { encryptKey, decryptKey } = await import("../lib/crypto/CryptoService.ts");
    const plain = "gho_test_github_provider_token_example";
    const enc = await encryptKey(plain);
    assert.ok(enc.length > 20);
    assert.equal(await decryptKey(enc), plain);
  });
});
