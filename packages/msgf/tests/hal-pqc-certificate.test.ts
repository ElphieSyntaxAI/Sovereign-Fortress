import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateMlDsa65Keypair } from "@elphie-syntax/core/lib/crypto";
import {
  buildHumanAuthorshipCertificate,
  verifyHumanAuthorshipCertificate,
} from "../../../apps/author-ecosystem/server/src/lib/AuthorSovereigntyService.ts";

describe("HAL authorship certificate PQC", () => {
  it("builds v1 without PQC", () => {
    const cert = buildHumanAuthorshipCertificate("tenant-1", [], { pqcSign: false });
    assert.equal(cert.schema, "human_authorship_certificate.v1");
    assert.equal(verifyHumanAuthorshipCertificate(cert).ok, false);
  });

  it("builds and verifies v2 ML-DSA-65", () => {
    const kp = generateMlDsa65Keypair();
    const cert = buildHumanAuthorshipCertificate("tenant-1", [], {
      pqcSign: true,
      mlDsaSecretKeyHex: Buffer.from(kp.secretKey).toString("hex"),
      mlDsaPublicKeyHex: Buffer.from(kp.publicKey).toString("hex"),
      publicKeyId: kp.publicKeyId,
      vaultSealSha256: "deadbeef",
      loreGit: { status: "unavailable" },
    });
    assert.equal(cert.schema, "human_authorship_certificate.v2");
    if (cert.schema !== "human_authorship_certificate.v2") throw new Error("unreachable");
    assert.equal(cert.signatureAlgorithm, "ML-DSA-65");
    assert.equal(verifyHumanAuthorshipCertificate(cert).ok, true);
    cert.payload.tenantId = "tampered";
    assert.equal(verifyHumanAuthorshipCertificate(cert).ok, false);
  });
});
