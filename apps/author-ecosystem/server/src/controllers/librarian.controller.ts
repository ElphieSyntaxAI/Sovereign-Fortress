import { Router, type Request, type Response } from "express";

import { assertUuid, HalValidationError } from "../lib/halMetrics.js";
import {
  LibrarianChat,
  type LibrarianAudienceMode,
  type LibrarianLanguage,
  type LibrarianLanguageDetectionMode,
  type LibrarianTenantScope,
} from "../lib/narrative/LibrarianChat.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

const ALLOWED_CHUNK_TYPES = new Set(["lore", "plot", "character"]);

function parseChunkTypes(raw: unknown): Array<"lore" | "plot" | "character"> | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: Array<"lore" | "plot" | "character"> = [];
  for (const x of raw) {
    const s = String(x).toLowerCase().trim();
    if (!ALLOWED_CHUNK_TYPES.has(s)) {
      throw new Error(`Invalid chunkTypes entry: ${s}`);
    }
    out.push(s as "lore" | "plot" | "character");
  }
  return out;
}

export const librarianController = Router();

/**
 * POST /api/librarian/ask
 * Body: { tenantId, question, topK?, audience?, chunkTypes?, enforceMode?, language?, languageDetection?, tenantScope? }
 */
librarianController.post("/api/librarian/ask", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "JSON body required" });
    }

    const tenantId = assertUuid(String(body.tenantId ?? ""), "tenantId");
    const question = String(body.question ?? "").trim();
    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }

    const audienceRaw = String(body.audience ?? "author").toLowerCase();
    if (audienceRaw !== "fan" && audienceRaw !== "author") {
      return res.status(400).json({ error: "audience must be 'fan' or 'author'" });
    }
    const audience = audienceRaw as LibrarianAudienceMode;

    let chunkTypes: Array<"lore" | "plot" | "character"> | undefined;
    try {
      chunkTypes = parseChunkTypes(body.chunkTypes);
    } catch (e) {
      return res.status(400).json({
        error: e instanceof Error ? e.message : "Invalid chunkTypes",
      });
    }

    const enforceMode = body.enforceMode === "strip" ? "strip" : "strict";
    const topK = body.topK != null ? Number(body.topK) : undefined;

    let language: LibrarianLanguage | undefined;
    if (body.language != null && String(body.language).trim() !== "") {
      const l = String(body.language).toLowerCase().trim();
      if (l !== "en" && l !== "es" && l !== "ja") {
        return res.status(400).json({ error: "language must be en, es, or ja" });
      }
      language = l as LibrarianLanguage;
    }

    let languageDetection: LibrarianLanguageDetectionMode | undefined;
    if (body.languageDetection != null && String(body.languageDetection).trim() !== "") {
      const d = String(body.languageDetection).toLowerCase().trim();
      if (d !== "heuristic" && d !== "gemini") {
        return res.status(400).json({ error: "languageDetection must be heuristic or gemini" });
      }
      languageDetection = d as LibrarianLanguageDetectionMode;
    }

    let tenantScope: LibrarianTenantScope = "author";
    if (body.tenantScope != null && String(body.tenantScope).trim() !== "") {
      const ts = String(body.tenantScope).toLowerCase().trim();
      if (ts !== "author" && ts !== "school") {
        return res.status(400).json({ error: "tenantScope must be author or school" });
      }
      tenantScope = ts as LibrarianTenantScope;
    }

    const chat = new LibrarianChat(getSupabaseAdmin());
    const result = await chat.ask({
      tenantId,
      question,
      topK,
      audience,
      chunkTypes,
      enforceMode,
      language,
      languageDetection,
      tenantScope,
    });

    return res.status(200).json({
      ok: true,
      answer: result.answer,
      detectedLanguage: result.detectedLanguage,
      tenantScope,
      retrievedChunks: result.retrievedChunks,
    });
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    if (/bullet|Librarian output|Model output/i.test(msg)) {
      return res.status(502).json({ error: "Librarian output failed validation", detail: msg });
    }
    console.error("[librarian/ask]", e);
    return res.status(500).json({ error: msg });
  }
});
