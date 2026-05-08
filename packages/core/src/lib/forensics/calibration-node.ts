import { createCipheriv, createHash, randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildCalibrationResult,
  type CalibrationLocale,
  type CalibrationResult,
  type TenantScope,
} from "./calibration-pure.js";

export type ProcessCalibrationOptions = {
  tenantId: string;
  /** Author = plaintext row; school_tenant = AES-256-GCM payload only (FERPA). */
  tenantScope: TenantScope;
  rawText: string;
  latencyMs: number[];
  /**
   * When `is_ime_session`, per-committed-string rhythm (ms). If set with length > 0, used for
   * `keystroke_fingerprint` instead of per-key `latencyMs`.
   */
  committedBlockLatenciesMs?: number[];
  /** Set when client reports IME composition. */
  is_ime_session?: boolean;
  /** Affects `rhythm_anomaly_threshold` and lexical tokenization in `CalibrationResult`. */
  locale?: CalibrationLocale;
  /**
   * Required when `tenantScope === 'school_tenant'`.
   * Return key material (hashed to 32 bytes) for AES-256-GCM.
   */
  resolveSchoolEncryptionKey?: (
    schoolTenantId: string
  ) => Buffer | Uint8Array | Promise<Buffer | Uint8Array>;
};

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function assertUuid(label: string, value: string): string {
  const v = value.trim();
  if (!UUID_RE.test(v)) {
    throw new Error(`${label} must be a valid UUID`);
  }
  return v;
}

function normalizeAesKey(material: Buffer | Uint8Array): Buffer {
  return createHash("sha256").update(Buffer.from(material)).digest();
}

function encryptCalibrationPayload(
  plaintextUtf8: string,
  keyMaterial: Buffer | Uint8Array
): { iv: string; tag: string; ciphertext: string; alg: string } {
  const key = normalizeAesKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintextUtf8, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: enc.toString("base64"),
  };
}

type ForensicStorageAuthor = {
  mode: "plaintext";
  calibration: CalibrationResult;
};

type ForensicStorageSchool = {
  mode: "ciphertext";
  alg: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

/**
 * Build calibration, optionally encrypt for school tenants, and insert into `p4_forensic_profiles`.
 * Uses the Supabase **service role** client (bypasses RLS). Call only from trusted servers.
 *
 * School path: requires `resolveSchoolEncryptionKey`; **no plaintext calibration is written** to the DB.
 */
export async function processCalibration(
  supabase: SupabaseClient,
  options: ProcessCalibrationOptions
): Promise<{ id: string; calibration: CalibrationResult; encrypted: boolean }> {
  const tenantId = assertUuid("tenantId", options.tenantId);
  const blocks = options.committedBlockLatenciesMs?.filter((n) => Number.isFinite(n) && n >= 0) ?? [];
  const rhythmMs =
    options.is_ime_session === true && blocks.length > 0 ? blocks : options.latencyMs;
  const calibration = buildCalibrationResult(options.rawText, rhythmMs, {
    locale: options.locale,
    is_ime_session: options.is_ime_session,
  });

  let storage: ForensicStorageAuthor | ForensicStorageSchool;
  let encrypted = false;

  if (options.tenantScope === "school_tenant") {
    const resolver = options.resolveSchoolEncryptionKey;
    if (!resolver) {
      throw new Error(
        "resolveSchoolEncryptionKey is required when tenantScope is school_tenant (FERPA)."
      );
    }
    const keyMaterial = await resolver(tenantId);
    const enc = encryptCalibrationPayload(JSON.stringify(calibration), keyMaterial);
    storage = { mode: "ciphertext", ...enc };
    encrypted = true;
  } else {
    storage = { mode: "plaintext", calibration };
  }

  const { data, error } = await supabase
    .from("p4_forensic_profiles")
    .insert({
      tenant_id: tenantId,
      tenant_scope: options.tenantScope === "school_tenant" ? "school" : "author",
      storage,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`p4_forensic_profiles insert failed: ${error.message}`);
  }

  return { id: data!.id as string, calibration, encrypted };
}

/**
 * Load a per-school symmetric key from env: `FERPA_SCHOOL_KEY_<TENANT_WITH_UNDERSCORES>` (hex).
 * Example tenant `11111111-1111-4111-8111-111111111111` → `FERPA_SCHOOL_KEY_11111111_1111_4111_8111_111111111111`.
 */
export function schoolEncryptionKeyFromEnv(schoolTenantId: string): Buffer {
  const suffix = schoolTenantId.trim().replace(/-/g, "_").toUpperCase();
  const envKey = `FERPA_SCHOOL_KEY_${suffix}`;
  const hex = process.env[envKey]?.trim();
  if (!hex) {
    throw new Error(`Missing ${envKey} (64 hex chars = 32-byte AES key recommended)`);
  }
  return Buffer.from(hex, "hex");
}
