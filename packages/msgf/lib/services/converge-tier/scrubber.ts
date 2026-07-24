/**
 * @msgf-license-header
 * Scrub API key patterns from converge logs/errors (Part B3).
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
