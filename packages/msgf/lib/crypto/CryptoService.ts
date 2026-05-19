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
 * Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
 */
/**
 * Tenant BYOK / provider API keys: AES-256-GCM envelope locally (CRYPTO_SECRET_KEY),
 * or Google Cloud KMS–wrapped DEK when NODE_ENV === "production".
 */
import crypto from "crypto";

const FORMAT_LOCAL = 0x01;
/** KMS wraps a random DEK; payload ciphertext uses AES-GCM with that DEK (fresh IV + tag per encrypt). */
const FORMAT_KMS = 0x02;

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const DEK_LENGTH = 32;
const MAX_WRAPPED_DEK_LENGTH = 8192;

function assertProductionKmsConfigured(): string {
  const name = process.env.MSGF_KMS_CRYPTO_KEY_PATH?.trim();
  if (!name) {
    throw new Error(
      'Production credential encryption requires MSGF_KMS_CRYPTO_KEY_PATH (full KMS CryptoKey resource name).'
    );
  }
  return name;
}

/** Lazy KMS client — loaded only on production encrypt/decrypt paths. */
async function getKmsClient(): Promise<import("@google-cloud/kms").KeyManagementServiceClient> {
  const { KeyManagementServiceClient } = await import("@google-cloud/kms");
  return new KeyManagementServiceClient();
}

async function kmsEncryptSymmetric(plaintext: Buffer): Promise<Buffer> {
  const name = assertProductionKmsConfigured();
  const client = await getKmsClient();
  const [resp] = await client.encrypt({
    name,
    plaintext,
  });
  if (!resp.ciphertext?.length) {
    throw new Error("KMS encrypt returned empty ciphertext.");
  }
  return Buffer.from(resp.ciphertext);
}

async function kmsDecryptSymmetric(ciphertext: Buffer): Promise<Buffer> {
  const name = assertProductionKmsConfigured();
  const client = await getKmsClient();
  const [resp] = await client.decrypt({
    name,
    ciphertext,
  });
  if (!resp.plaintext?.length) {
    throw new Error("KMS decrypt returned empty plaintext.");
  }
  return Buffer.from(resp.plaintext);
}

function decodeCryptoSecretKey(): Buffer {
  const raw = process.env.CRYPTO_SECRET_KEY?.trim();
  if (!raw) {
    throw new Error(
      "CRYPTO_SECRET_KEY is required for local/dev AES-256-GCM credential encryption (32-byte UTF-8 or 64-char hex)."
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const buf = Buffer.from(raw, "utf8");
  if (buf.length !== DEK_LENGTH) {
    throw new Error("CRYPTO_SECRET_KEY must decode to exactly 32 bytes (AES-256).");
  }
  return buf;
}

function aesGcmEncrypt(plaintextUtf8: string, dek: Buffer): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintextUtf8, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, ciphertext };
}

function aesGcmDecrypt(dek: Buffer, iv: Buffer, tag: Buffer, ciphertext: Buffer): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function packLocalEnvelope(iv: Buffer, tag: Buffer, ciphertext: Buffer): string {
  return Buffer.concat([
    Buffer.from([FORMAT_LOCAL]),
    iv,
    tag,
    ciphertext,
  ]).toString("hex");
}

function unpackAesPayload(buf: Buffer, offset: number): { iv: Buffer; tag: Buffer; ciphertext: Buffer; nextOffset: number } {
  if (buf.length < offset + IV_LENGTH + TAG_LENGTH) {
    throw new Error("Credential blob truncated (expected iv + tag + ciphertext).");
  }
  const iv = buf.subarray(offset, offset + IV_LENGTH);
  const tag = buf.subarray(offset + IV_LENGTH, offset + IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(offset + IV_LENGTH + TAG_LENGTH);
  return { iv, tag, ciphertext, nextOffset: buf.length };
}

function decryptLocalEnvelope(buf: Buffer): string {
  if (buf.length < 1 + IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid local credential envelope.");
  }
  const dek = decodeCryptoSecretKey();
  const offset = 1;
  const { iv, tag, ciphertext } = unpackAesPayload(buf, offset);
  return aesGcmDecrypt(dek, iv, tag, ciphertext);
}

/**
 * Encrypt a tenant-provided API key. Unique IV and auth tag per call.
 * @returns Lowercase hex string (versioned envelope).
 */
export async function encryptKey(plainTextKey: string): Promise<string> {
  const plain = plainTextKey ?? "";
  if (plain.length === 0) {
    throw new Error("encryptKey: empty key");
  }

  if (process.env.NODE_ENV === "production") {
    const dek = crypto.randomBytes(DEK_LENGTH);
    const wrapped = await kmsEncryptSymmetric(dek);
    if (wrapped.length > MAX_WRAPPED_DEK_LENGTH) {
      throw new Error("KMS wrapped DEK exceeds supported size.");
    }
    const { iv, tag, ciphertext } = aesGcmEncrypt(plain, dek);
    const lenBuf = Buffer.allocUnsafe(2);
    lenBuf.writeUInt16BE(wrapped.length, 0);
    return Buffer.concat([
      Buffer.from([FORMAT_KMS]),
      lenBuf,
      wrapped,
      iv,
      tag,
      ciphertext,
    ]).toString("hex");
  }

  const dek = decodeCryptoSecretKey();
  const { iv, tag, ciphertext } = aesGcmEncrypt(plain, dek);
  return packLocalEnvelope(iv, tag, ciphertext);
}

/**
 * Decrypt a payload produced by {@link encryptKey}.
 */
export async function decryptKey(encryptedHex: string): Promise<string> {
  const hex = encryptedHex?.trim();
  if (!hex || hex.length % 2 !== 0) {
    throw new Error("decryptKey: invalid hex");
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(hex, "hex");
  } catch {
    throw new Error("decryptKey: malformed hex");
  }
  if (buf.length < 1) {
    throw new Error("decryptKey: empty payload");
  }

  const version = buf[0];

  if (version === FORMAT_LOCAL) {
    return decryptLocalEnvelope(buf);
  }

  if (version === FORMAT_KMS) {
    if (buf.length < 3) throw new Error("decryptKey: KMS envelope truncated.");
    const wrappedLen = buf.readUInt16BE(1);
    if (wrappedLen < 1 || wrappedLen > MAX_WRAPPED_DEK_LENGTH) {
      throw new Error("decryptKey: invalid KMS wrapped length.");
    }
    const wrappedStart = 3;
    const wrappedEnd = wrappedStart + wrappedLen;
    if (buf.length < wrappedEnd + IV_LENGTH + TAG_LENGTH) {
      throw new Error("decryptKey: KMS envelope incomplete.");
    }
    const wrapped = buf.subarray(wrappedStart, wrappedEnd);
    const aesBuf = buf.subarray(wrappedEnd);
    const dek = await kmsDecryptSymmetric(wrapped);
    if (dek.length !== DEK_LENGTH) {
      throw new Error("decryptKey: unexpected DEK length from KMS.");
    }
    const { iv, tag, ciphertext } = unpackAesPayload(aesBuf, 0);
    return aesGcmDecrypt(dek, iv, tag, ciphertext);
  }

  throw new Error(`decryptKey: unknown envelope version ${version}`);
}

/** Convenience namespace for callers that prefer `CryptoService.encryptKey`. */
export const CryptoService = {
  encryptKey,
  decryptKey,
};
