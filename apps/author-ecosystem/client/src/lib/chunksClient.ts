import { bffAuthHeaders, bffCredentials, bffUrl } from "./bffFetch";

export type ChunkCompositeKey = {
  source_document: string;
  chunk_type: "lore" | "plot" | "character";
  chunk_index: number;
};

export async function patchChunkUpdate(
  params: ChunkCompositeKey & {
    updated_content: string;
    manuscript_id?: string;
    updated_metadata?: Record<string, unknown>;
    getAccessToken?: () => string | null | Promise<string | null>;
  }
): Promise<{ success: boolean; chunk?: unknown; error?: string }> {
  const token = params.getAccessToken ? await params.getAccessToken() : null;
  const res = await fetch(bffUrl("/api/chunks/update"), {
    method: "PATCH",
    ...bffCredentials,
    headers: {
      "Content-Type": "application/json",
      ...bffAuthHeaders(token),
    },
    body: JSON.stringify({
      source_document: params.source_document,
      chunk_type: params.chunk_type,
      chunk_index: params.chunk_index,
      updated_content: params.updated_content,
      manuscript_id: params.manuscript_id,
      updated_metadata: params.updated_metadata,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { success: false, error: String(json.error ?? res.statusText) };
  }
  return { success: true, chunk: json.chunk };
}
