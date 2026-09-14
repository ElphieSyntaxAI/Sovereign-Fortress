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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Fixed locale for SSR + client so formatted numbers/dates hydrate consistently.
 * (Browser default locale ≠ Node default locale is a common hydration mismatch.)
 */
export const MSGF_DISPLAY_LOCALE = "en-US" as const;

export function formatDisplayNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return value.toLocaleString(MSGF_DISPLAY_LOCALE, options);
}

export function formatDisplayDateTime(value: Date): string {
  if (Number.isNaN(value.getTime())) return "recently";
  return value.toLocaleString(MSGF_DISPLAY_LOCALE);
}
