export type EmbedBatchFn = (texts: string[]) => Promise<number[][]>;

export const NARRATIVE_EMBEDDING_DIM = 1536;
const DEFAULT_OPENAI_EMBED_MODEL = "text-embedding-3-small";

function resolveGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GCP_API_KEY?.trim() ||
    ""
  );
}

function l2Normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (const x of vec) sumSq += x * x;
  const norm = Math.sqrt(sumSq);
  if (!norm || !Number.isFinite(norm)) return vec;
  return vec.map((x) => x / norm);
}

function extractEmbeddingValues(resp: unknown): number[] | null {
  if (!resp || typeof resp !== "object") return null;
  const r = resp as {
    embeddings?: Array<{ values?: number[] }>;
    embedding?: { values?: number[] };
  };
  const fromList = r.embeddings?.[0]?.values;
  if (fromList?.length) return fromList.map((v) => Number(v));
  const fromSingle = r.embedding?.values;
  if (fromSingle?.length) return fromSingle.map((v) => Number(v));
  return null;
}

/** OpenAI text-embedding-3-small (1536-dim). */
export function createOpenAIEmbedder(
  model = process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_OPENAI_EMBED_MODEL
): EmbedBatchFn {
  return async (texts: string[]) => {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) {
      throw new Error("OPENAI_API_KEY is required to embed narrative chunks");
    }
    if (texts.length === 0) return [];

    const batchSize = 48;
    const all: number[][] = [];

    for (let offset = 0; offset < texts.length; offset += batchSize) {
      const batch = texts.slice(offset, offset + batchSize);
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, input: batch }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenAI embeddings failed (${res.status}): ${errBody.slice(0, 500)}`);
      }

      const json = (await res.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };
      const sorted = [...json.data].sort((a, b) => a.index - b.index);
      for (const row of sorted) {
        if (!row.embedding || row.embedding.length !== NARRATIVE_EMBEDDING_DIM) {
          throw new Error(
            `Embedding dimension mismatch: expected ${NARRATIVE_EMBEDDING_DIM}, got ${row.embedding?.length ?? 0} (model ${model})`
          );
        }
        all.push(row.embedding);
      }
    }

    return all;
  };
}

/** Gemini gemini-embedding-001 truncated to 1536-dim (matches p4_narrative_library_chunks). */
export function createGeminiNarrativeEmbedder(
  dim = NARRATIVE_EMBEDDING_DIM
): EmbedBatchFn {
  return async (texts: string[]) => {
    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
      throw new Error("GCP_API_KEY (or GEMINI_API_KEY) is required for Gemini embeddings");
    }
    if (texts.length === 0) return [];

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_EMBED_MODEL?.trim() || "gemini-embedding-001";
    const out: number[][] = [];

    for (const text of texts) {
      const resp = await ai.models.embedContent({
        model,
        contents: [{ role: "user", parts: [{ text: String(text || "") }] }],
        config: {
          outputDimensionality: dim,
          taskType: "RETRIEVAL_DOCUMENT",
        },
      });
      const raw = extractEmbeddingValues(resp);
      if (!raw?.length) {
        throw new Error("Gemini embedContent returned no embedding values");
      }
      if (raw.length !== dim) {
        throw new Error(`Gemini embedding dimension ${raw.length}, expected ${dim}`);
      }
      out.push(dim === 3072 ? raw : l2Normalize(raw));
    }

    return out;
  };
}

/**
 * Prefer OpenAI when configured; otherwise use Gemini (GCP_API_KEY already on Cloud Run).
 */
export function createDefaultNarrativeEmbedder(): EmbedBatchFn {
  if (process.env.OPENAI_API_KEY?.trim()) return createOpenAIEmbedder();
  if (resolveGeminiApiKey()) return createGeminiNarrativeEmbedder();
  throw new Error(
    "Set OPENAI_API_KEY or GCP_API_KEY/GEMINI_API_KEY to embed narrative chunks for Librarian sync."
  );
}

export function narrativeEmbedderProvider(): "openai" | "gemini" | "none" {
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (resolveGeminiApiKey()) return "gemini";
  return "none";
}
