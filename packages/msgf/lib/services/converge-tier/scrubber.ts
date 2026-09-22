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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
const KEY_PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9]{8,}\b/g,
  /\bgsk_[a-zA-Z0-9]{8,}\b/g,
  /\bAIza[a-zA-Z0-9_-]{20,}\b/g,
  /\bBearer\s+[a-zA-Z0-9._-]{20,}\b/gi,
];

export function scrubConvergeLogText(text: string): string {
  let out = text;
  for (const re of KEY_PATTERNS) {
    out = out.replace(re, "[REDACTED_KEY]");
  }
  return out;
}

export function assertNoRawKeysInLog(text: string): boolean {
  for (const re of KEY_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) return false;
  }
  return true;
}
