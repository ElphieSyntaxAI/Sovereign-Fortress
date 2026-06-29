import { getPreferredBffBearer } from "./authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "./bffFetch";

export type WikiChunkRow = {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export async function fetchWikiChunks(manuscriptId: string): Promise<WikiChunkRow[]> {
  const token = await getPreferredBffBearer();
  const res = await fetch(bffUrl(`/api/wiki/${encodeURIComponent(manuscriptId)}/chunks`), {
    ...bffCredentials,
    headers: bffAuthHeaders(token),
  });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => ({}))) as { chunks?: WikiChunkRow[] };
  return Array.isArray(json.chunks) ? json.chunks : [];
}

export function titleForWikiChunk(content: string, meta?: Record<string, unknown>): string {
  const fromMeta = String(meta?.proposed_chunk_title ?? "").trim();
  if (fromMeta) return fromMeta;
  const m = content.match(/^##\s+(.+)$/m);
  if (m?.[1]) return m[1].trim();
  return content.split("\n")[0]?.trim().slice(0, 80) || "Wiki entry";
}
