import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import type { Request, Response } from "express";
import { Router } from "express";
import mammoth from "mammoth";
import multer from "multer";

import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { parseManuscriptToText } from "../lib/narrative/IngestionService.js";

const require = createRequire(import.meta.url);
const { generateBullets } = require("../services/geminiClient.js") as {
  generateBullets: (opts: { system: string; user: string; model?: string }) => Promise<string>;
};

/** Planning-doc discovery ingest (BFF). Does not call `IngestionService.ingestManuscript` or legacy `/api/rag/ingest`. */
export const ingestUploadController = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 18 * 1024 * 1024, files: 1 },
});

const WINDOW_WORDS = 2000;
const MAX_WINDOWS = 48;

const DISCOVERY_MODE_SYSTEM = [
  "You are the Librarian operating in discovery_mode on planning documents.",
  "Extract story signals from the supplied WINDOW text only; do not invent facts not grounded in that window.",
  "Output ONLY valid JSON — no markdown fences, no commentary outside JSON. Schema:",
  '{"identified_lore":{"characters":[],"locations":[],"objects":[]},"identified_beats":[{"summary":"","plot_point_order":1}],"conflicts":[]}',
  "identified_lore: characters, locations, and objects (proper nouns or clear in-world types) visible in the window.",
  "identified_beats: plot beats with plot_point_order on a 1–9 arc ladder when possible (1 hook … 7 climax … 9 resolution); use 0 if unknown.",
  "conflicts: internal contradictions within this window only (empty array if none).",
].join("\n");

function parseJsonStripFences(text: string): unknown {
  let s = String(text || "").trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)```/im);
  if (m) s = m[1].trim();
  return JSON.parse(s) as unknown;
}

export type IdentifiedLore = { characters: string[]; locations: string[]; objects: string[] };
export type IdentifiedBeat = { summary: string; plot_point_order: number };
export type DiscoveryPayload = {
  identified_lore: IdentifiedLore;
  identified_beats: IdentifiedBeat[];
  conflicts: string[];
};

function emptyDiscovery(): DiscoveryPayload {
  return {
    identified_lore: { characters: [], locations: [], objects: [] },
    identified_beats: [],
    conflicts: [],
  };
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x).trim())
    .filter((s) => s.length > 0);
}

function normalizeDiscovery(input: unknown): DiscoveryPayload {
  const out = emptyDiscovery();
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  const o = input as Record<string, unknown>;
  const lore = o["identified_lore"];
  if (lore && typeof lore === "object" && !Array.isArray(lore)) {
    const L = lore as Record<string, unknown>;
    out.identified_lore.characters.push(...normalizeStringArray(L["characters"]));
    out.identified_lore.locations.push(...normalizeStringArray(L["locations"]));
    out.identified_lore.objects.push(...normalizeStringArray(L["objects"]));
  }
  const beats = o["identified_beats"];
  if (Array.isArray(beats)) {
    for (const b of beats) {
      if (!b || typeof b !== "object") continue;
      const B = b as Record<string, unknown>;
      const summary = String(B["summary"] ?? "").trim();
      const order = Number(B["plot_point_order"]);
      if (!summary) continue;
      out.identified_beats.push({
        summary,
        plot_point_order: Number.isFinite(order) ? Math.max(0, Math.min(99, Math.floor(order))) : 0,
      });
    }
  }
  out.conflicts.push(...normalizeStringArray(o["conflicts"]));
  return out;
}

function dedupeStrings(arr: string[], caseInsensitive: boolean): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = caseInsensitive ? s.toLowerCase() : s;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function dedupeBeats(beats: IdentifiedBeat[]): IdentifiedBeat[] {
  const seen = new Set<string>();
  const out: IdentifiedBeat[] = [];
  for (const b of beats) {
    const k = b.summary.toLowerCase().slice(0, 160);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(b);
  }
  return out;
}

function mergeDiscovery(acc: DiscoveryPayload, chunk: DiscoveryPayload): void {
  acc.identified_lore.characters.push(...chunk.identified_lore.characters);
  acc.identified_lore.locations.push(...chunk.identified_lore.locations);
  acc.identified_lore.objects.push(...chunk.identified_lore.objects);
  acc.identified_beats.push(...chunk.identified_beats);
  acc.conflicts.push(...chunk.conflicts);
}

function finalizeDiscovery(acc: DiscoveryPayload): DiscoveryPayload {
  return {
    identified_lore: {
      characters: dedupeStrings(acc.identified_lore.characters, true),
      locations: dedupeStrings(acc.identified_lore.locations, true),
      objects: dedupeStrings(acc.identified_lore.objects, true),
    },
    identified_beats: dedupeBeats(acc.identified_beats),
    conflicts: dedupeStrings(acc.conflicts, false),
  };
}

function chunkMarkdownByWords(markdown: string, windowWords: number): string[] {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += windowWords) {
    chunks.push(words.slice(i, i + windowWords).join(" "));
    if (chunks.length >= MAX_WINDOWS) break;
  }
  return chunks.length ? chunks : [""];
}

async function bufferToMarkdown(buffer: Buffer, originalname: string): Promise<string> {
  const lower = (originalname || "upload").toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  if (ext === "docx" || ext === "doc") {
    const convertToMarkdown = (
      mammoth as unknown as { convertToMarkdown: (o: { buffer: Buffer }) => Promise<{ value?: string }> }
    ).convertToMarkdown;
    const r = await convertToMarkdown({ buffer });
    return String(r.value ?? "").trim();
  }
  const plain = await parseManuscriptToText(buffer, originalname || "upload.txt");
  if (!plain.trim()) return "";
  return plain
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * POST /api/ingest/upload (multipart, field `file`)
 * Converts planning uploads to Markdown, runs discovery_mode in ~2000-word windows via Gemini, merges JSON.
 * Independent of manuscript vector ingest (`IngestionService.ingestManuscript`) and legacy `POST /api/rag/ingest`.
 */
ingestUploadController.post("/api/ingest/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!readBearerUser(req, res)) return;

    const f = req.file;
    if (!f?.buffer?.length) {
      return res.status(400).json({ error: "Missing multipart file field `file`" });
    }

    const markdown = await bufferToMarkdown(f.buffer, f.originalname || "upload");
    if (!markdown.trim()) {
      return res.status(400).json({ error: "Converted document is empty" });
    }

    const windows = chunkMarkdownByWords(markdown, WINDOW_WORDS);
    const merged = emptyDiscovery();
    const window_errors: Array<{ index: number; message: string }> = [];

    for (let i = 0; i < windows.length; i++) {
      const windowText = windows[i];
      if (!windowText.trim()) continue;

      const userPrompt = [
        "Librarian request: system_prompt is discovery_mode.",
        `Window ${i + 1} of ${windows.length} (up to ${WINDOW_WORDS} words each).`,
        "",
        "--- MARKDOWN WINDOW ---",
        windowText,
        "--- END WINDOW ---",
        "",
        "Return ONLY the JSON object described in your system instructions.",
      ].join("\n");

      try {
        const raw = await generateBullets({ system: DISCOVERY_MODE_SYSTEM, user: userPrompt });
        const parsed = parseJsonStripFences(raw);
        mergeDiscovery(merged, normalizeDiscovery(parsed));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        window_errors.push({ index: i, message: msg });
      }
    }

    const discovery = finalizeDiscovery(merged);
    const digest = createHash("sha256").update(markdown, "utf8").digest("hex").slice(0, 24);
    const wordCount = markdown.split(/\s+/).filter(Boolean).length;

    return res.status(200).json({
      success: true,
      system_prompt: "discovery_mode",
      original_filename: f.originalname,
      markdown_word_count: wordCount,
      window_count: windows.length,
      content_digest: digest,
      discovery,
      window_errors,
    });
  } catch (e) {
    console.error("[ingest/upload]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Upload processing failed",
    });
  }
});
