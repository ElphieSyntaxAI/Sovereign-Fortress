/**
 * Lore-Git middleware: post-chapter librarian interview → wiki_snapshot rows in rag_chunks.
 * Draft snapshots stay audience=author until POST /publish-wiki hard-locks (fan + canon metadata).
 */
const express = require("express");
const crypto = require("crypto");
const db = require("../lib/databaseUrlPool.cjs");
const { verifyToken } = require("../middleware/verifyTokens");
const { chunkByChars } = require("../services/ragChunker");
const { embedTexts, generateBullets } = require("../services/geminiClient");
const { analyzeChapterSubmission } = require("../services/halStylisticAnalyzer");
const { fetchLatestHudAnswerForProject } = require("../services/hudHistory");

const router = express.Router();

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s || ""), "utf8").digest("hex");
}

function toSqlVectorLiteral(vec) {
  return `[${vec.map((n) => (Number.isFinite(n) ? n : 0)).join(",")}]`;
}

/**
 * @param {unknown} sm
 * @returns {{ ok: boolean, error?: string }}
 */
function validateStylisticMetadata(sm) {
  if (!sm || typeof sm !== "object" || Array.isArray(sm)) {
    return { ok: false, error: "stylistic_metadata must be an object (HAL-derived voice proof)" };
  }
  if (sm.pet_phrases != null && !Array.isArray(sm.pet_phrases)) {
    return { ok: false, error: "stylistic_metadata.pet_phrases must be an array of strings when present" };
  }
  if (sm.pet_phrases != null) {
    for (const p of sm.pet_phrases) {
      if (typeof p !== "string") return { ok: false, error: "stylistic_metadata.pet_phrases entries must be strings" };
    }
  }
  if (sm.sentence_complexity != null && (typeof sm.sentence_complexity !== "object" || Array.isArray(sm.sentence_complexity))) {
    return { ok: false, error: "stylistic_metadata.sentence_complexity must be an object when present" };
  }
  return { ok: true };
}

function buildWikiSnapshotMetadata({
  title,
  chapterId,
  plotPoint,
  plotPointOrder,
  spoilerLevel,
  stylisticMetadata,
  halSessionId,
}) {
  const meta = {
    source_type: "world_bible",
    title,
    ledger: "wiki_snapshot",
    wiki_visibility: "draft",
    wiki_hard_locked: false,
    wiki_chapter_id: chapterId != null ? String(chapterId) : null,
    spoiler_level: spoilerLevel || "low",
    plot_point: plotPoint || "not_applicable",
    plot_point_order: plotPointOrder != null ? Number(plotPointOrder) : null,
    tags: [{ name: "LoreGit", value: "wiki_snapshot" }],
    stylistic_metadata: stylisticMetadata,
    ...(halSessionId ? { hal_session_id: String(halSessionId) } : {}),
  };
  if (meta.plot_point_order == null && meta.plot_point && meta.plot_point !== "not_applicable") {
    const map = {
      hook: 1,
      inciting_incident: 2,
      internal_pivot: 3,
      point_of_no_return: 4,
      midpoint: 5,
      deepdive_aha: 6,
      climax: 7,
      twist: 8,
      resolution: 9,
      parallel_arc: 10,
      not_applicable: 0,
    };
    if (map[meta.plot_point] != null) meta.plot_point_order = map[meta.plot_point];
  }
  return meta;
}

async function generateLibrarianInterviewQuestions(chapterText, chapterTitle) {
  const system = [
    "You are the Lore Librarian running a post-chapter interview.",
    "Output exactly 3 numbered lines: 1. ... 2. ... 3. ...",
    "Each question should help extract NEW canon-safe lore (locations, rules, objects, relationships) implied by the chapter without inventing facts not grounded in the excerpt.",
    "Questions must be answerable by the author in plain text; no multi-part essays.",
  ].join("\n");

  const user = [
    `Chapter title: ${chapterTitle || "(untitled)"}`,
    "",
    "Chapter excerpt (may be truncated):",
    String(chapterText || "").slice(0, 12000),
  ].join("\n");

  const raw = await generateBullets({ system, user });
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const questions = [];
  for (const line of lines) {
    const m = line.match(/^[0-9]+[\).\s]\s*(.+)$/);
    if (m) questions.push(m[1].trim());
  }
  if (questions.length < 3) {
    const fallback = [
      "What new proper nouns, places, or factions appear in this chapter that should enter the wiki?",
      "What explicit rule, taboo, or in-world law is stated or implied that readers must not forget later?",
      "What object, artifact, or technology is introduced that needs a stable description for continuity?",
    ];
    while (questions.length < 3) questions.push(fallback[questions.length]);
  }
  return questions.slice(0, 3);
}

/**
 * Insert rag_sources + rag_chunks for wiki_snapshot lore (audience author until publish).
 */
async function insertWikiSnapshotChunks({
  authorUserId,
  project_id,
  title,
  text,
  metadataBase,
}) {
  const sourceType = "world_bible";
  const audience = "author";
  const chunks = chunkByChars(text, { chunkSize: 1800, overlap: 200 });
  if (chunks.length === 0) throw new Error("Wiki snapshot text produced no chunks");

  const [sourceRow] = (
    await db.query(
      `INSERT INTO rag_sources (author_user_id, project_id, source_type, audience, title)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING source_id`,
      [authorUserId, project_id, sourceType, audience, title]
    )
  ).rows;

  const sourceId = sourceRow.source_id;
  const embeddings = await embedTexts(chunks, {});

  let inserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const contentHash = sha256Hex(`${authorUserId}|${project_id || ""}|${audience}|${content}`);
    const embedding = embeddings[i];
    if (embedding.length !== 768) {
      throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected 768`);
    }
    const embeddingLiteral = toSqlVectorLiteral(embedding);
    const metadata = { ...metadataBase, chunk_index_hint: i };
    const result = await db.query(
      `INSERT INTO msgf_legacy_rag_chunks
        (source_id, author_user_id, project_id, audience, chunk_index, content, content_hash, embedding, metadata)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9::jsonb)
        ON CONFLICT (author_user_id, project_id, audience, content_hash) DO NOTHING`,
      [
        sourceId,
        authorUserId,
        project_id,
        audience,
        i,
        content,
        contentHash,
        embeddingLiteral,
        JSON.stringify(metadata),
      ]
    );
    inserted += result.rowCount || 0;
  }

  return { source_id: sourceId, chunks_total: chunks.length, chunks_inserted: inserted };
}

// POST /api/lore-git/post-chapter — after chapter save; returns 3 interview questions + fingerprint
router.post("/post-chapter", verifyToken, async (req, res, next) => {
  try {
    const { chapter_text, chapter_title, chapter_id } = req.body || {};
    if (!chapter_text || String(chapter_text).trim().length < 20) {
      return res.status(400).json({ error: "chapter_text required (min 20 chars)" });
    }
    const title = chapter_title != null ? String(chapter_title) : "Untitled chapter";
    const questions = await generateLibrarianInterviewQuestions(String(chapter_text), title);
    const chapter_fingerprint = sha256Hex(
      JSON.stringify({
        author: req.user.user_id,
        chapter_id: chapter_id != null ? String(chapter_id) : null,
        text: String(chapter_text),
      })
    );

    return res.status(200).json({
      success: true,
      interview_questions: questions,
      chapter_fingerprint,
      chapter_id: chapter_id != null ? String(chapter_id) : null,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/lore-git/commit — author answers + stylistic proof → rag_chunks (wiki_snapshot / draft)
// Alternate: { lore_extraction_commit: true, proposed_chunk, project_id?, stylistic_metadata? } — single extracted chunk.
router.post("/commit", verifyToken, async (req, res, next) => {
  try {
    const authorUserId = req.user.user_id;
    const body = req.body || {};

    const loreExtractionCommit =
      body.lore_extraction_commit === true ||
      String(body.lore_extraction_commit || "").toLowerCase() === "true";
    const proposedChunk = body.proposed_chunk;

    if (loreExtractionCommit) {
      const project_id = body.project_id != null ? body.project_id : null;
      const stylistic_metadata = body.stylistic_metadata != null ? body.stylistic_metadata : {};

      if (!proposedChunk || typeof proposedChunk !== "object" || Array.isArray(proposedChunk)) {
        return res.status(400).json({ error: "proposed_chunk object is required when lore_extraction_commit is true" });
      }

      const title = String(proposedChunk.title ?? "").trim();
      const excerpt = String(proposedChunk.excerpt ?? "").trim();
      const chunk_type = String(proposedChunk.chunk_type ?? "other").trim().toLowerCase() || "other";
      let tags = [];
      if (Array.isArray(proposedChunk.tags)) {
        tags = proposedChunk.tags.map((t) => String(t).trim()).filter(Boolean);
      } else if (typeof proposedChunk.tags === "string" && proposedChunk.tags.trim()) {
        tags = proposedChunk.tags
          .split(/[,;]+/)
          .map((t) => t.trim())
          .filter(Boolean);
      }

      if (!title) return res.status(400).json({ error: "proposed_chunk.title required" });
      if (excerpt.length < 20) {
        return res.status(400).json({ error: "proposed_chunk.excerpt must be at least 20 characters" });
      }

      const smCheck = validateStylisticMetadata(stylistic_metadata);
      if (!smCheck.ok) return res.status(400).json({ error: smCheck.error });

      const interview_answers = [
        "Lore extraction (approved chunk — Planning Command Center).",
        `Chunk type: ${chunk_type}`,
        `Tags: ${tags.length ? tags.join(", ") : "(none)"}`,
      ];

      const snapshotBody = [
        "# Lore extraction (approved)",
        `## ${title}`,
        `**chunk_type:** ${chunk_type}`,
        `**tags:** ${tags.length ? tags.join(", ") : "(none)"}`,
        "",
        excerpt,
      ].join("\n");

      const analysisPack = analyzeChapterSubmission({
        chapterText: excerpt,
        hudAnswerBullets: null,
        stylisticMetadata: stylistic_metadata,
      });

      const wikiTitle = `Lore extraction — ${title}`;
      const metadataBase = {
        ...buildWikiSnapshotMetadata({
          title: wikiTitle,
          chapterId: null,
          plotPoint: "not_applicable",
          plotPointOrder: 0,
          spoilerLevel: "low",
          stylisticMetadata: stylistic_metadata,
          halSessionId: body.hal_session_id,
        }),
        lore_extraction: true,
        lore_extraction_chunk_type: chunk_type,
        lore_extraction_tags: tags,
        proposed_chunk_title: title,
      };

      const result = await insertWikiSnapshotChunks({
        authorUserId,
        project_id,
        title: wikiTitle,
        text: snapshotBody,
        metadataBase,
      });

      return res.status(201).json({
        success: true,
        ...result,
        ledger: "wiki_snapshot",
        wiki_visibility: "draft",
        audience: "author",
        lore_extraction_commit: true,
        authorship_delta_score: analysisPack.authorship_delta_score,
        stylistic_analysis_version: analysisPack.stylistic_analysis_version,
        stylistic_analysis: analysisPack.stylistic_analysis,
      });
    }

    const {
      project_id = null,
      chapter_id,
      chapter_title,
      chapter_text,
      interview_answers,
      chapter_fingerprint,
      stylistic_metadata,
      hal_session_id,
      plot_point: plotPoint,
      plot_point_order: plotPointOrder,
      spoiler_level: spoilerLevel,
      hud_answer,
      hud_answer_bullets,
    } = body;

    if (!chapter_text || String(chapter_text).trim().length < 20) {
      return res.status(400).json({ error: "chapter_text required" });
    }
    if (!Array.isArray(interview_answers) || interview_answers.length !== 3) {
      return res.status(400).json({ error: "interview_answers must be an array of exactly 3 strings" });
    }
    for (const a of interview_answers) {
      if (typeof a !== "string" || !a.trim()) {
        return res.status(400).json({ error: "Each interview_answers entry must be a non-empty string" });
      }
    }

    const smCheck = validateStylisticMetadata(stylistic_metadata);
    if (!smCheck.ok) return res.status(400).json({ error: smCheck.error });

    if (chapter_fingerprint) {
      const expected = sha256Hex(
        JSON.stringify({
          author: authorUserId,
          chapter_id: chapter_id != null ? String(chapter_id) : null,
          text: String(chapter_text),
        })
      );
      if (expected !== String(chapter_fingerprint)) {
        return res.status(400).json({
          error: "chapter_fingerprint mismatch",
          message: "Chapter text or id changed since interview; re-run POST /post-chapter",
        });
      }
    }

    const titleBase = chapter_title != null ? String(chapter_title) : "Chapter";
    const title = `Wiki snapshot — ${titleBase}${chapter_id != null ? ` (${chapter_id})` : ""}`;

    const qaBlock = interview_answers
      .map((a, i) => `### Librarian Q${i + 1}\n${a.trim()}`)
      .join("\n\n");

    const snapshotBody = [
      "# Lore-Git wiki_snapshot (draft)",
      `## Chapter digest\n${String(chapter_text).slice(0, 4000)}`,
      "",
      "## Librarian interview answers",
      qaBlock,
    ].join("\n");

    let hudBulletsRaw =
      hud_answer != null ? String(hud_answer) : hud_answer_bullets != null ? String(hud_answer_bullets) : "";
    let hud_answer_source = hudBulletsRaw.trim() ? "client" : "none";

    if (!hudBulletsRaw.trim()) {
      const hist = await fetchLatestHudAnswerForProject(authorUserId, project_id || null);
      if (hist && String(hist.answer || "").trim()) {
        hudBulletsRaw = String(hist.answer);
        hud_answer_source = "hud_history";
      }
    }

    const analysisPack = analyzeChapterSubmission({
      chapterText: String(chapter_text),
      hudAnswerBullets: hudBulletsRaw || null,
      stylisticMetadata: stylistic_metadata,
    });

    const metadataBase = {
      ...buildWikiSnapshotMetadata({
        title,
        chapterId: chapter_id,
        plotPoint,
        plotPointOrder,
        spoilerLevel,
        stylisticMetadata: stylistic_metadata,
        halSessionId,
      }),
      authorship_delta_score: analysisPack.authorship_delta_score,
      stylistic_analysis_version: analysisPack.stylistic_analysis_version,
      stylistic_analysis: analysisPack.stylistic_analysis,
    };

    const result = await insertWikiSnapshotChunks({
      authorUserId,
      project_id,
      title,
      text: snapshotBody,
      metadataBase,
    });

    return res.status(201).json({
      success: true,
      ...result,
      ledger: "wiki_snapshot",
      wiki_visibility: "draft",
      audience: "author",
      hud_answer_source,
      authorship_delta_score: analysisPack.authorship_delta_score,
      stylistic_analysis_version: analysisPack.stylistic_analysis_version,
      stylistic_analysis: analysisPack.stylistic_analysis,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/lore-git/publish-wiki — hard-lock: fan-visible + canon wiki metadata
router.post("/publish-wiki", verifyToken, async (req, res, next) => {
  try {
    const authorUserId = req.user.user_id;
    const { project_id = null, chapter_id } = req.body || {};

    let sql = `
      UPDATE msgf_legacy_rag_chunks c
         SET audience = 'fan',
             metadata = c.metadata
               || jsonb_build_object(
                    'wiki_hard_locked', true,
                    'wiki_visibility', 'canon',
                    'wiki_published_at', to_jsonb(to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                  )
        FROM msgf_legacy_rag_sources s
       WHERE c.source_id = s.source_id
         AND c.author_user_id = $1::uuid
         AND s.author_user_id = $1::uuid
         AND (s.project_id IS NOT DISTINCT FROM $2::uuid)
         AND c.metadata->>'ledger' = 'wiki_snapshot'
         AND COALESCE(c.metadata->>'wiki_hard_locked','false') NOT IN ('true','1','yes')
    `;
    const params = [authorUserId, project_id];
    if (chapter_id != null && String(chapter_id).trim() !== "") {
      sql += ` AND c.metadata->>'wiki_chapter_id' = $3`;
      params.push(String(chapter_id));
    }

    const { rowCount } = await db.query(sql, params);
    return res.status(200).json({
      success: true,
      wiki_chunks_updated: rowCount,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
