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
/** Default when `PORT` is unset or invalid (local dev). Cloud Run always sets `PORT`. */
const MSGF_DEFAULT_PORT = 3000;

/**
 * Resolve the HTTP listen port from `process.env.PORT` (required on GCP Cloud Run).
 */
export function resolveListenPort(): number {
  const raw = process.env.PORT?.trim();
  if (!raw) return MSGF_DEFAULT_PORT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65_535) {
    return MSGF_DEFAULT_PORT;
  }
  return n;
}
