import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HYBRID_ENVELOPE_VERSION,
  ML_KEM_768_CIPHERTEXT_LENGTH,
  X25519_PUBLIC_KEY_LENGTH,
  canonicalizeJson,
  generateHybridRecipientKeypair,
  generateMlDsa65Keypair,
  packHybridEnvelope0x03,
  signCanonicalJsonMlDsa65,
  unpackHybridEnvelope0x03,
  verifyCanonicalJsonMlDsa65,
} from "./index.js";

describe("hybrid envelope 0x03", () => {
  it("round-trips plaintext", () => {
    const { publicKeys, secretKeys } = generateHybridRecipientKeypair();
    const plain = "sk-test-secret-value-å";
    const packed = packHybridEnvelope0x03(plain, publicKeys);
    assert.equal(packed[0], HYBRID_ENVELOPE_VERSION);
    assert.equal(packed.readUInt16BE(1), X25519_PUBLIC_KEY_LENGTH);
    assert.equal(packed.readUInt16BE(1 + 2 + 32), ML_KEM_768_CIPHERTEXT_LENGTH);
    const out = unpackHybridEnvelope0x03(packed, secretKeys);
    assert.equal(out, plain);
  });

  it("rejects truncated header", () => {
    const { secretKeys } = generateHybridRecipientKeypair();
    assert.throws(() => unpackHybridEnvelope0x03(Buffer.from([0x03, 0x00]), secretKeys));
  });
});

describe("ML-DSA-65 + canonicalize", () => {
  it("canonicalization is key-order stable", () => {
    const a = canonicalizeJson({ z: 1, a: { c: 3, b: 2 } });
    const b = canonicalizeJson({ a: { b: 2, c: 3 }, z: 1 });
    assert.equal(a, b);
  });

  it("sign then verify; tamper fails", () => {
    const kp = generateMlDsa65Keypair();
    const payload = { tenantId: "t1", sessions: [{ id: "s1", n: 2 }] };
    const { signature } = signCanonicalJsonMlDsa65(kp.secretKey, payload);
    assert.equal(verifyCanonicalJsonMlDsa65(kp.publicKey, payload, signature), true);
    assert.equal(
      verifyCanonicalJsonMlDsa65(kp.publicKey, { ...payload, tenantId: "t2" }, signature),
      false
    );
  });
});
