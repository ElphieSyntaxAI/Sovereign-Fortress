import { getPreferredBffBearer } from "./authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "./bffFetch";
import type { HumanEffortClient } from "./wikiDraftStore";

export type WikiEntryPayload = {
  title: string;
  excerpt: string;
  chunk_type: string;
  tags: string[];
  wiki_metadata: Record<string, unknown>;
  human_effort?: HumanEffortClient | null;
};

async function wikiJson(path: string, init?: RequestInit) {
  const token = await getPreferredBffBearer();
  const res = await fetch(bffUrl(path), {
    ...bffCredentials,
    ...init,
    headers: {
      ...bffAuthHeaders(token),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

export async function commitWikiEntry(manuscriptId: string, payload: WikiEntryPayload) {
  return wikiJson(`/api/wiki/${encodeURIComponent(manuscriptId)}/entries`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWikiEntry(
  manuscriptId: string,
  chunkId: string,
  payload: WikiEntryPayload
) {
  return wikiJson(
    `/api/wiki/${encodeURIComponent(manuscriptId)}/entries/${encodeURIComponent(chunkId)}`,
    { method: "PATCH", body: JSON.stringify(payload) }
  );
}

export async function scrapWikiEntry(
  manuscriptId: string,
  chunkId: string,
  human_effort?: HumanEffortClient | null
) {
  return wikiJson(
    `/api/wiki/${encodeURIComponent(manuscriptId)}/entries/${encodeURIComponent(chunkId)}/scrap`,
    { method: "POST", body: JSON.stringify({ human_effort }) }
  );
}

export async function restoreWikiEntry(manuscriptId: string, chunkId: string) {
  return wikiJson(
    `/api/wiki/${encodeURIComponent(manuscriptId)}/entries/${encodeURIComponent(chunkId)}/restore`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export async function fetchScrappedWiki(manuscriptId: string) {
  return wikiJson(`/api/wiki/${encodeURIComponent(manuscriptId)}/scrapped`) as Promise<{
    scrapped: Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      created_at: string;
    }>;
  }>;
}
