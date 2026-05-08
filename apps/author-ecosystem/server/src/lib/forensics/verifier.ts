/**
 * Forensic identity verification: rhythm + linguistics vs `p4_forensic_profiles` baseline.
 */

import { createDecipheriv, createHash } from "node:crypto";

import type { CalibrationResult } from "@elphie-syntax/core/lib/forensics/calibration/pure";
import { latencyP90Ms, stylometricFromContentDelta } from "../halMetrics.js";

export type VerificationStatus = "IDENTITY_OK" | "IDENTITY_ANOMALY";

export type ForensicProfileRow = {
  tenant_id: string;
  tenant_scope: "author" | "school";
  storage: unknown;
};

export type CurrentSessionMetrics = {
  /** Inter-key flight times or dwell series (ms), same shape as HAL `keystrokeLatencies`. */
  latencyMs: number[];
  contentDelta: string;
};

export type SchoolKeyResolver = (
  tenantId: string
) => Buffer | Uint8Array | Promise<Buffer | Uint8Array>;

export type VerifyIdentityOptions = {
  tenantId: string;
  /** Required when `profile.tenant_scope === 'school'` (encrypted storage). */
  resolveSchoolEncryptionKey?: SchoolKeyResolver;
  /** Confidence threshold; below this yields `IDENTITY_ANOMALY` (default 70). */
  anomalyThresholdPct?: number;
};

export type VerificationOutcome = {
  status: VerificationStatus;
  /** 0–100 overall confidence. */
  confidencePct: number;
  rhythm: {
    current_p90_ms: number;
    baseline_p90_ms: number;
    /** 0–1 alignment contribution. */
    alignment: number;
  };
  linguistic: {
    lexical_current: number;
    lexical_baseline: number;
    sentence_current: number;
    sentence_baseline: number;
    alignment_lexical: number;
    alignment_sentence: number;
  };
};

type PlainStorage = { mode: "plaintext"; calibration: CalibrationResult };
type CipherStorage = {
  mode: "ciphertext";
  alg: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

const EPS = 1e-6;

function normalizeAesKey(material: Buffer | Uint8Array): Buffer {
  return createHash("sha256").update(Buffer.from(material)).digest();
}

async function decryptSchoolCalibration(
  storage: CipherStorage,
  keyMaterial: Buffer | Uint8Array
): Promise<CalibrationResult> {
  if (storage.alg !== "aes-256-gcm") {
    throw new Error(`Unsupported forensic cipher: ${storage.alg}`);
  }
  const key = normalizeAesKey(keyMaterial);
  const iv = Buffer.from(storage.iv, "base64");
  const tag = Buffer.from(storage.tag, "base64");
  const enc = Buffer.from(storage.ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as CalibrationResult;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

function parsePlainStorage(storage: unknown): PlainStorage | null {
  if (!isRecord(storage)) return null;
  if (storage.mode !== "plaintext") return null;
  const cal = storage.calibration;
  if (!isRecord(cal)) return null;
  return storage as unknown as PlainStorage;
}

function parseCipherStorage(storage: unknown): CipherStorage | null {
  if (!isRecord(storage)) return null;
  if (storage.mode !== "ciphertext") return null;
  if (
    typeof storage.iv !== "string" ||
    typeof storage.tag !== "string" ||
    typeof storage.ciphertext !== "string"
  ) {
    return null;
  }
  return storage as unknown as CipherStorage;
}

/** Maps relative error to 0–1 alignment (1 = identical). */
function alignmentFromRelativeError(current: number, baseline: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return 0;
  const denom = Math.max(EPS, Math.abs(baseline));
  const rel = Math.abs(current - baseline) / denom;
  return Math.max(0, Math.min(1, 1 - rel));
}

const DEFAULT_ANOMALY_THRESHOLD = 70;

/**
 * Resolve `CalibrationResult` from a `p4_forensic_profiles` row (plaintext or school ciphertext).
 */
export async function resolveCalibrationBaseline(
  profile: ForensicProfileRow,
  options: { tenantId: string; resolveSchoolEncryptionKey?: SchoolKeyResolver }
): Promise<CalibrationResult> {
  const plain = parsePlainStorage(profile.storage);
  if (plain) {
    return plain.calibration;
  }

  const cipher = parseCipherStorage(profile.storage);
  if (cipher) {
    if (profile.tenant_scope !== "school") {
      throw new Error("Ciphertext forensic storage requires tenant_scope 'school'.");
    }
    const resolver = options.resolveSchoolEncryptionKey;
    if (!resolver) {
      throw new Error(
        "resolveSchoolEncryptionKey is required to verify an encrypted (school) forensic profile."
      );
    }
    const keyMaterial = await resolver(options.tenantId);
    return decryptSchoolCalibration(cipher, keyMaterial);
  }

  throw new Error("Unrecognized p4_forensic_profiles.storage shape.");
}

/**
 * Compare current HAL/stylometric metrics to the author's (or decrypted school) calibration.
 */
export async function verifyIdentitySession(
  current: CurrentSessionMetrics,
  profile: ForensicProfileRow,
  options: VerifyIdentityOptions
): Promise<VerificationOutcome> {
  const threshold = options.anomalyThresholdPct ?? DEFAULT_ANOMALY_THRESHOLD;

  const baseline = await resolveCalibrationBaseline(profile, {
    tenantId: options.tenantId,
    resolveSchoolEncryptionKey: options.resolveSchoolEncryptionKey,
  });

  const currentP90 = latencyP90Ms(current.latencyMs);
  const baselineP90 = baseline.keystroke_fingerprint.p90_ms;
  const rhythmAlign = alignmentFromRelativeError(currentP90, baselineP90);

  const style = stylometricFromContentDelta(current.contentDelta);
  const lexicalCurrent = style.vocabulary_variety;
  const sentenceCurrent = style.average_sentence_length_words;
  const lexicalBaseline = baseline.lexical_density;
  const sentenceBaseline = baseline.syntactic_baseline.avg_sentence_length_words;

  const alignmentLexical = alignmentFromRelativeError(lexicalCurrent, lexicalBaseline);
  const alignmentSentence = alignmentFromRelativeError(sentenceCurrent, sentenceBaseline);

  const confidenceRaw =
    rhythmAlign * 0.35 + alignmentLexical * 0.325 + alignmentSentence * 0.325;
  const confidencePct = Math.round(Math.max(0, Math.min(1, confidenceRaw)) * 10000) / 100;

  const status: VerificationStatus =
    confidencePct < threshold ? "IDENTITY_ANOMALY" : "IDENTITY_OK";

  return {
    status,
    confidencePct,
    rhythm: {
      current_p90_ms: currentP90,
      baseline_p90_ms: baselineP90,
      alignment: Math.round(rhythmAlign * 10000) / 10000,
    },
    linguistic: {
      lexical_current: lexicalCurrent,
      lexical_baseline: lexicalBaseline,
      sentence_current: sentenceCurrent,
      sentence_baseline: sentenceBaseline,
      alignment_lexical: Math.round(alignmentLexical * 10000) / 10000,
      alignment_sentence: Math.round(alignmentSentence * 10000) / 10000,
    },
  };
}

/** Class wrapper for dependency injection / testing. */
export class VerificationFilter {
  constructor(private readonly options: Partial<VerifyIdentityOptions> = {}) {}

  verify(
    current: CurrentSessionMetrics,
    profile: ForensicProfileRow,
    overrides?: Partial<VerifyIdentityOptions>
  ): Promise<VerificationOutcome> {
    const merged: VerifyIdentityOptions = {
      tenantId: overrides?.tenantId ?? this.options.tenantId ?? profile.tenant_id,
      resolveSchoolEncryptionKey:
        overrides?.resolveSchoolEncryptionKey ?? this.options.resolveSchoolEncryptionKey,
      anomalyThresholdPct: overrides?.anomalyThresholdPct ?? this.options.anomalyThresholdPct,
    };
    if (!merged.tenantId) {
      throw new Error("verify: tenantId is required.");
    }
    return verifyIdentitySession(current, profile, merged);
  }
}
