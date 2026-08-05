/**
 * Hybrid KEM: ephemeral X25519 + ML-KEM-768 → HKDF-SHA256 DEK.
 * Uses @noble/post-quantum subpath imports (required).
 */

import { createHash, hkdfSync, randomBytes as nodeRandomBytes } from "node:crypto";

import { x25519 } from "@noble/curves/ed25519.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { randomBytes as nobleRandomBytes } from "@noble/post-quantum/utils.js";

export const HYBRID_ENVELOPE_INFO = "msgf-v2-hybrid-envelope";
export const X25519_PUBLIC_KEY_LENGTH = 32;
export const ML_KEM_768_CIPHERTEXT_LENGTH = 1088;
export const ML_KEM_768_PUBLIC_KEY_LENGTH = 1184;
export const ML_KEM_768_SECRET_KEY_LENGTH = 2400;
export const HYBRID_DEK_LENGTH = 32;

export type HybridRecipientPublicKeys = {
  x25519PublicKey: Uint8Array;
  mlKem768PublicKey: Uint8Array;
};

export type HybridRecipientSecretKeys = {
  x25519SecretKey: Uint8Array;
  mlKem768SecretKey: Uint8Array;
};

export type HybridKemEncapsulation = {
  ephemeralX25519PublicKey: Uint8Array;
  mlKemCipherText: Uint8Array;
  dek: Buffer;
};

function asUint8(buf: Uint8Array | Buffer): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

/** Generate a recipient keypair (X25519 + ML-KEM-768). */
export function generateHybridRecipientKeypair(seed?: Uint8Array): {
  publicKeys: HybridRecipientPublicKeys;
  secretKeys: HybridRecipientSecretKeys;
} {
  const xSk = seed && seed.length >= 32 ? seed.subarray(0, 32) : x25519.utils.randomSecretKey();
  const xPk = x25519.getPublicKey(xSk);
  const kemSeed =
    seed && seed.length >= 96
      ? seed.subarray(32, 96)
      : nobleRandomBytes(ml_kem768.lengths.seed);
  const kem = ml_kem768.keygen(kemSeed);
  return {
    publicKeys: {
      x25519PublicKey: asUint8(xPk),
      mlKem768PublicKey: asUint8(kem.publicKey),
    },
    secretKeys: {
      x25519SecretKey: asUint8(xSk),
      mlKem768SecretKey: asUint8(kem.secretKey),
    },
  };
}

/**
 * Derive 32-byte AES DEK:
 * HKDF-SHA256(ikm = SS_X25519 || SS_ML-KEM-768, salt = null, info = "msgf-v2-hybrid-envelope")
 */
export function deriveHybridDek(ssX25519: Uint8Array, ssMlKem: Uint8Array): Buffer {
  const ikm = Buffer.concat([Buffer.from(ssX25519), Buffer.from(ssMlKem)]);
  return Buffer.from(hkdfSync("sha256", ikm, Buffer.alloc(0), HYBRID_ENVELOPE_INFO, HYBRID_DEK_LENGTH));
}

/** Encapsulate to recipient public keys; returns ephemeral material + DEK. */
export function hybridEncapsulate(recipient: HybridRecipientPublicKeys): HybridKemEncapsulation {
  if (recipient.x25519PublicKey.length !== X25519_PUBLIC_KEY_LENGTH) {
    throw new Error(`hybridEncapsulate: X25519 public key must be ${X25519_PUBLIC_KEY_LENGTH} bytes`);
  }
  if (recipient.mlKem768PublicKey.length !== ML_KEM_768_PUBLIC_KEY_LENGTH) {
    throw new Error(`hybridEncapsulate: ML-KEM-768 public key must be ${ML_KEM_768_PUBLIC_KEY_LENGTH} bytes`);
  }

  const ephSk = x25519.utils.randomSecretKey();
  const ephPk = x25519.getPublicKey(ephSk);
  const ssX = x25519.getSharedSecret(ephSk, recipient.x25519PublicKey);

  const { cipherText, sharedSecret } = ml_kem768.encapsulate(recipient.mlKem768PublicKey);
  if (cipherText.length !== ML_KEM_768_CIPHERTEXT_LENGTH) {
    throw new Error(`hybridEncapsulate: unexpected ML-KEM ciphertext length ${cipherText.length}`);
  }

  const dek = deriveHybridDek(ssX, sharedSecret);
  return {
    ephemeralX25519PublicKey: asUint8(ephPk),
    mlKemCipherText: asUint8(cipherText),
    dek,
  };
}

/** Decapsulate using recipient secret keys + ephemeral public material from the wire. */
export function hybridDecapsulate(
  secret: HybridRecipientSecretKeys,
  ephemeralX25519PublicKey: Uint8Array,
  mlKemCipherText: Uint8Array
): Buffer {
  if (ephemeralX25519PublicKey.length !== X25519_PUBLIC_KEY_LENGTH) {
    throw new Error("hybridDecapsulate: invalid ephemeral X25519 public key length");
  }
  if (mlKemCipherText.length !== ML_KEM_768_CIPHERTEXT_LENGTH) {
    throw new Error("hybridDecapsulate: invalid ML-KEM ciphertext length");
  }
  if (secret.x25519SecretKey.length !== X25519_PUBLIC_KEY_LENGTH) {
    throw new Error("hybridDecapsulate: invalid X25519 secret key length");
  }
  if (secret.mlKem768SecretKey.length !== ML_KEM_768_SECRET_KEY_LENGTH) {
    throw new Error("hybridDecapsulate: invalid ML-KEM secret key length");
  }

  const ssX = x25519.getSharedSecret(secret.x25519SecretKey, ephemeralX25519PublicKey);
  const ssK = ml_kem768.decapsulate(mlKemCipherText, secret.mlKem768SecretKey);
  return deriveHybridDek(ssX, ssK);
}

/** Fingerprint a public key blob (hex SHA-256) for key ids. */
export function fingerprintPublicKeyMaterial(...parts: Uint8Array[]): string {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}

export function randomHybridSeed(): Buffer {
  return nodeRandomBytes(96);
}
