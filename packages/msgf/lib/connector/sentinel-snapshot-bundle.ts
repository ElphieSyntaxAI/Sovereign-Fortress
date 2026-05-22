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
 * Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
 */
/**
 * Browser-safe Sentinel telemetry — localStorage bundle + biometric keystroke stats.
 */

import { DEFAULT_VAULT_SESSION_KEY } from "./session-store";

/** Keys (or prefixes) safe to include in diagnostic snapshots — no secrets. */
export const SENTINEL_LOCAL_STORAGE_ALLOWLIST = [
  DEFAULT_VAULT_SESSION_KEY,
  "msgf.",
  "author.",
  "supabase.",
] as const;

export type LocalStorageBundle = {
  vault_narrative_log_id: string | null;
  entries: Record<string, string>;
  key_count: number;
};

export type BiometricTelemetry = {
  keystrokes_last_10: Array<Record<string, unknown>>;
  sample_count: number;
  avg_flight_time_ms: number | null;
  avg_dwell_time_ms: number | null;
  backspace_count: number;
  paste_event_count: number;
  biometric_drift_suspected: boolean;
};

export type SentinelTelemetryBundle = {
  local_storage: LocalStorageBundle;
  biometric_telemetry: BiometricTelemetry;
};

function isAllowedLocalStorageKey(key: string): boolean {
  return SENTINEL_LOCAL_STORAGE_ALLOWLIST.some((allowed) =>
    allowed.endsWith(".") ? key.startsWith(allowed) : key === allowed
  );
}

function readLocalStorageBundle(
  storage?: Pick<Storage, "getItem" | "length" | "key">
): LocalStorageBundle {
  const entries: Record<string, string> = {};
  let vaultNarrativeLogId: string | null = null;

  if (!storage) {
    return { vault_narrative_log_id: null, entries, key_count: 0 };
  }

  try {
    vaultNarrativeLogId = storage.getItem(DEFAULT_VAULT_SESSION_KEY);
    const len = storage.length;
    for (let i = 0; i < len; i++) {
      const key = storage.key(i);
      if (!key || !isAllowedLocalStorageKey(key)) continue;
      const value = storage.getItem(key);
      if (value == null) continue;
      entries[key] = value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
    }
  } catch {
    /* private mode / quota */
  }

  return {
    vault_narrative_log_id: vaultNarrativeLogId,
    entries,
    key_count: Object.keys(entries).length,
  };
}

function computeBiometricTelemetry(
  keystrokes: Array<Record<string, unknown>>
): BiometricTelemetry {
  const flights = keystrokes
    .map((k) => k.flightTime)
    .filter((f): f is number => typeof f === "number" && f > 0);
  const dwells = keystrokes
    .map((k) => k.dwellTime)
    .filter((d): d is number => typeof d === "number" && d > 0);

  const avg = (nums: number[]) =>
    nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;

  const avgFlight = avg(flights);
  let biometricDriftSuspected = false;
  if (flights.length >= 4 && avgFlight != null) {
    biometricDriftSuspected = flights.some(
      (f) => Math.abs(f - avgFlight) / avgFlight > 0.35
    );
  }

  return {
    keystrokes_last_10: keystrokes.slice(-10),
    sample_count: keystrokes.length,
    avg_flight_time_ms: avgFlight,
    avg_dwell_time_ms: avg(dwells),
    backspace_count: keystrokes.filter((k) => k.isBackspace === true).length,
    paste_event_count: keystrokes.filter((k) => k.isSystemEvent === true).length,
    biometric_drift_suspected: biometricDriftSuspected,
  };
}

/**
 * Bundle session localStorage (allowlisted) + keystroke biometric telemetry for Sentinel snapshots.
 */
export function bundleSentinelTelemetry(params?: {
  keystrokes?: Array<Record<string, unknown>>;
  storage?: Pick<Storage, "getItem" | "length" | "key">;
}): SentinelTelemetryBundle {
  const keystrokes = params?.keystrokes ?? [];
  const storage =
    params?.storage ??
    (typeof globalThis !== "undefined" && "localStorage" in globalThis
      ? (globalThis as typeof globalThis & { localStorage: Storage }).localStorage
      : undefined);

  return {
    local_storage: readLocalStorageBundle(storage),
    biometric_telemetry: computeBiometricTelemetry(keystrokes),
  };
}
