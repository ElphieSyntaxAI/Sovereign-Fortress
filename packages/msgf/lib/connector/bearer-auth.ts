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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Standard `Authorization: Bearer` helper — rotate keys via env/config only, not code changes.
 */

export function formatBearerAuthorization(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("MSGF Bearer token is required.");
  }
  if (/^bearer\s+/i.test(trimmed)) {
    return trimmed.replace(/^bearer\s+/i, "Bearer ");
  }
  return `Bearer ${trimmed}`;
}

/** Headers for contract-license or service-role calls (Bearer only). */
export function licenseBearerHeaders(
  licenseOrServiceToken: string,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    Authorization: formatBearerAuthorization(licenseOrServiceToken),
    ...extra,
  };
}
