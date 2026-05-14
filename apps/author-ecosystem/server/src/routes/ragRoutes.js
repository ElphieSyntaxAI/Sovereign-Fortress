const express = require("express");
const crypto = require("crypto");
const db = require("../lib/databaseUrlPool.cjs");
const { loadMsgfRagRules } = require("../lib/ragRulesFromMsgf.cjs");
const { verifyToken } = require("../middleware/verifyTokens");
const { chunkByChars } = require("../services/ragChunker");
const { embedTexts, generateBullets } = require("../services/geminiClient");
const {
  detectScientificCrossCheckQuestion,
  runScientificLogicTool,
} = require("../services/scientificCrossCheck");
const { recordHudHistory } = require("../services/hudHistory");

const router = express.Router();

let _ragRulesCache = null;
async function ragRules() {
  if (!_ragRulesCache) {
    _ragRulesCache = await loadMsgfRagRules((text, params) => db.query(text, params));
  }
  return _ragRulesCache;
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s || ""), "utf8").digest("hex");
}

function toSqlVectorLiteral(vec) {
  // pgvector accepts '[1,2,3]' as a literal.
  return `[${vec.map((n) => (Number.isFinite(n) ? n : 0)).join(",")}]`;
}

function wordCount(s) {
  return String(s || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function truncateToMaxWords(s, maxWords) {
  const parts = String(s || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= maxWords) return parts.join(" ");
  return `${parts.slice(0, maxWords).join(" ")}…`;
}

/**
 * @param {{ allowRealWorld?: boolean, allowWarning?: boolean }} opts
 */
function enforceHudBulletPrefixes(text, opts = {}) {
  const { allowRealWorld = false, allowWarning = false } = opts;
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const bulletish = lines.filter((l) => /^[-*•]\s+\[(CANON|REAL-WORLD|WARNING)\]/i.test(l));
  if (bulletish.length === 0) {
    throw new Error("Model output was not HUD bullets (expected lines starting with '- [CANON]', '- [REAL-WORLD]', or '- [WARNING]')");
  }

  for (const l of bulletish) {
    const cleaned = l.replace(/^[-*•]\s+/, "");
    const tagMatch = /^\[(CANON|REAL-WORLD|WARNING)\]/i.exec(cleaned);
    if (!tagMatch) {
      throw new Error("Each bullet must start with [CANON], [REAL-WORLD], or [WARNING]");
    }
    const tag = String(tagMatch[1]).toUpperCase();
    if (tag === "REAL-WORLD" && !allowRealWorld) {
      throw new Error("[REAL-WORLD] bullets require an active scientific cross-check");
    }
    if (tag === "WARNING" && !allowWarning) {
      throw new Error("[WARNING] bullets require an active scientific cross-check");
    }
  }

  return bulletish
    .map((l) => l.replace(/^[-*•]\s+/, ""))
    .map((l) => `- ${l}`)
    .join("\n");
}

/**
 * @param {{ allowRealWorld?: boolean, allowWarning?: boolean }} opts
 */
function enforceAuthorHudBullets(text, opts = {}, rules) {
  const normalized = enforceHudBulletPrefixes(text, opts);
  const lines = normalized.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^-\s+(.+)$/);
    if (!m) {
      out.push(trimmed);
      continue;
    }
    const body = m[1];
    const wc = wordCount(body);
    let bodyOut = body;
    const isWarning = /^\[WARNING\]/i.test(body);
    const maxWords = isWarning ? rules.WARNING_MAX_WORDS : rules.HUD_MAX_WORDS;
    if (wc > maxWords) {
      bodyOut = truncateToMaxWords(body, maxWords);
    }
    out.push(`- ${bodyOut}`);
  }
  return out.join("\n");
}

function resolveScientificCrossCheckMode(body) {
  const v = body && body.scientific_cross_check;
  if (v === false || v === "off") return "off";
  if (v === true || v === "force" || v === "on") return "force";
  return "auto";
}

function validateAudience(audience) {
  if (audience !== "fan" && audience !== "author") {
    const err = new Error("Invalid audience. Must be 'fan' or 'author'.");
    err.status = 400;
    throw err;
  }
  return audience;
}

function validateSourceType(rules, sourceType) {
  if (!rules.RAG_SOURCE_TYPES.includes(sourceType)) {
    const err = new Error(`Invalid source_type. Must be one of: ${rules.RAG_SOURCE_TYPES.join(", ")}`);
    err.status = 400;
    throw err;
  }
  return sourceType;
}

/**
 * Per rag-chunk-metadata.schema.json: required keys + narrative_master_logic for themes/sensitivity.
 * @param {Awaited<ReturnType<typeof loadMsgfRagRules>>} rules
 * @param {string} sourceType
 * @param {string} title msgf_legacy_rag_sources.title
 * @param {Record<string, unknown>} partial merged from metadata_defaults and section fields
 */
function buildChunkMetadata(rules, sourceType, title, partial) {
  const p = partial && typeof partial === "object" ? partial : {};
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const meta = {
    ...p,
    source_type: sourceType,
    title,
    spoiler_level: p.spoiler_level != null ? p.spoiler_level : "none",
    plot_point: p.plot_point != null ? p.plot_point : "not_applicable",
    ledger: p.ledger != null ? p.ledger : "static",
    tags,
  };
  if (sourceType === "theme_sheet" || sourceType === "trope_sensitivity_sheet") {
    meta.narrative_master_logic = true;
  }
  if (sourceType === "parallel_arc_sheet" && (meta.arc_scope == null || typeof meta.arc_scope !== "object")) {
    meta.arc_scope = {};
  }
  if (sourceType === "story_outline" && !Object.prototype.hasOwnProperty.call(meta, "era")) {
    meta.era = null;
  }
  if (meta.plot_point_order == null && meta.plot_point != null) {
    const key = String(meta.plot_point);
    if (Object.prototype.hasOwnProperty.call(rules.PLOT_POINT_ORDER_DEFAULT, key)) {
      meta.plot_point_order = rules.PLOT_POINT_ORDER_DEFAULT[key];
    }
  }
  return meta;
}

/**
 * @param {unknown} raw
 * @returns {{ active: boolean, spoilerMaxRank: number, maxPlotOrder: number }}
 */
function parseHudState(raw) {
  const rankByLevel = { none: 0, low: 1, medium: 2, high: 3 };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { active: false, spoilerMaxRank: 3, maxPlotOrder: -1 };
  }
  const hasSpoiler = Object.prototype.hasOwnProperty.call(raw, "max_spoiler_level");
  const hasPlot = Object.prototype.hasOwnProperty.call(raw, "max_plot_point_order");
  const active = hasSpoiler || hasPlot;

  let spoilerMaxRank = 3;
  if (hasSpoiler) {
    const k = String(raw.max_spoiler_level || "high").toLowerCase();
    if (rankByLevel[k] !== undefined) spoilerMaxRank = rankByLevel[k];
  }

  let maxPlotOrder = -1;
  if (hasPlot) {
    const n = Number(raw.max_plot_point_order);
    if (Number.isFinite(n)) maxPlotOrder = Math.max(0, Math.min(99, Math.floor(n)));
  }

  return { active, spoilerMaxRank, maxPlotOrder };
}

/**
 * Vector retrieval with optional GIN-friendly metadata filters and master / lore split.
 * Spoiler filter uses OR of `metadata @> '{"spoiler_level": ...}'` (jsonb_path_ops GIN).
 */
async function hudRetrieveChunks(db, opts) {
  const {
    authorUserId,
    project_id,
    audienceV,
    qLiteral,
    hudActive,
    spoilerMaxRank,
    maxPlotOrder,
    onlyMaster,
    excludeMaster,
    limit,
    includeWikiDrafts = false,
  } = opts;

  const params = [authorUserId, project_id, audienceV, qLiteral];
  let p = 5;
  let extraSql = "";

  if (!includeWikiDrafts) {
    extraSql += ` AND NOT (
      (metadata->>'ledger') = 'wiki_snapshot'
      AND NOT (
        COALESCE(metadata->>'wiki_hard_locked', 'false') IN ('true', '1', 'yes')
        OR (metadata->>'wiki_visibility') = 'canon'
      )
    )`;
  }

  if (onlyMaster) {
    extraSql += ` AND metadata @> '{"narrative_master_logic": true}'::jsonb`;
  }
  if (excludeMaster) {
    extraSql += ` AND NOT (metadata @> '{"narrative_master_logic": true}'::jsonb)`;
  }

  if (hudActive && spoilerMaxRank < 3) {
    const allowed = ["none", "low", "medium", "high"].slice(0, spoilerMaxRank + 1);
    const frags = allowed.map((spoiler_level) => JSON.stringify({ spoiler_level }));
    const ors = frags.map((_, i) => `metadata @> $${p + i}::jsonb`).join(" OR ");
    params.push(...frags);
    p += frags.length;
    extraSql += ` AND (${ors})`;
  }

  if (hudActive && maxPlotOrder >= 0) {
    extraSql += ` AND (
      COALESCE(metadata->>'plot_point', '') IN ('not_applicable', 'parallel_arc')
      OR metadata->>'plot_point_order' IS NULL
      OR metadata->>'plot_point_order' ~ '^[0-9]+$' AND (metadata->>'plot_point_order')::int <= $${p}
    )`;
    params.push(maxPlotOrder);
    p += 1;
  }

  const limitClamped = Math.max(1, Math.min(20, Math.floor(Number(limit) || 8)));
  const sql = `
    SELECT chunk_id, content, metadata,
           1 - (embedding <=> $4::vector) AS cosine_similarity
      FROM msgf_legacy_rag_chunks
     WHERE author_user_id = $1
       AND (project_id = $2 OR ($2 IS NULL AND project_id IS NULL))
       AND audience = $3
       ${extraSql}
     ORDER BY embedding <=> $4::vector
     LIMIT $${p}
  `;
  params.push(limitClamped);

  const { rows } = await db.query(sql, params);
  return rows;
}

// POST /api/rag/ingest
// Body: see apps/author-ecosystem/docs/rag/rag-ingest-body.schema.json
// ({ title, source_type, audience, text? } | { title, source_type, audience, sections? })
// Optional: metadata_defaults, project_id
router.post("/ingest", verifyToken, async (req, res, next) => {
  try {
    const R = await ragRules();
    const authorUserId = req.user.user_id;
    const body = req.body || {};
    const { project_id = null, title, source_type, audience, text, sections, metadata_defaults } = body;

    const hasText = text != null && String(text).trim().length > 0;
    const hasSections = Array.isArray(sections) && sections.length > 0;

    if (!title || !source_type || !audience || (!hasText && !hasSections)) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["title", "source_type", "audience", "text or sections"],
      });
    }

    if (hasText && hasSections) {
      return res.status(400).json({
        error: "Invalid ingest body",
        message: "Send exactly one of: text (full markdown) or sections (array), not both.",
      });
    }

    const audienceV = validateAudience(audience);
    const sourceTypeV = validateSourceType(R, source_type);

    if (R.AUTHOR_ONLY_SOURCE_TYPES.has(sourceTypeV) && audienceV !== "author") {
      return res.status(400).json({
        error: "Invalid audience for source_type",
        message: `${sourceTypeV} requires audience='author'`,
      });
    }

    const defaults =
      metadata_defaults && typeof metadata_defaults === "object" && !Array.isArray(metadata_defaults)
        ? metadata_defaults
        : {};

    /** @type {{ text: string, partial: Record<string, unknown> }[]} */
    const units = [];
    if (hasSections) {
      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s] || {};
        const sp = sec.section_path;
        const st = sec.text;
        if (sp == null || String(sp).trim() === "" || st == null || String(st).trim() === "") {
          return res.status(400).json({
            error: "Invalid sections entry",
            message: `sections[${s}] requires non-empty section_path and text`,
          });
        }
        const partial = {
          ...defaults,
          section_path: String(sp).trim(),
          ...(sec.heading_level != null ? { heading_level: sec.heading_level } : {}),
          ...(sec.heading_text != null ? { heading_text: String(sec.heading_text) } : {}),
          ...(sec.metadata && typeof sec.metadata === "object" && !Array.isArray(sec.metadata) ? sec.metadata : {}),
        };
        units.push({ text: String(st), partial });
      }
    } else {
      units.push({ text: String(text), partial: { ...defaults } });
    }

    const chunkPlan = [];
    for (const u of units) {
      const parts = chunkByChars(u.text, { chunkSize: 1800, overlap: 200 });
      for (const content of parts) {
        chunkPlan.push({ content, partial: u.partial });
      }
    }

    if (chunkPlan.length === 0) {
      return res.status(400).json({ error: "Text produced no chunks" });
    }

    const [sourceRow] = (
      await db.query(
        `INSERT INTO msgf_legacy_rag_sources (author_user_id, project_id, source_type, audience, title)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING source_id`,
        [authorUserId, project_id, sourceTypeV, audienceV, title]
      )
    ).rows;

    const sourceId = sourceRow.source_id;

    const embeddings = await embedTexts(
      chunkPlan.map((c) => c.content),
      {}
    );

    let inserted = 0;
    for (let i = 0; i < chunkPlan.length; i++) {
      const { content, partial } = chunkPlan[i];
      const contentHash = sha256Hex(`${authorUserId}|${project_id || ""}|${audienceV}|${content}`);
      const embedding = embeddings[i];

      if (embedding.length !== 768) {
        const err = new Error(`Embedding dimension mismatch: got ${embedding.length}, expected 768`);
        err.status = 500;
        throw err;
      }

      const embeddingLiteral = toSqlVectorLiteral(embedding);
      const metadata = buildChunkMetadata(R, sourceTypeV, title, partial);

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
          audienceV,
          i,
          content,
          contentHash,
          embeddingLiteral,
          JSON.stringify(metadata),
        ]
      );
      inserted += result.rowCount || 0;
    }

    return res.status(201).json({
      success: true,
      source_id: sourceId,
      chunks_total: chunkPlan.length,
      chunks_inserted: inserted,
    });
  } catch (err) {
    next(err);
  }
});

function formatChunkContextLine(r) {
  const meta = r.metadata || {};
  const label = `${meta.source_type || "unknown"}: ${meta.title || "Untitled"}`;
  const master = meta.narrative_master_logic === true ? " [NARRATIVE_MASTER]" : "";
  const wiki = meta.ledger === "wiki_snapshot" ? ` [WIKI:${meta.wiki_visibility || "draft"}]` : "";
  const sec = meta.section_path ? ` section=${meta.section_path}` : "";
  return `- [${label}]${master}${wiki}${sec} chunk_id=${r.chunk_id} sim=${Number(r.cosine_similarity || 0).toFixed(3)}\n${r.content}`;
}

/**
 * Parse model JSON; tolerate ```json fences.
 * @param {string} text
 * @returns {unknown}
 */
function parseJsonStripFences(text) {
  let s = String(text || "").trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) s = m[1].trim();
  return JSON.parse(s);
}

const LORE_EXTRACTION_CHUNK_TYPES = new Set([
  "character",
  "location",
  "rule",
  "object",
  "relationship",
  "event",
  "theme",
  "other",
]);

/** System instructions when `system_prompt` is `lore_extraction` (JSON proposed chunks, not HUD bullets). */
const LORE_EXTRACTION_SYSTEM_PROMPT = [
  "You are the Lore Extraction assistant for an Author Ecosystem RAG wiki.",
  "You receive NARRATIVE MASTER CONTEXT and LORE CONTEXT (retrieved passages).",
  "Propose wiki-ready lore chunks that are NEW or clarifying relative to that material — do not duplicate entire passages verbatim.",
  "Never invent proper nouns, places, or facts not clearly supported by the contexts. If unsure, return an empty proposed_chunks array.",
  "Output MUST be a single JSON object only (no markdown, no prose before or after). Schema:",
  '{"proposed_chunks":[{"title":"string","excerpt":"string","chunk_type":"character|location|rule|object|relationship|event|theme|other","tags":["string"]}]}',
  "Each excerpt should be at least 40 characters of continuous prose suitable for a wiki article when possible.",
  "tags: 1–8 short lowercase tokens (e.g. faction names, era).",
].join("\n");

/**
 * @param {unknown} parsed
 * @returns {{ title: string, excerpt: string, chunk_type: string, tags: string[] }[]}
 */
function normalizeProposedChunks(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Root JSON must be an object");
  }
  const raw = /** @type {{ proposed_chunks?: unknown }} */ (parsed).proposed_chunks;
  if (!Array.isArray(raw)) {
    throw new Error("Missing proposed_chunks array");
  }
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (!c || typeof c !== "object") continue;
    const title = String(/** @type {{ title?: unknown }} */ (c).title ?? "").trim();
    const excerpt = String(/** @type {{ excerpt?: unknown }} */ (c).excerpt ?? "").trim();
    let chunk_type = String(/** @type {{ chunk_type?: unknown }} */ (c).chunk_type ?? "other")
      .trim()
      .toLowerCase();
    if (!LORE_EXTRACTION_CHUNK_TYPES.has(chunk_type)) chunk_type = "other";
    const tagsRaw = /** @type {{ tags?: unknown }} */ (c).tags;
    let tags = [];
    if (Array.isArray(tagsRaw)) {
      tags = tagsRaw.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof tagsRaw === "string" && tagsRaw.trim()) {
      tags = tagsRaw
        .split(/[,;]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (!title) throw new Error(`proposed_chunks[${i}]: title required`);
    if (excerpt.length < 20) throw new Error(`proposed_chunks[${i}]: excerpt must be at least 20 characters`);
    out.push({ title, excerpt, chunk_type, tags });
  }
  return out;
}

/** @param {string} rawText */
function parseNarrativeAuditReply(rawText) {
  const lines = String(rawText || "")
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const line1 = lines[0] || "";
  const line2 = lines[1] || "";
  let logic_status = "AUDIT_PASSED";
  const m = line1.match(/^STATUS:\s*(.+)$/i);
  if (m) {
    const tok = String(m[1])
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
    if (tok.includes("LOGIC_WARNING")) logic_status = "LOGIC_WARNING";
    else if (tok.includes("CONFLICT_RESOLVED")) logic_status = "CONFLICT_RESOLVED";
    else if (tok.includes("AUDIT_PASSED")) logic_status = "AUDIT_PASSED";
  } else if (/LOGIC_WARNING/i.test(line1)) {
    logic_status = "LOGIC_WARNING";
  } else if (/CONFLICT_RESOLVED/i.test(line1)) {
    logic_status = "CONFLICT_RESOLVED";
  }
  const explanation = line2 || line1.replace(/^STATUS:\s*\S+\s*/i, "").trim() || String(rawText || "").trim();
  const logic_warning = logic_status === "LOGIC_WARNING" ? explanation : null;
  const answer = [line1, line2].filter(Boolean).join("\n") || String(rawText || "").trim();
  return { logic_status, logic_warning, explanation, answer };
}

const NARRATIVE_AUDIT_SCENE_SYSTEM = [
  "You are a strict narrative logic and canon-consistency reviewer for an author planning tool.",
  "You receive NARRATIVE MASTER CONTEXT, LORE CONTEXT (vector-retrieved), and an AUDIT QUESTION about one scene.",
  "Compare the scene against established lore. Flag only genuine contradictions (e.g. missing protective gear when wiki requires it in that environment), not stylistic preferences.",
  "Output EXACTLY two lines — no bullets, no markdown fences:",
  "Line 1 must be exactly one of: STATUS: LOGIC_WARNING | STATUS: AUDIT_PASSED | STATUS: CONFLICT_RESOLVED",
  "Line 2: One concise sentence (if LOGIC_WARNING, name the contradiction clearly; otherwise a brief confirmation).",
].join("\n");

// POST /api/rag/chat (Author HUD + optional scientific cross-check)
// Body: { ..., system_prompt?: "lore_extraction" | "narrative_audit" }
router.post("/chat", verifyToken, async (req, res, next) => {
  try {
    const R = await ragRules();
    const authorUserId = req.user.user_id;
    const body = req.body || {};
    const { project_id = null, audience, question, top_k, hud_state, include_wiki_drafts } = body;

    const loreExtraction =
      String(body.system_prompt || "")
        .trim()
        .toLowerCase() === "lore_extraction";

    const narrativeAudit =
      String(body.system_prompt || "")
        .trim()
        .toLowerCase() === "narrative_audit";

    if (!audience || !question) {
      return res.status(400).json({ error: "Missing required fields", required: ["audience", "question"] });
    }
    const audienceV = validateAudience(audience);
    const topK = Math.max(1, Math.min(Number(top_k || process.env.RAG_TOP_K || 8), 20));
    const hud = parseHudState(hud_state);
    const scm = resolveScientificCrossCheckMode(body);
    const crossCheckTriggered =
      scm !== "off" && (scm === "force" || detectScientificCrossCheckQuestion(String(question)));

    const includeWikiDrafts =
      include_wiki_drafts === true || String(include_wiki_drafts || "").toLowerCase() === "true";

    const [qVec] = await embedTexts([question], {});
    if (qVec.length !== 768) {
      const err = new Error(`Embedding dimension mismatch: got ${qVec.length}, expected 768`);
      err.status = 500;
      throw err;
    }

    const qLiteral = toSqlVectorLiteral(qVec);

    const baseRetrieve = {
      authorUserId,
      project_id,
      audienceV,
      qLiteral,
      hudActive: hud.active,
      spoilerMaxRank: hud.spoilerMaxRank,
      maxPlotOrder: hud.maxPlotOrder,
    };

    const masterRows = await hudRetrieveChunks(db, {
      ...baseRetrieve,
      onlyMaster: true,
      excludeMaster: false,
      limit: R.RAG_MASTER_LIMIT,
      includeWikiDrafts,
    });

    const loreRows = await hudRetrieveChunks(db, {
      ...baseRetrieve,
      onlyMaster: false,
      excludeMaster: true,
      limit: topK,
      includeWikiDrafts,
    });

    const masterContext = masterRows.map(formatChunkContextLine).join("\n\n");
    const loreContext = loreRows.map(formatChunkContextLine).join("\n\n");

    if (narrativeAudit) {
      const rows = [...masterRows, ...loreRows];
      const hudDesc = hud.active
        ? [
            hud.spoilerMaxRank < 3
              ? `Spoiler ceiling up to: ${["none", "low", "medium", "high"][hud.spoilerMaxRank]}`
              : "Spoiler levels: unrestricted",
            hud.maxPlotOrder >= 0 ? `Max plot_point_order: ${hud.maxPlotOrder}` : "Plot order: unrestricted",
          ].join("; ")
        : "HUD metadata filters: off (vector retrieval only).";

      const naUserParts = [
        `Audience Mode: ${audienceV}`,
        hudDesc,
        `Wiki drafts: ${includeWikiDrafts ? "included in retrieval" : "excluded"}.`,
        "",
        "SCENE AUDIT QUESTION (author-supplied):",
        String(question),
        "",
        "NARRATIVE MASTER CONTEXT:",
        masterContext || "(none)",
        "",
        "LORE CONTEXT (vector-retrieved):",
        loreContext || "(none found)",
        "",
        "Reply with exactly two lines as instructed.",
      ];
      const naUser = naUserParts.join("\n");

      let parsed;
      try {
        const rawNa = await generateBullets({ system: NARRATIVE_AUDIT_SCENE_SYSTEM, user: naUser });
        parsed = parseNarrativeAuditReply(rawNa);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(502).json({
          success: false,
          narrative_audit: true,
          error: "narrative_audit_failed",
          message: msg,
        });
      }

      try {
        await recordHudHistory({
          authorUserId,
          projectId: project_id,
          question: String(question),
          answer: parsed.answer,
          hudPayload: {
            audience: audienceV,
            top_k: topK,
            system_prompt: "narrative_audit",
            logic_status: parsed.logic_status,
            logic_warning: parsed.logic_warning,
            hud: {
              active: hud.active,
              max_spoiler_level: ["none", "low", "medium", "high"][hud.spoilerMaxRank] ?? "high",
              max_plot_point_order: hud.maxPlotOrder >= 0 ? hud.maxPlotOrder : null,
              master_chunks: masterRows.length,
              lore_chunks: loreRows.length,
            },
            lore_git: { include_wiki_drafts: includeWikiDrafts },
          },
        });
      } catch (histErr) {
        console.error("[hud_history] record failed:", histErr.message);
      }

      return res.status(200).json({
        success: true,
        narrative_audit: true,
        logic_status: parsed.logic_status,
        logic_warning: parsed.logic_warning,
        explanation: parsed.explanation,
        answer: parsed.answer,
        hud: {
          active: hud.active,
          max_spoiler_level: ["none", "low", "medium", "high"][hud.spoilerMaxRank] ?? "high",
          max_plot_point_order: hud.maxPlotOrder >= 0 ? hud.maxPlotOrder : null,
          master_chunks: masterRows.length,
          lore_chunks: loreRows.length,
        },
        scientific_cross_check: {
          mode: scm,
          triggered: false,
          anchor: null,
        },
        lore_git: {
          include_wiki_drafts: includeWikiDrafts,
        },
        retrieved_chunks: rows.map((r) => ({
          chunk_id: r.chunk_id,
          cosine_similarity: Number(r.cosine_similarity || 0),
          metadata: r.metadata || {},
        })),
      });
    }

    if (loreExtraction) {
      const rows = [...masterRows, ...loreRows];
      const hudDesc = hud.active
        ? [
            hud.spoilerMaxRank < 3
              ? `Spoiler ceiling up to: ${["none", "low", "medium", "high"][hud.spoilerMaxRank]}`
              : "Spoiler levels: unrestricted",
            hud.maxPlotOrder >= 0 ? `Max plot_point_order: ${hud.maxPlotOrder}` : "Plot order: unrestricted",
          ].join("; ")
        : "HUD metadata filters: off (vector retrieval only).";

      const loreUserParts = [
        `Audience Mode: ${audienceV}`,
        hudDesc,
        `Wiki drafts: ${includeWikiDrafts ? "included in retrieval" : "excluded"}.`,
        "",
        "Author request (lore extraction):",
        String(question),
        "",
        "NARRATIVE MASTER CONTEXT:",
        masterContext || "(none)",
        "",
        "LORE CONTEXT (vector-retrieved):",
        loreContext || "(none found)",
        "",
        "Return only the JSON object described in your system instructions.",
      ];
      const loreUser = loreUserParts.join("\n");

      let proposed_chunks;
      try {
        const raw = await generateBullets({ system: LORE_EXTRACTION_SYSTEM_PROMPT, user: loreUser });
        proposed_chunks = normalizeProposedChunks(parseJsonStripFences(raw));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(502).json({
          success: false,
          lore_extraction: true,
          error: "lore_extraction_parse_failed",
          message: msg,
        });
      }

      try {
        await recordHudHistory({
          authorUserId,
          projectId: project_id,
          question: String(question),
          answer: JSON.stringify({ proposed_chunks }),
          hudPayload: {
            audience: audienceV,
            top_k: topK,
            system_prompt: "lore_extraction",
            hud: {
              active: hud.active,
              max_spoiler_level: ["none", "low", "medium", "high"][hud.spoilerMaxRank] ?? "high",
              max_plot_point_order: hud.maxPlotOrder >= 0 ? hud.maxPlotOrder : null,
              master_chunks: masterRows.length,
              lore_chunks: loreRows.length,
            },
            lore_git: { include_wiki_drafts: includeWikiDrafts },
          },
        });
      } catch (histErr) {
        console.error("[hud_history] record failed:", histErr.message);
      }

      return res.status(200).json({
        success: true,
        lore_extraction: true,
        proposed_chunks,
        answer: JSON.stringify({ proposed_chunks }),
        hud: {
          active: hud.active,
          max_spoiler_level: ["none", "low", "medium", "high"][hud.spoilerMaxRank] ?? "high",
          max_plot_point_order: hud.maxPlotOrder >= 0 ? hud.maxPlotOrder : null,
          master_chunks: masterRows.length,
          lore_chunks: loreRows.length,
        },
        scientific_cross_check: {
          mode: scm,
          triggered: false,
          anchor: null,
        },
        lore_git: {
          include_wiki_drafts: includeWikiDrafts,
        },
        retrieved_chunks: rows.map((r) => ({
          chunk_id: r.chunk_id,
          cosine_similarity: Number(r.cosine_similarity || 0),
          metadata: r.metadata || {},
        })),
      });
    }

    const canonExcerpt = [masterContext, loreContext].filter(Boolean).join("\n\n").slice(0, 4000);

    let scientificAnchor = null;
    if (crossCheckTriggered) {
      try {
        scientificAnchor = await runScientificLogicTool({
          question: String(question),
          canonExcerpt,
        });
      } catch (e) {
        scientificAnchor = `REAL-WORLD FACT: Scientific Logic tool error: ${e.message}`;
      }
    }

    const prefixRules = crossCheckTriggered
      ? [
          "Every bullet MUST begin with exactly one of these bracket prefixes: '[CANON]', '[REAL-WORLD]', or '[WARNING]'.",
          "[CANON]: facts grounded ONLY in NARRATIVE MASTER CONTEXT + LORE CONTEXT (uploaded lore). Never label invented story facts as [CANON].",
          "[REAL-WORLD]: established science or the SCIENTIFIC CROSS-CHECK anchor below only. Never use [REAL-WORLD] to invent plot, names, or in-world laws.",
          "[WARNING]: use ONLY when established real-world physics/chemistry/biology clearly contradicts explicit CANON geography, structures, or claims in the contexts (e.g. unsupported floating landmasses).",
          "When you use [WARNING], follow this pattern (adapt the middle sentence to the scene; replace bracket placeholders with your best fit, e.g. Magic, Tech, or World Law):",
          "'Warning: <concise real-world constraint, e.g. Earth-like gravity would not support this structure without support>. Ensure your Canon logic for [Magic/Tech/World Law] is active in this scene.'",
          "Do not emit [WARNING] for minor tone issues or when canon already names a mechanism (magic, antigravity, etc.) that resolves the tension.",
        ]
      : [
          "Every bullet MUST begin with exactly: '[CANON]' (scientific cross-check is OFF for this request).",
          "Do NOT use '[REAL-WORLD]' or '[WARNING]' prefixes in this response.",
          "[CANON]: facts grounded ONLY in NARRATIVE MASTER CONTEXT + LORE CONTEXT.",
        ];

    const system = [
      "You are the Author HUD (Lore Librarian) for an Author Ecosystem RAG system.",
      "Output MUST be bullet points only.",
      ...prefixRules,
      `Each [CANON] or [REAL-WORLD] bullet body must aim for ${R.HUD_MIN_WORDS}-${R.HUD_MAX_WORDS} words after the prefix; never exceed ${R.HUD_MAX_WORDS} words for those tags.`,
      `[WARNING] bullets may be slightly longer when needed but stay under ${R.WARNING_MAX_WORDS} words.`,
      "NARRATIVE MASTER CONTEXT appears first. Treat it as authoritative: if any LORE CONTEXT would violate themes, cultural sensitivity, or trope rules in the master context, say so inside [CANON] bullets.",
      "If canon is missing for the question, say so in [CANON] bullets (do not invent story facts).",
    ].join("\n");

    const hudDesc = hud.active
      ? [
          hud.spoilerMaxRank < 3
            ? `Spoiler ceiling up to: ${["none", "low", "medium", "high"][hud.spoilerMaxRank]}`
            : "Spoiler levels: unrestricted",
          hud.maxPlotOrder >= 0 ? `Max plot_point_order: ${hud.maxPlotOrder}` : "Plot order: unrestricted",
        ].join("; ")
      : "HUD metadata filters: off (vector retrieval only).";

    const userParts = [
      `Audience Mode: ${audienceV}`,
      hudDesc,
      `Scientific cross-check mode: ${scm}${crossCheckTriggered ? " (active)" : " (inactive)"}.`,
      `Wiki drafts: ${includeWikiDrafts ? "included in retrieval" : "excluded (set include_wiki_drafts true for author wiki review)"}.`,
      "",
      "Question:",
      String(question),
      "",
      "NARRATIVE MASTER CONTEXT (audit against this first):",
      masterContext || "(none)",
      "",
      "LORE CONTEXT (vector-retrieved, master excluded from this block):",
      loreContext || "(none found)",
      "",
    ];

    if (crossCheckTriggered && scientificAnchor) {
      userParts.push(
        "SCIENTIFIC CROSS-CHECK (REAL-WORLD ANCHOR — use ONLY for [REAL-WORLD] bullets; do not treat as story canon):",
        scientificAnchor,
        ""
      );
    }

    userParts.push("Answer now.");

    const user = userParts.join("\n");

    const raw = await generateBullets({ system, user });
    const bullets = enforceAuthorHudBullets(
      raw,
      {
        allowRealWorld: crossCheckTriggered,
        allowWarning: crossCheckTriggered,
      },
      R
    );

    const rows = [...masterRows, ...loreRows];

    try {
      await recordHudHistory({
        authorUserId,
        projectId: project_id,
        question: String(question),
        answer: bullets,
        hudPayload: {
          audience: audienceV,
          top_k: topK,
          hud: {
            active: hud.active,
            max_spoiler_level: ["none", "low", "medium", "high"][hud.spoilerMaxRank] ?? "high",
            max_plot_point_order: hud.maxPlotOrder >= 0 ? hud.maxPlotOrder : null,
            master_chunks: masterRows.length,
            lore_chunks: loreRows.length,
          },
          scientific_cross_check: {
            mode: scm,
            triggered: crossCheckTriggered,
            anchor: crossCheckTriggered ? scientificAnchor : null,
          },
          lore_git: { include_wiki_drafts: includeWikiDrafts },
        },
      });
    } catch (histErr) {
      console.error("[hud_history] record failed:", histErr.message);
    }

    return res.status(200).json({
      success: true,
      answer: bullets,
      hud: {
        active: hud.active,
        max_spoiler_level: ["none", "low", "medium", "high"][hud.spoilerMaxRank] ?? "high",
        max_plot_point_order: hud.maxPlotOrder >= 0 ? hud.maxPlotOrder : null,
        master_chunks: masterRows.length,
        lore_chunks: loreRows.length,
      },
      scientific_cross_check: {
        mode: scm,
        triggered: crossCheckTriggered,
        anchor: crossCheckTriggered ? scientificAnchor : null,
      },
      lore_git: {
        include_wiki_drafts: includeWikiDrafts,
      },
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

