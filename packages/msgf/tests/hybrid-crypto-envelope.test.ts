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
import { describe, it, after } from "node:test";

import { generateHybridRecipientKeypair } from "@elphie-syntax/core/lib/crypto";

describe("CryptoService hybrid 0x03", () => {
  const prev: Record<string, string | undefined> = {};

  after(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("encrypts and decrypts with hybrid envelope", async () => {
    const { publicKeys, secretKeys } = generateHybridRecipientKeypair();
    const keys = [
      "MSGF_HYBRID_KEM_ENABLED",
      "MSGF_HYBRID_X25519_PUBLIC_KEY",
      "MSGF_HYBRID_MLKEM_PUBLIC_KEY",
      "MSGF_HYBRID_X25519_SECRET_KEY",
      "MSGF_HYBRID_MLKEM_SECRET_KEY",
      "NODE_ENV",
    ];
    for (const k of keys) prev[k] = process.env[k];

    process.env.MSGF_HYBRID_KEM_ENABLED = "1";
    process.env.NODE_ENV = "development";
    process.env.MSGF_HYBRID_X25519_PUBLIC_KEY = Buffer.from(publicKeys.x25519PublicKey).toString("hex");
    process.env.MSGF_HYBRID_MLKEM_PUBLIC_KEY = Buffer.from(publicKeys.mlKem768PublicKey).toString("hex");
    process.env.MSGF_HYBRID_X25519_SECRET_KEY = Buffer.from(secretKeys.x25519SecretKey).toString("hex");
    process.env.MSGF_HYBRID_MLKEM_SECRET_KEY = Buffer.from(secretKeys.mlKem768SecretKey).toString("hex");

    const { encryptKey, decryptKey } = await import("../lib/crypto/CryptoService.ts");
    const hex = await encryptKey("sk-hybrid-test-key");
    const buf = Buffer.from(hex, "hex");
    assert.equal(buf[0], 0x03);
    const plain = await decryptKey(hex);
    assert.equal(plain, "sk-hybrid-test-key");
  });
});
