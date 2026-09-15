/**
 * Supabase `public` names for HAL + forensics — must match `packages/msgf/supabase/migrations`.
 * Use these in `.from(...)` / RPC SQL instead of string literals to avoid drift from MSGF schema.
 */

/** Session ledger rows (keystrokes, stylometric snapshot, recalibration flags). */
export const P4_HAL_LEDGER = "p4_hal_ledger" as const;

/**
 * Rolling linguistic baseline view (recalibration-aware, last five sessions per tenant).
 * Canonical name — do not use `v_p4_hal_ledger_rolling_avg_5`.
 */
export const P4_HAL_LEDGER_ROLLING_AVG_5 = "p4_hal_ledger_rolling_avg_5" as const;

/** Forensic calibration payloads (author plaintext vs school ciphertext). */
export const P4_FORENSIC_PROFILES = "p4_forensic_profiles" as const;

/** HAL baseline reset audit (see `20260511100000_hal_recalibration_support.sql`). */
export const P4_RECALIBRATION_LOGS = "p4_recalibration_logs" as const;

/** Editor POEE / suggestion proof rows (see `20260524120000_p4_editor_ledger.sql`). */
export const P4_EDITOR_LEDGER = "p4_editor_ledger" as const;

/** Offline focus-mode HMAC leases (see `20260916010000_p4_hal_offline_sealed.sql`). */
export const P4_HAL_OFFLINE_LEASES = "p4_hal_offline_leases" as const;

/** Accepted sealed batch ids for replay protection. */
export const P4_HAL_OFFLINE_ACCEPTED_BATCHES = "p4_hal_offline_accepted_batches" as const;
