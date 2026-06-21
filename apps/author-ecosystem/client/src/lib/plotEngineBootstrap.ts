import { applyFileImportToPlotEngine } from "../components/PlotEnginePanel";
import { bffAuthHeaders, bffCredentials, bffUrl } from "./bffFetch";
import { loadPlotEngineState } from "./plotEngineStorage";

type WikiChunk = {
  id: string;
  content: string;
  metadata?: { outline_entity_kind?: string; proposed_chunk_title?: string };
};

function excerptFromWikiContent(content: string): string {
  const lines = content.split("\n");
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.startsWith("## ")) bodyStart = i + 1;
    if (lines[i]?.trim() === "" && bodyStart > 0) {
      bodyStart = i + 1;
      break;
    }
  }
  return (
    lines
      .slice(bodyStart)
      .filter((l) => !l.startsWith("**chunk_type:") && !l.startsWith("**tags:"))
      .join("\n")
      .trim() || content.trim()
  );
}

function titleForChunk(c: WikiChunk): string {
  const meta = c.metadata ?? {};
  const fromMeta = String(meta.proposed_chunk_title ?? "").trim();
  if (fromMeta) return fromMeta;
  const m = c.content.match(/^##\s+(.+)$/m);
  if (m?.[1]) return m[1].trim();
  return excerptFromWikiContent(c.content).split("\n")[0]?.trim().slice(0, 80) || "Wiki entry";
}

/** Pull committed wiki rows into Plot Sandbox token pools when local state is empty. */
export async function bootstrapPlotEngineFromWiki(
  manuscriptId: string,
  getToken?: () => string | null | Promise<string | null>
): Promise<boolean> {
  const existing = loadPlotEngineState(manuscriptId);
  const hasTokens = existing
    ? Object.values(existing.globalRepos).some((pool) => pool.length > 0)
    : false;
  const hasBeats = (existing?.plotPoints.length ?? 0) > 0;
  if (hasTokens && hasBeats) return false;

  const token = getToken ? await getToken() : null;
  const res = await fetch(bffUrl(`/api/wiki/${encodeURIComponent(manuscriptId)}/chunks`), {
    ...bffCredentials,
    headers: bffAuthHeaders(token),
  });
  if (!res.ok) return false;
  const json = (await res.json().catch(() => ({}))) as { chunks?: WikiChunk[] };
  const chunks = Array.isArray(json.chunks) ? json.chunks : [];
  if (chunks.length === 0) return false;

  const proposed = chunks.map((c) => ({
    title: titleForChunk(c),
    excerpt: excerptFromWikiContent(c.content),
    chunk_type: String(c.metadata?.outline_entity_kind ?? "note"),
    wiki_metadata: c.metadata,
  }));

  applyFileImportToPlotEngine(manuscriptId, proposed, []);
  return true;
}
