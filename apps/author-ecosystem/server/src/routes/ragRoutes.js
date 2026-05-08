const express = require("express");
const crypto = require("crypto");
const db = require("../config/dbConfig");
const { verifyToken } = require("../middleware/verifyTokens");
const { chunkByChars } = require("../services/ragChunker");
const { embedTexts, generateBullets } = require("../services/geminiClient");

const router = express.Router();

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s || ""), "utf8").digest("hex");
}

function toSqlVectorLiteral(vec) {
  // pgvector accepts '[1,2,3]' as a literal.
  return `[${vec.map((n) => (Number.isFinite(n) ? n : 0)).join(",")}]`;
}

function enforceBulletOnlyCanonInference(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const bulletish = lines.filter((l) => /^[-*•]\s+/.test(l) || /^(Canon|Scientific Inference):/i.test(l));
  if (bulletish.length === 0) {
    throw new Error("Model output was not bullet points");
  }

  for (const l of bulletish) {
    const cleaned = l.replace(/^[-*•]\s+/, "");
    if (!/^(Canon|Scientific Inference):/i.test(cleaned)) {
      throw new Error("Each bullet must start with 'Canon:' or 'Scientific Inference:'");
    }
  }

  // Return normalized bullets with "-" prefix.
  return bulletish
    .map((l) => l.replace(/^[-*•]\s+/, ""))
    .map((l) => `- ${l}`)
    .join("\n");
}

function validateAudience(audience) {
  if (audience !== "fan" && audience !== "author") {
    const err = new Error("Invalid audience. Must be 'fan' or 'author'.");
    err.status = 400;
    throw err;
  }
  return audience;
}

function validateSourceType(sourceType) {
  const allowed = ["world_bible", "character_bible", "story_outline", "theme_sheet"];
  if (!allowed.includes(sourceType)) {
    const err = new Error(`Invalid source_type. Must be one of: ${allowed.join(", ")}`);
    err.status = 400;
    throw err;
  }
  return sourceType;
}

// POST /api/rag/ingest
// Body: { project_id?: uuid, title, source_type, audience, text }
router.post("/ingest", verifyToken, async (req, res, next) => {
  try {
    const authorUserId = req.user.user_id;
    const { project_id = null, title, source_type, audience, text } = req.body || {};

    if (!title || !text || !source_type || !audience) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["title", "source_type", "audience", "text"],
      });
    }

    const audienceV = validateAudience(audience);
    const sourceTypeV = validateSourceType(source_type);

    // Hard safety rule: outline/theme are author-only.
    if ((sourceTypeV === "story_outline" || sourceTypeV === "theme_sheet") && audienceV !== "author") {
      return res.status(400).json({
        error: "Invalid audience for source_type",
        message: "story_outline and theme_sheet must be audience='author'",
      });
    }

    const chunks = chunkByChars(text, { chunkSize: 1800, overlap: 200 });
    if (chunks.length === 0) {
      return res.status(400).json({ error: "Text produced no chunks" });
    }

    const [sourceRow] = (
      await db.query(
        `INSERT INTO rag_sources (author_user_id, project_id, source_type, audience, title)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING source_id`,
        [authorUserId, project_id, sourceTypeV, audienceV, title]
      )
    ).rows;

    const sourceId = sourceRow.source_id;

    const embeddings = await embedTexts(chunks, {});

    let inserted = 0;
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      const contentHash = sha256Hex(`${authorUserId}|${project_id || ""}|${audienceV}|${content}`);
      const embedding = embeddings[i];

      // Skip if embedding dims mismatch our schema (vector(768))
      if (embedding.length !== 768) {
        const err = new Error(`Embedding dimension mismatch: got ${embedding.length}, expected 768`);
        err.status = 500;
        throw err;
      }

      const embeddingLiteral = toSqlVectorLiteral(embedding);

      const result = await db.query(
        `INSERT INTO rag_chunks
          (source_id, author_user_id, project_id, audience, chunk_index, content, content_hash, embedding, metadata)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9::jsonb)
         ON CONFLICT (author_user_id, project_id, audience, content_hash) DO NOTHING`,
        [
          sourceId,
          authorUserId,
          project_id,
          audienceV,
          i,
          content,
          contentHash,
          embeddingLiteral,
          JSON.stringify({ source_type: sourceTypeV, title }),
        ]
      );
      inserted += result.rowCount || 0;
    }

    return res.status(201).json({
      success: true,
      source_id: sourceId,
      chunks_total: chunks.length,
      chunks_inserted: inserted,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/rag/chat
// Body: { project_id?: uuid, audience: "fan"|"author", question: string, top_k?: number }
router.post("/chat", verifyToken, async (req, res, next) => {
  try {
    const authorUserId = req.user.user_id;
    const { project_id = null, audience, question, top_k } = req.body || {};

    if (!audience || !question) {
      return res.status(400).json({ error: "Missing required fields", required: ["audience", "question"] });
    }
    const audienceV = validateAudience(audience);
    const topK = Math.max(1, Math.min(Number(top_k || process.env.RAG_TOP_K || 8), 20));

    const [qVec] = await embedTexts([question], {});
    if (qVec.length !== 768) {
      const err = new Error(`Embedding dimension mismatch: got ${qVec.length}, expected 768`);
      err.status = 500;
      throw err;
    }

    const qLiteral = toSqlVectorLiteral(qVec);

    const rows = (
      await db.query(
        `SELECT chunk_id, content, metadata,
                1 - (embedding <=> $4::vector) AS cosine_similarity
           FROM rag_chunks
          WHERE author_user_id = $1
            AND (project_id = $2 OR ($2 IS NULL AND project_id IS NULL))
            AND audience = $3
          ORDER BY embedding <=> $4::vector
          LIMIT ${topK}`,
        [authorUserId, project_id, audienceV, qLiteral]
      )
    ).rows;

    const canonContext = rows
      .map((r) => {
        const meta = r.metadata || {};
        const label = `${meta.source_type || "unknown"}: ${meta.title || "Untitled"}`;
        return `- [${label}] chunk_id=${r.chunk_id} sim=${Number(r.cosine_similarity || 0).toFixed(3)}\n${r.content}`;
      })
      .join("\n\n");

    const system = [
      "You are the Lore Librarian for an Author Ecosystem RAG system.",
      "Output MUST be bullet points only.",
      "Every bullet MUST begin with exactly one of these labels: 'Canon:' or 'Scientific Inference:'.",
      "Canon rules:",
      "- Canon bullets must be supported by the provided Canon Context only.",
      "- If canon is missing, say so in Canon bullets (do not invent story facts).",
      "Scientific Inference rules:",
      "- Only use scientific/mathematical/real-world knowledge to make logical inferences.",
      "- Never invent new canon facts, names, events, locations, or character details.",
      "- If an inference depends on unknown canon values, state assumptions explicitly in the inference bullet.",
    ].join("\n");

    const user = [
      `Audience Mode: ${audienceV}`,
      "",
      "Question:",
      String(question),
      "",
      "Canon Context:",
      canonContext || "(none found)",
      "",
      "Answer now.",
    ].join("\n");

    const raw = await generateBullets({ system, user });
    const bullets = enforceBulletOnlyCanonInference(raw);

    return res.status(200).json({
      success: true,
      answer: bullets,
      retrieved_chunks: rows.map((r) => ({
        chunk_id: r.chunk_id,
        cosine_similarity: Number(r.cosine_similarity || 0),
        metadata: r.metadata || {},
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

