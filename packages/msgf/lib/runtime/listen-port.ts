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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
import { MSGF_DEV_DEFAULT_PORT } from "./msgf-dev-defaults";

/** Default when `PORT` is unset or invalid (local dev). Cloud Run always sets `PORT`. */
const MSGF_DEFAULT_PORT = MSGF_DEV_DEFAULT_PORT;

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
