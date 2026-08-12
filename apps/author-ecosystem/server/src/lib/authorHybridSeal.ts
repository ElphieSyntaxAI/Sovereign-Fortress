/**
 * Optional Hybrid KEM (0x03) seal for Vault Pact attestation metadata.
 * Uses MSGF CryptoService when MSGF_HYBRID_KEM_ENABLED=1; otherwise plaintext hash envelope.
 */

import { createHash } from "node:crypto";

export type AuthorVaultSealEnvelope = {
  schema: "author_vault_seal_v1";
  contentSha256: string;
  sealedAt: string;
  /** Hybrid KEM ciphertext hex when enabled; otherwise omitted. */
  hybridCipherHex?: string;
  hybridEnabled: boolean;
};

function hybridKemEnabled(): boolean {
  const v = process.env.MSGF_HYBRID_KEM_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Seal a Vault Pact content SHA-256 for durable attestation metadata.
 * When Hybrid KEM is on, also encrypts the sha256 string via MSGF encryptKey.
 */
export async function sealVaultPactAttestation(
  contentSha256: string
): Promise<AuthorVaultSealEnvelope> {
  const sealedAt = new Date().toISOString();
  const base: AuthorVaultSealEnvelope = {
    schema: "author_vault_seal_v1",
    contentSha256: contentSha256.trim().toLowerCase(),
    sealedAt,
    hybridEnabled: false,
  };

  if (!hybridKemEnabled()) return base;

  try {
    const { encryptKey } = await import("msgf/lib/crypto/CryptoService");
    const hybridCipherHex = await encryptKey(contentSha256.trim().toLowerCase());
    return { ...base, hybridEnabled: true, hybridCipherHex };
  } catch (e) {
    console.warn(
      "[authorHybridSeal] Hybrid KEM seal failed — storing hash-only envelope:",
      e instanceof Error ? e.message : e
    );
    return base;
  }
}

/** Verify an envelope against expected pact SHA-256 (hash compare; optional decrypt check). */
export async function verifyVaultPactSealEnvelope(
  envelope: AuthorVaultSealEnvelope,
  expectedSha256: string
): Promise<{ ok: boolean; reason: string }> {
  const expected = expectedSha256.trim().toLowerCase();
  if (envelope.contentSha256 !== expected) {
    return { ok: false, reason: "contentSha256 mismatch" };
  }
  if (!envelope.hybridEnabled || !envelope.hybridCipherHex) {
    return { ok: true, reason: "hash-only seal" };
  }
  try {
    const { decryptKey } = await import("msgf/lib/crypto/CryptoService");
    const plain = await decryptKey(envelope.hybridCipherHex);
    if (plain.trim().toLowerCase() !== expected) {
      return { ok: false, reason: "hybrid decrypt mismatch" };
    }
    return { ok: true, reason: "hybrid seal verified" };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "hybrid decrypt failed",
    };
  }
}

/** Deterministic fingerprint for ops logs (not a secret). */
export function vaultSealFingerprint(envelope: AuthorVaultSealEnvelope): string {
  return createHash("sha256")
    .update(
      `${envelope.schema}|${envelope.contentSha256}|${envelope.hybridEnabled ? "1" : "0"}`,
      "utf8"
    )
    .digest("hex")
    .slice(0, 16);
}
