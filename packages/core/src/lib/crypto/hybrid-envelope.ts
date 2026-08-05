/**
 * Hybrid envelope wire format 0x03 (AES-256-GCM over hybrid-derived DEK).
 *
 * Layout (big-endian uint16 lengths):
 * [ 1 byte:  Version = 0x03 ]
 * [ 2 bytes: Ephemeral X25519 public key length = 32 ]
 * [ 32 bytes: Ephemeral X25519 public key ]
 * [ 2 bytes: ML-KEM-768 ciphertext length = 1088 ]
 * [ 1088 bytes: ML-KEM-768 ciphertext ]
 * [ 12 bytes: AES-GCM IV ]
 * [ N bytes: AES-256-GCM ciphertext || 16-byte auth tag ]
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import {
  HYBRID_DEK_LENGTH,
  ML_KEM_768_CIPHERTEXT_LENGTH,
  X25519_PUBLIC_KEY_LENGTH,
  hybridDecapsulate,
  hybridEncapsulate,
  type HybridRecipientPublicKeys,
  type HybridRecipientSecretKeys,
} from "./hybrid-kem.js";

export const HYBRID_ENVELOPE_VERSION = 0x03;
export const AES_GCM_IV_LENGTH = 12;
export const AES_GCM_TAG_LENGTH = 16;

const HEADER_FIXED =
  1 + 2 + X25519_PUBLIC_KEY_LENGTH + 2 + ML_KEM_768_CIPHERTEXT_LENGTH + AES_GCM_IV_LENGTH;

export function packHybridEnvelope0x03(
  plaintextUtf8: string,
  recipient: HybridRecipientPublicKeys
): Buffer {
  const { ephemeralX25519PublicKey, mlKemCipherText, dek } = hybridEncapsulate(recipient);
  if (dek.length !== HYBRID_DEK_LENGTH) {
    throw new Error("packHybridEnvelope0x03: unexpected DEK length");
  }

  const iv = randomBytes(AES_GCM_IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", dek, iv, { authTagLength: AES_GCM_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintextUtf8, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const xLen = Buffer.allocUnsafe(2);
  xLen.writeUInt16BE(X25519_PUBLIC_KEY_LENGTH, 0);
  const kLen = Buffer.allocUnsafe(2);
  kLen.writeUInt16BE(ML_KEM_768_CIPHERTEXT_LENGTH, 0);

  return Buffer.concat([
    Buffer.from([HYBRID_ENVELOPE_VERSION]),
    xLen,
    Buffer.from(ephemeralX25519PublicKey),
    kLen,
    Buffer.from(mlKemCipherText),
    iv,
    ciphertext,
    tag,
  ]);
}

export function unpackHybridEnvelope0x03(
  buf: Buffer,
  secret: HybridRecipientSecretKeys
): string {
  if (buf.length < HEADER_FIXED + AES_GCM_TAG_LENGTH) {
    throw new Error("unpackHybridEnvelope0x03: truncated envelope");
  }
  if (buf[0] !== HYBRID_ENVELOPE_VERSION) {
    throw new Error(`unpackHybridEnvelope0x03: expected version 0x03, got 0x${buf[0]?.toString(16)}`);
  }

  let offset = 1;
  const xLen = buf.readUInt16BE(offset);
  offset += 2;
  if (xLen !== X25519_PUBLIC_KEY_LENGTH) {
    throw new Error(`unpackHybridEnvelope0x03: unexpected X25519 length ${xLen}`);
  }
  const ephPk = buf.subarray(offset, offset + xLen);
  offset += xLen;

  const kLen = buf.readUInt16BE(offset);
  offset += 2;
  if (kLen !== ML_KEM_768_CIPHERTEXT_LENGTH) {
    throw new Error(`unpackHybridEnvelope0x03: unexpected ML-KEM ciphertext length ${kLen}`);
  }
  const kemCt = buf.subarray(offset, offset + kLen);
  offset += kLen;

  if (buf.length < offset + AES_GCM_IV_LENGTH + AES_GCM_TAG_LENGTH) {
    throw new Error("unpackHybridEnvelope0x03: missing IV/ciphertext/tag");
  }
  const iv = buf.subarray(offset, offset + AES_GCM_IV_LENGTH);
  offset += AES_GCM_IV_LENGTH;

  const body = buf.subarray(offset);
  if (body.length < AES_GCM_TAG_LENGTH) {
    throw new Error("unpackHybridEnvelope0x03: ciphertext shorter than auth tag");
  }
  const ciphertext = body.subarray(0, body.length - AES_GCM_TAG_LENGTH);
  const tag = body.subarray(body.length - AES_GCM_TAG_LENGTH);

  const dek = hybridDecapsulate(secret, ephPk, kemCt);
  const decipher = createDecipheriv("aes-256-gcm", dek, iv, { authTagLength: AES_GCM_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
