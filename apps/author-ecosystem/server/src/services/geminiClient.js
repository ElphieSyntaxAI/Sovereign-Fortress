/** API key auth — matches `packages/msgf/.env.local` (GCP_API_KEY + GCP_MODEL_ID). */
function resolveGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GCP_API_KEY?.trim() ||
    ""
  );
}

/** Chat model id — `GCP_MODEL_ID` is the MSGF convention; legacy: GEMINI_CHAT_MODEL / GEMINI_MODEL. */
function resolveGeminiChatModel(override) {
  if (override) return override;
  return (
    process.env.GCP_MODEL_ID?.trim() ||
    process.env.GEMINI_CHAT_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.0-flash"
  );
}

function hasGeminiCredentials() {
  return Boolean(resolveGeminiApiKey());
}

let _clientPromise = null;

async function getClient() {
  if (!_clientPromise) {
    _clientPromise = (async () => {
      const apiKey = resolveGeminiApiKey();
      if (!apiKey) {
        throw new Error(
          "Missing Gemini API key — set GCP_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY"
        );
      }

      // @google/genai is ESM-first; dynamic import works in CommonJS.
      const { GoogleGenAI } = await import("@google/genai");
      return new GoogleGenAI({ apiKey });
    })();
  }
  return _clientPromise;
}

function toFloatArray(value) {
  if (!Array.isArray(value)) return null;
  const out = new Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const n = Number(value[i]);
    out[i] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

async function embedTexts(texts, { model }) {
  const ai = await getClient();
  const embeddingModel = model || process.env.GEMINI_EMBED_MODEL || "text-embedding-004";

  const results = [];
  for (const text of texts) {
    const resp = await ai.models.embedContent({
      model: embeddingModel,
      contents: [{ role: "user", parts: [{ text: String(text || "") }] }],
    });

    const values =
      resp?.embeddings?.[0]?.values ||
      resp?.embedding?.values ||
      resp?.embeddings?.values;

    const vec = toFloatArray(values);
    if (!vec) {
      throw new Error("Gemini embedContent response missing embedding values");
    }
    results.push(vec);
  }
  return results;
}

async function generateBullets({ system, user, model }) {
  const ai = await getClient();
  const chatModel = resolveGeminiChatModel(model);

  const resp = await ai.models.generateContent({
    model: chatModel,
    systemInstruction: system,
    contents: [{ role: "user", parts: [{ text: user }] }],
  });

  const text = resp?.text;
  if (!text) throw new Error("Gemini generateContent returned empty text");
  return String(text);
}

module.exports = {
  embedTexts,
  generateBullets,
  hasGeminiCredentials,
  resolveGeminiApiKey,
  resolveGeminiChatModel,
};

