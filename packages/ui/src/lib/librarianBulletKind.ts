/**
 * Client-side classification for Lore Librarian answers (aligned with server LibrarianChat prefixes).
 */

const UUID_RE =
  /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i;

export type LibrarianBulletKind = "canon" | "inference" | "plain";

/** Strip list markers and leading markdown asterisks (matches server `remainderForLabel` idea). */
export function stripLeadingBulletMarkers(line: string): string {
  let s = line.trim();
  s = s.replace(/^[-*•‧・]+\s*/, "");
  while (/^\*+/.test(s)) {
    s = s.replace(/^\*+\s*/, "");
  }
  return s.replace(/^[\s\u3000]+/, "").trim();
}

export function classifyLibrarianBulletLine(line: string): LibrarianBulletKind {
  if (!line.trim()) return "plain";
  const s = stripLeadingBulletMarkers(line);
  if (!s) return "plain";

  if (/^Canon\s*:/iu.test(s) || /^Canónic[oa]\s*:/iu.test(s)) return "canon";
  if (/^カノン/u.test(s) && /[:：]/.test(s)) return "canon";

  if (/^Scientific\s+Inference\s*:/iu.test(s)) return "inference";
  if (/^Inferencia\s+Científica\s*:/iu.test(s)) return "inference";
  if (/^科学的推論/u.test(s) && /[:：]/.test(s)) return "inference";
  if (/^科学推論/u.test(s)) return "inference";

  return "plain";
}

/** Pull a chunk UUID if the model echoed `id=<uuid>` or a bare UUID. */
export function extractChunkIdFromLibrarianLine(line: string): string | null {
  const idEq = line.match(/\bid\s*=\s*([0-9a-f-]{36})/i);
  if (idEq?.[1]) return idEq[1].toLowerCase();
  const bare = line.match(UUID_RE);
  return bare?.[1] ? bare[1].toLowerCase() : null;
}
