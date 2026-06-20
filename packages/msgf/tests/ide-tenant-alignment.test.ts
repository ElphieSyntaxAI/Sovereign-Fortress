import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ideTenantKeysAlignForLicense,
  ideTokenTenantAlignsWithHeader,
  operationalTenantForLocalPath,
  operationalTenantForProjectOrigin,
} from "../lib/ide-tenant-alignment.js";

describe("ide-tenant-alignment", () => {
  test("maps Author project_origin to author_ecosystem", () => {
    assert.equal(
      operationalTenantForProjectOrigin("elphiesyntax/author-ecosystem"),
      "author_ecosystem"
    );
  });

  test("maps apps/author-ecosystem folder path to author_ecosystem", () => {
    assert.equal(operationalTenantForLocalPath("apps/author-ecosystem"), "author_ecosystem");
  });

  test("aligns license tenant with project_origin header key", () => {
    assert.equal(
      ideTenantKeysAlignForLicense("author_ecosystem", "elphiesyntax/author-ecosystem"),
      true
    );
  });

  test("aligns license tenant with local folder path key", () => {
    assert.equal(
      ideTenantKeysAlignForLicense("author_ecosystem", "apps/author-ecosystem"),
      true
    );
  });

  test("rejects unrelated tenant keys", () => {
    assert.equal(
      ideTenantKeysAlignForLicense("author_ecosystem", "elphiesyntax/msgf"),
      false
    );
  });

  test("aligns project_origin header with folder-path IDE token tenant", () => {
    assert.equal(
      ideTokenTenantAlignsWithHeader("apps/author-ecosystem", "elphiesyntax/author-ecosystem"),
      true
    );
    assert.equal(
      ideTokenTenantAlignsWithHeader("elphiesyntax/author-ecosystem", "apps/author-ecosystem"),
      true
    );
  });
});
