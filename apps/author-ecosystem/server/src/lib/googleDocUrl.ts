/** Extract Google Docs document id from a share or edit URL. */
export function extractGoogleDocId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

export function normalizeGoogleDocUrl(url: string): string {
  const id = extractGoogleDocId(url);
  if (!id) return url.trim();
  return `https://docs.google.com/document/d/${id}/edit`;
}
