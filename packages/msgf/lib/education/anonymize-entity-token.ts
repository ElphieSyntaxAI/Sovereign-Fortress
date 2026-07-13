/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
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
