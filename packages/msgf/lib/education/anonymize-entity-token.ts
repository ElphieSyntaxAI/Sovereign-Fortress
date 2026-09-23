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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * Shared anonymous student labels for parent digest + classroom board.
 * Never display legal names — only privacy tokens / Student_* stamps.
 */
export function anonymizeEntityToken(token: string): string {
  const t = token.trim();
  if (!t) return "Student_unknown";
  if (t.startsWith("Student_")) return t;
  if (t.startsWith("tok_anon_")) return `Student_${t.slice(-6)}`;
  return `Student_${t.slice(0, 6)}`;
}
