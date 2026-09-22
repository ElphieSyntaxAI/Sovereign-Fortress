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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
export function parseJsonStripFences(text: string): unknown {
  let s = String(text || "").trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)```/im);
  if (m) s = m[1].trim();
  return JSON.parse(s) as unknown;
}
