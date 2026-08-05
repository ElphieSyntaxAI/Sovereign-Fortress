/**
 * ML-DSA-65 (FIPS 204 algorithm family) sign/verify + RFC 8785-style JSON canonicalize.
 */

import { createHash } from "node:crypto";

import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { randomBytes } from "@noble/post-quantum/utils.js";
import canonicalize from "canonicalize";

export const ML_DSA_65_ALGORITHM = "ML-DSA-65" as const;
export const ML_DSA_65_PUBLIC_KEY_LENGTH = 1952;
export const ML_DSA_65_SECRET_KEY_LENGTH = 4032;
export const ML_DSA_65_SIGNATURE_LENGTH = 3309;

/** Deterministic JSON canonicalization (RFC 8785 / JCS via `canonicalize`). */
export function canonicalizeJson(value: unknown): string {
  const out = canonicalize(value);
  if (typeof out !== "string") {
    throw new Error("canonicalizeJson: failed to canonicalize value");
  }
  return out;
}

export function sha256HexOfCanonicalJson(value: unknown): string {
  const canonical = canonicalizeJson(value);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export type MlDsa65Keypair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  /** SHA-256 hex of public key bytes — stable publicKeyId. */
  publicKeyId: string;
};

export function generateMlDsa65Keypair(seed?: Uint8Array): MlDsa65Keypair {
  const s = seed && seed.length >= 32 ? seed.subarray(0, 32) : randomBytes(32);
  const { publicKey, secretKey } = ml_dsa65.keygen(s);
  const publicKeyId = createHash("sha256").update(publicKey).digest("hex");
  return { publicKey, secretKey, publicKeyId };
}

export function signMlDsa65(secretKey: Uint8Array, message: Uint8Array): Uint8Array {
  if (secretKey.length !== ML_DSA_65_SECRET_KEY_LENGTH) {
    throw new Error(`signMlDsa65: secretKey must be ${ML_DSA_65_SECRET_KEY_LENGTH} bytes`);
  }
  // noble API: sign(message, secretKey)
  return ml_dsa65.sign(message, secretKey);
}

export function verifyMlDsa65(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array
): boolean {
  if (publicKey.length !== ML_DSA_65_PUBLIC_KEY_LENGTH) {
    throw new Error(`verifyMlDsa65: publicKey must be ${ML_DSA_65_PUBLIC_KEY_LENGTH} bytes`);
  }
  if (signature.length !== ML_DSA_65_SIGNATURE_LENGTH) {
    return false;
  }
  // noble API: verify(signature, message, publicKey)
  return ml_dsa65.verify(signature, message, publicKey);
}

/** Sign a JSON-serializable payload after RFC 8785 canonicalization. */
export function signCanonicalJsonMlDsa65(
  secretKey: Uint8Array,
  payload: unknown
): { payloadCanonical: string; payloadSha256: string; signature: Uint8Array } {
  const payloadCanonical = canonicalizeJson(payload);
  const payloadSha256 = createHash("sha256").update(payloadCanonical, "utf8").digest("hex");
  const message = new TextEncoder().encode(payloadCanonical);
  const signature = signMlDsa65(secretKey, message);
  return { payloadCanonical, payloadSha256, signature };
}

export function verifyCanonicalJsonMlDsa65(
  publicKey: Uint8Array,
  payload: unknown,
  signature: Uint8Array
): boolean {
  const payloadCanonical = canonicalizeJson(payload);
  const message = new TextEncoder().encode(payloadCanonical);
  return verifyMlDsa65(publicKey, message, signature);
}
