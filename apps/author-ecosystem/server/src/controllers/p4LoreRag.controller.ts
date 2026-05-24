import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";

import { assertUuid, HalValidationError } from "../lib/halMetrics.js";
import { LibrarianChat, type LibrarianAudienceMode } from "../lib/narrative/LibrarianChat.js";
import { createOpenAIEmbedder } from "../lib/narrative/IngestionService.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

const require = createRequire(import.meta.url);
const { generateBullets } = require("../services/geminiClient.js") as {
  generateBullets: (opts: { system: string; user: string; model?: string }) => Promise<string>;
};
const { analyzeChapterSubmission } = require("../services/halStylisticAnalyzer.js") as {
  analyzeChapterSubmission: (opts: {
    chapterText: string;
    hudAnswerBullets: string | null;
    stylisticMetadata: Record<string, unknown>;
  }) => {
    authorship_delta_score: number;
    stylistic_analysis_version: number;
    stylistic_analysis: Record<string, unknown>;
  };
};

export const p4LoreRagController = Router();

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

const NARRATIVE_AUDIT_SCENE_SYSTEM = [
  "You are a strict narrative logic and canon-consistency reviewer for an author planning tool.",
  "You receive NARRATIVE MASTER CONTEXT, LORE CONTEXT (vector-retrieved), and an AUDIT QUESTION about one scene.",
  "Compare the scene against established lore. Flag only genuine contradictions (e.g. missing protective gear when wiki requires it in that environment), not stylistic preferences.",
  "Output EXACTLY two lines — no bullets, no markdown fences:",
  "Line 1 must be exactly one of: STATUS: LOGIC_WARNING | STATUS: AUDIT_PASSED | STATUS: CONFLICT_RESOLVED",
  "Line 2: One concise sentence (if LOGIC_WARNING, name the contradiction clearly; otherwise a brief confirmation).",
].join("\n");

function parseJsonStripFences(text: string): unknown {
  let s = String(text || "").trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) s = m[1].trim();
  return JSON.parse(s) as unknown;
}

function normalizeProposedChunks(parsed: unknown): Array<{
  title: string;
  excerpt: string;
  chunk_type: string;
  tags: string[];
}> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Root JSON must be an object");
  }
  const raw = (parsed as { proposed_chunks?: unknown }).proposed_chunks;
  if (!Array.isArray(raw)) {
    throw new Error("Missing proposed_chunks array");
  }
  const out: Array<{ title: string; excerpt: string; chunk_type: string; tags: string[] }> = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (!c || typeof c !== "object" || Array.isArray(c)) continue;
    const rec = c as Record<string, unknown>;
    const title = String(rec.title ?? "").trim();
    const excerpt = String(rec.excerpt ?? "").trim();
    let chunk_type = String(rec.chunk_type ?? "other")
      .trim()
      .toLowerCase();
    if (!LORE_EXTRACTION_CHUNK_TYPES.has(chunk_type)) chunk_type = "other";
    const tagsRaw = rec.tags;
    let tags: string[] = [];
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

function parseNarrativeAuditReply(rawText: string): {
  logic_status: string;
  logic_warning: string | null;
  explanation: string;
  answer: string;
} {
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
  const explanation =
    line2 || line1.replace(/^STATUS:\s*\S+\s*/i, "").trim() || String(rawText || "").trim();
  const logic_warning = logic_status === "LOGIC_WARNING" ? explanation : null;
  const answer = [line1, line2].filter(Boolean).join("\n") || String(rawText || "").trim();
  return { logic_status, logic_warning, explanation, answer };
}

function formatP4ChunkContext(c: {
  id: string;
  content: string;
  source_document: string;
  chunk_type: string;
  cosine_similarity: number;
}): string {
  return `- [${c.chunk_type}: ${c.source_document}] id=${c.id} sim=${c.cosine_similarity.toFixed(3)}\n${c.content}`;
}

function validateStylisticMetadata(sm: unknown): { ok: boolean; error?: string } {
  if (!sm || typeof sm !== "object" || Array.isArray(sm)) {
    return { ok: false, error: "stylistic_metadata must be an object (HAL-derived voice proof)" };
  }
  const o = sm as Record<string, unknown>;
  if (o.pet_phrases != null && !Array.isArray(o.pet_phrases)) {
    return { ok: false, error: "stylistic_metadata.pet_phrases must be an array of strings when present" };
  }
  if (Array.isArray(o.pet_phrases)) {
    for (const p of o.pet_phrases) {
      if (typeof p !== "string") return { ok: false, error: "stylistic_metadata.pet_phrases entries must be strings" };
    }
  }
  if (
    o.sentence_complexity != null &&
    (typeof o.sentence_complexity !== "object" || Array.isArray(o.sentence_complexity))
  ) {
    return { ok: false, error: "stylistic_metadata.sentence_complexity must be an object when present" };
  }
  return { ok: true };
}

function toP4ChunkType(raw: string): "lore" | "plot" | "character" {
  const x = raw.toLowerCase();
  if (x === "plot") return "plot";
  if (x === "character") return "character";
  return "lore";
}

async function buildP4RetrievalContext(params: {
  tenantId: string;
  question: string;
  topK: number;
  audience: LibrarianAudienceMode;
}): Promise<string> {
  const chat = new LibrarianChat(getSupabaseAdmin());
  const result = await chat.ask({
    tenantId: params.tenantId,
    question: params.question,
    topK: params.topK,
    audience: params.audience,
    enforceMode: "strict",
  });
  return result.retrievedChunks.map(formatP4ChunkContext).join("\n\n") || "(none found)";
}

/** POST /api/rag/chat — P4 Librarian retrieval + Gemini (lore_extraction | narrative_audit | default HUD). */
p4LoreRagController.post("/api/rag/chat", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const audienceRaw = String(body.audience ?? "").trim().toLowerCase();
    const question = String(body.question ?? "").trim();
    const projectIdRaw = body.project_id != null ? String(body.project_id).trim() : "";

    if (!audienceRaw || !question) {
      return res.status(400).json({ error: "Missing required fields", required: ["audience", "question"] });
    }
    if (audienceRaw !== "fan" && audienceRaw !== "author") {
      return res.status(400).json({ error: "audience must be fan or author" });
    }
    const audienceV = audienceRaw as LibrarianAudienceMode;

    if (!projectIdRaw) {
      return res.status(400).json({ error: "project_id is required for P4 retrieval" });
    }
    const tenantId = assertUuid(projectIdRaw, "project_id");

    const topK = Math.max(1, Math.min(Number(body.top_k ?? process.env.RAG_TOP_K ?? 8), 20));
    const includeWikiDrafts =
      body.include_wiki_drafts === true || String(body.include_wiki_drafts ?? "").toLowerCase() === "true";

    const sys = String(body.system_prompt ?? "").trim().toLowerCase();
    const loreExtraction = sys === "lore_extraction";
    const narrativeAudit = sys === "narrative_audit";

    const hudDesc = "HUD metadata filters: off (P4 vector retrieval via Librarian).";
    const wikiNote = includeWikiDrafts ? "included in retrieval" : "excluded";

    const loreContext = await buildP4RetrievalContext({
      tenantId,
      question,
      topK,
      audience: audienceV,
    });

    if (loreExtraction) {
      const loreUser = [
        `Audience Mode: ${audienceV}`,
        hudDesc,
        `Wiki drafts: ${wikiNote}.`,
        "",
        "Author request (lore extraction):",
        question,
        "",
        "LORE CONTEXT (P4 narrative library):",
        loreContext,
        "",
        "Return only the JSON object described in your system instructions.",
      ].join("\n");

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

      return res.status(200).json({
        success: true,
        lore_extraction: true,
        proposed_chunks,
        answer: JSON.stringify({ proposed_chunks }),
        hud: {
          active: false,
          max_spoiler_level: "high",
          max_plot_point_order: null,
          master_chunks: 0,
          lore_chunks: 0,
        },
        scientific_cross_check: {
          mode: "off",
          triggered: false,
          anchor: null,
        },
        lore_git: { include_wiki_drafts: includeWikiDrafts },
      });
    }

    if (narrativeAudit) {
      const naUser = [
        `Audience Mode: ${audienceV}`,
        hudDesc,
        `Wiki drafts: ${wikiNote}.`,
        "",
        "SCENE AUDIT QUESTION (author-supplied):",
        question,
        "",
        "LORE CONTEXT (P4 narrative library):",
        loreContext,
        "",
        "Reply with exactly two lines as instructed.",
      ].join("\n");

      let parsed;
      try {
        const rawNa = await generateBullets({ system: NARRATIVE_AUDIT_SCENE_SYSTEM, user: naUser });
        parsed = parseNarrativeAuditReply(rawNa);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(502).json({
          success: false,
          narrative_audit: true,
          error: "narrative_audit_parse_failed",
          message: msg,
        });
      }

      return res.status(200).json({
        success: true,
        narrative_audit: true,
        logic_status: parsed.logic_status,
        logic_warning: parsed.logic_warning,
        explanation: parsed.explanation,
        answer: parsed.answer,
        hud: {
          active: false,
          max_spoiler_level: "high",
          max_plot_point_order: null,
          master_chunks: 0,
          lore_chunks: 0,
        },
        scientific_cross_check: {
          mode: "off",
          triggered: false,
          anchor: null,
        },
        lore_git: { include_wiki_drafts: includeWikiDrafts },
      });
    }

    const chat = new LibrarianChat(getSupabaseAdmin());
    const result = await chat.ask({
      tenantId,
      question,
      topK,
      audience: audienceV,
      enforceMode: "strict",
    });

    return res.status(200).json({
      success: true,
      answer: result.answer,
      hud: {
        active: false,
        max_spoiler_level: "high",
        max_plot_point_order: null,
        master_chunks: 0,
        lore_chunks: result.retrievedChunks.length,
      },
      scientific_cross_check: {
        mode: "off",
        triggered: false,
        anchor: null,
      },
      retrieved_chunks: result.retrievedChunks.map((c) => ({
        chunk_id: c.id,
        cosine_similarity: c.cosine_similarity,
        metadata: { source_document: c.source_document, chunk_type: c.chunk_type },
      })),
    });
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[p4/rag/chat]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Internal error" });
  }
});

/** POST /api/lore-git/commit — `lore_extraction_commit` inserts into `p4_narrative_library_chunks`. */
p4LoreRagController.post("/api/lore-git/commit", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const loreExtractionCommit =
      body.lore_extraction_commit === true ||
      String(body.lore_extraction_commit ?? "").toLowerCase() === "true";

    if (!loreExtractionCommit) {
      return res.status(410).json({
        error: "Legacy full lore-git chapter flow was removed. Use lore_extraction_commit with proposed_chunk, or manuscript ingest APIs.",
      });
    }

    const proposedChunk = body.proposed_chunk;
    if (!proposedChunk || typeof proposedChunk !== "object" || Array.isArray(proposedChunk)) {
      return res.status(400).json({ error: "proposed_chunk object is required when lore_extraction_commit is true" });
    }

    const project_id = body.project_id != null ? String(body.project_id).trim() : "";
    if (!project_id) {
      return res.status(400).json({ error: "project_id is required" });
    }
    const tenantId = assertUuid(project_id, "project_id");
    const manuscriptId =
      body.manuscript_id != null ? String(body.manuscript_id).trim() : "";

    const stylistic_metadata =
      body.stylistic_metadata != null && typeof body.stylistic_metadata === "object" && !Array.isArray(body.stylistic_metadata)
        ? (body.stylistic_metadata as Record<string, unknown>)
        : {};

    const pc = proposedChunk as Record<string, unknown>;
    const title = String(pc.title ?? "").trim();
    const excerpt = String(pc.excerpt ?? "").trim();
    const chunk_type_raw = String(pc.chunk_type ?? "other").trim().toLowerCase() || "other";
    let tags: string[] = [];
    if (Array.isArray(pc.tags)) {
      tags = pc.tags.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof pc.tags === "string" && pc.tags.trim()) {
      tags = pc.tags
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

    const embedBatch = createOpenAIEmbedder();
    const [embedding] = await embedBatch([excerpt]);
    if (!embedding || embedding.length !== 1536) {
      return res.status(500).json({ error: `Embedding dimension mismatch: expected 1536, got ${embedding?.length ?? 0}` });
    }

    const p4Type = toP4ChunkType(chunk_type_raw);
    const sourceDocument = `lore-extraction/${randomUUID()}`;
    const snapshotBody = [
      "# Lore extraction (approved)",
      `## ${title}`,
      `**chunk_type:** ${chunk_type_raw}`,
      `**tags:** ${tags.length ? tags.join(", ") : "(none)"}`,
      "",
      excerpt,
    ].join("\n");

    const metadata: Record<string, unknown> = {
      lore_extraction: true,
      lore_extraction_chunk_type: chunk_type_raw,
      lore_extraction_tags: tags,
      proposed_chunk_title: title,
      wiki_visibility: "draft",
      ledger: "wiki_snapshot",
      stylistic_metadata,
      ...(manuscriptId ? { manuscript_id: manuscriptId } : {}),
    };

    const wikiMeta = body.wiki_metadata;
    if (wikiMeta != null && typeof wikiMeta === "object" && !Array.isArray(wikiMeta)) {
      const allowed = [
        "spoiler_level",
        "plot_point",
        "plot_point_order",
        "era",
        "source_type",
        "outline_entity_kind",
        "wiki_visibility",
        "narrative_master_logic",
        "wiki_form_tier",
        "wiki_form_answers",
        "rag_template",
        "world_bible_section",
        "tags",
      ] as const;
      for (const key of allowed) {
        if ((wikiMeta as Record<string, unknown>)[key] !== undefined) {
          metadata[key] = (wikiMeta as Record<string, unknown>)[key];
        }
      }
    }

    const analysisPack = analyzeChapterSubmission({
      chapterText: excerpt,
      hudAnswerBullets: null,
      stylisticMetadata: stylistic_metadata,
    });

    const supabase = getSupabaseAdmin();
    const { data: ins, error: insErr } = await supabase
      .from("p4_narrative_library_chunks")
      .insert({
        tenant_id: tenantId,
        source_document: sourceDocument,
        chunk_type: p4Type,
        chunk_index: 0,
        content: snapshotBody,
        word_count: excerpt.split(/\s+/).filter(Boolean).length,
        embedding,
        metadata,
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      console.error("[p4/lore-git/commit]", insErr.message);
      return res.status(500).json({ error: insErr.message });
    }

    return res.status(201).json({
      success: true,
      source_id: (ins as { id?: string } | null)?.id ?? null,
      chunks_total: 1,
      chunks_inserted: 1,
      ledger: "wiki_snapshot",
      wiki_visibility: "draft",
      audience: "author",
      lore_extraction_commit: true,
      authorship_delta_score: analysisPack.authorship_delta_score,
      stylistic_analysis_version: analysisPack.stylistic_analysis_version,
      stylistic_analysis: analysisPack.stylistic_analysis,
    });
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[p4/lore-git/commit]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Internal error" });
  }
});
