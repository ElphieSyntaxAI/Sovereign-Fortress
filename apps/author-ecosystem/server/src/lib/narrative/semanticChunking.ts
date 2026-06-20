import type { EmbedBatchFn } from "./narrativeEmbedder.js";
import { loadDocumentIngestKeywords, matchKeywordHintsInText } from "../documentIngestKeywords.js";

export type SemanticBoundarySource = "heuristic" | "embed" | "converge" | "keyword";

export type SemanticBoundary = {
  charOffset: number;
  label?: string;
  source: SemanticBoundarySource;
};

export type SemanticRegion = {
  domain: string;
  anchor_excerpt: string;
  char_hint?: number;
};

export type SemanticShardMeta = {
  semantic_domain?: string;
  boundary_sources: string[];
  segment_index: number;
};

export type ChunkTextSemanticOptions = {
  boundaries?: SemanticBoundary[];
  maxWords?: number;
  overlapWords?: number;
  embedBatch?: EmbedBatchFn;
  semanticRegions?: SemanticRegion[];
};

const DOMAIN_KEYWORDS = [
  "technology",
  "government",
  "politics",
  "species",
  "history",
  "magic",
  "religion",
  "geography",
  "economy",
  "culture",
  "military",
  "biology",
  "physics",
  "propulsion",
  "climate",
  "language",
];

const MIN_SEMANTIC_WORDS = 400;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

function dedupeBoundaries(boundaries: SemanticBoundary[]): SemanticBoundary[] {
  const sorted = [...boundaries].sort((a, b) => a.charOffset - b.charOffset);
  const kept: SemanticBoundary[] = [];
  for (const b of sorted) {
    if (b.charOffset < 0) continue;
    const prev = kept[kept.length - 1];
    if (prev && Math.abs(prev.charOffset - b.charOffset) < 24) {
      if (!prev.label && b.label) kept[kept.length - 1] = b;
      continue;
    }
    kept.push(b);
  }
  return kept;
}

function findLineStartOffset(text: string, lineIndex: number): number {
  let offset = 0;
  let line = 0;
  for (let i = 0; i < text.length; i++) {
    if (line === lineIndex) return offset;
    if (text[i] === "\n") {
      line += 1;
      offset = i + 1;
    }
  }
  return offset;
}

/** Heuristic topical boundaries without embedding cost. */
export function detectHeuristicBoundaries(text: string): SemanticBoundary[] {
  const boundaries: SemanticBoundary[] = [];
  const lines = text.split("\n");
  let charOffset = 0;
  let prevDomainKeyword: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    const lineStart = findLineStartOffset(text, i);

    if (i > 0 && trimmed.length === 0) {
      charOffset = lineStart + line.length + 1;
      continue;
    }

    const prevBlank = i > 0 && (lines[i - 1] ?? "").trim().length === 0;

    if (trimmed.length >= 8 && /^[A-Z0-9][A-Z0-9\s\-:&]{6,}$/.test(trimmed) && /[A-Z]{2,}/.test(trimmed)) {
      boundaries.push({ charOffset: lineStart, label: trimmed.slice(0, 60), source: "heuristic" });
    } else if (
      prevBlank &&
      trimmed.length >= 6 &&
      /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(trimmed) &&
      trimmed.length < 80
    ) {
      boundaries.push({ charOffset: lineStart, label: trimmed.slice(0, 60), source: "heuristic" });
    } else if (/^(?:\d+\.|(?:I|II|III|IV|V|VI|VII|VIII|IX|X)+[\.)]\s)/.test(trimmed)) {
      boundaries.push({ charOffset: lineStart, label: trimmed.slice(0, 40), source: "heuristic" });
    } else if (/^section\s*[:\-]/i.test(trimmed)) {
      boundaries.push({ charOffset: lineStart, label: trimmed.slice(0, 40), source: "heuristic" });
    } else if (/^---\s*(?:TAB:|SECTION)/i.test(trimmed)) {
      boundaries.push({ charOffset: lineStart, label: trimmed.slice(0, 40), source: "heuristic" });
    }

    const lower = trimmed.toLowerCase();
    for (const kw of DOMAIN_KEYWORDS) {
      if (lower.startsWith(kw) || lower.includes(`${kw}:`) || lower.includes(`${kw} `)) {
        if (prevDomainKeyword && prevDomainKeyword !== kw) {
          boundaries.push({ charOffset: lineStart, label: kw, source: "keyword" });
        }
        prevDomainKeyword = kw;
        break;
      }
    }

    charOffset = lineStart + line.length + 1;
  }

  const sectionMatches = [...text.matchAll(/^---\s*SECTION\s*---/gim)];
  for (const m of sectionMatches) {
    if (typeof m.index === "number") {
      boundaries.push({ charOffset: m.index, label: "section", source: "heuristic" });
    }
  }

  const config = loadDocumentIngestKeywords();
  const hits = matchKeywordHintsInText(text.slice(0, 48_000), config);
  for (const hit of hits.slice(0, 8)) {
    const idx = text.toLowerCase().indexOf(hit.toLowerCase());
    if (idx > 0) {
      boundaries.push({ charOffset: idx, label: hit, source: "keyword" });
    }
  }

  return dedupeBoundaries(boundaries);
}

export function mergeBoundaryHints(...groups: SemanticBoundary[][]): SemanticBoundary[] {
  return dedupeBoundaries(groups.flat());
}

/** Map CONVERGE semantic_regions anchors to char offsets in source text. */
export function resolveSemanticRegionsToBoundaries(
  regions: SemanticRegion[],
  sourceText: string
): SemanticBoundary[] {
  const srcNorm = sourceText.replace(/\s+/g, " ");
  const boundaries: SemanticBoundary[] = [];

  for (const region of regions) {
    const domain = String(region.domain ?? "").trim();
    const anchor = String(region.anchor_excerpt ?? "").trim();
    if (!anchor || anchor.length < 20) continue;

    let charOffset =
      typeof region.char_hint === "number" && region.char_hint >= 0 ? region.char_hint : -1;

    if (charOffset < 0) {
      const direct = sourceText.indexOf(anchor.slice(0, Math.min(120, anchor.length)));
      if (direct >= 0) charOffset = direct;
    }
    if (charOffset < 0) {
      const normAnchor = anchor.replace(/\s+/g, " ").slice(0, 80);
      const idx = srcNorm.indexOf(normAnchor);
      if (idx >= 0) charOffset = idx;
    }
    if (charOffset < 0) continue;

    boundaries.push({
      charOffset,
      label: domain || undefined,
      source: "converge",
    });
  }

  return dedupeBoundaries(boundaries);
}

function splitIntoParagraphs(text: string): Array<{ start: number; text: string }> {
  const parts = text.split(/\n\n+/);
  const out: Array<{ start: number; text: string }> = [];
  let cursor = 0;
  for (const part of parts) {
    const idx = text.indexOf(part, cursor);
    const start = idx >= 0 ? idx : cursor;
    const trimmed = part.trim();
    if (trimmed.length > 0) out.push({ start, text: trimmed });
    cursor = start + part.length + 2;
  }
  if (out.length === 0 && text.trim()) out.push({ start: 0, text: text.trim() });
  return out;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Optional embed similarity drop between adjacent paragraph units. */
export async function detectEmbedDropBoundaries(
  text: string,
  embedBatch: EmbedBatchFn
): Promise<SemanticBoundary[]> {
  const threshold = Number(process.env.MSGF_SEMANTIC_CHUNK_THRESHOLD ?? "0.72");
  const maxEmbeds = Number(process.env.MSGF_SEMANTIC_CHUNK_MAX_EMBEDS ?? "40");
  const paragraphs = splitIntoParagraphs(text);
  if (paragraphs.length < 2) return [];

  const units: Array<{ start: number; text: string }> = [];
  for (const p of paragraphs) {
    if (wordCount(p.text) > 120) {
      const sentences = splitSentences(p.text);
      let sentOffset = p.start;
      for (const s of sentences) {
        units.push({ start: sentOffset, text: s });
        sentOffset += s.length + 1;
      }
    } else {
      units.push(p);
    }
  }

  const capped = units.slice(0, maxEmbeds + 1);
  if (capped.length < 2) return [];

  const embeddings = await embedBatch(capped.map((u) => u.text.slice(0, 2000)));
  const boundaries: SemanticBoundary[] = [];

  for (let i = 1; i < capped.length && i < embeddings.length; i++) {
    const prev = embeddings[i - 1];
    const cur = embeddings[i];
    if (!prev || !cur) continue;
    const sim = cosineSimilarity(prev, cur);
    if (sim < threshold) {
      boundaries.push({
        charOffset: capped[i]!.start,
        label: "topic_shift",
        source: "embed",
      });
    }
  }

  return dedupeBoundaries(boundaries);
}

function segmentsFromBoundaries(
  text: string,
  boundaries: SemanticBoundary[]
): Array<{ start: number; end: number; label?: string; sources: string[] }> {
  const offsets = [0, ...boundaries.map((b) => b.charOffset), text.length];
  const unique = [...new Set(offsets.filter((o) => o >= 0 && o <= text.length))].sort((a, b) => a - b);
  const segments: Array<{ start: number; end: number; label?: string; sources: string[] }> = [];

  for (let i = 0; i < unique.length - 1; i++) {
    const start = unique[i]!;
    const end = unique[i + 1]!;
    if (end <= start) continue;
    const matching = boundaries.filter((b) => b.charOffset === start);
    segments.push({
      start,
      end,
      label: matching.find((b) => b.label)?.label,
      sources: [...new Set(matching.map((b) => b.source))],
    });
  }

  if (segments.length === 0) segments.push({ start: 0, end: text.length, sources: [] });
  return segments;
}

function packSegment(
  segmentText: string,
  maxWords: number,
  overlapWords: number
): string[] {
  if (wordCount(segmentText) <= maxWords) return [segmentText.trim()].filter(Boolean);
  const words = segmentText.split(/\s+/).filter(Boolean);
  const step = Math.max(1, maxWords - overlapWords);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + maxWords);
    if (slice.length === 0) break;
    chunks.push(slice.join(" "));
    if (i + maxWords >= words.length) break;
  }
  return chunks;
}

function chunkTextByWordsFallback(text: string, chunkWords: number, overlapWords: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const step = Math.max(1, chunkWords - overlapWords);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + chunkWords);
    if (slice.length === 0) break;
    chunks.push(slice.join(" "));
    if (i + chunkWords >= words.length) break;
  }
  return chunks;
}

/**
 * Build boundary hints for bulk ingest (heuristics + optional CONVERGE regions).
 */
export function buildBoundaryHintsForIngest(
  sourceText: string,
  opts?: { semanticRegions?: SemanticRegion[] }
): SemanticBoundary[] {
  const heuristic = detectHeuristicBoundaries(sourceText);
  const converge = opts?.semanticRegions?.length
    ? resolveSemanticRegionsToBoundaries(opts.semanticRegions, sourceText)
    : [];
  return mergeBoundaryHints(heuristic, converge);
}

export function semanticChunkingEnabled(): boolean {
  const v = process.env.MSGF_SEMANTIC_CHUNKING?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/**
 * Semantic-boundary-aware chunking for bulk RAG shards.
 * Skips semantic pack for documents under MIN_SEMANTIC_WORDS words.
 */
export async function chunkTextSemantic(
  text: string,
  opts: ChunkTextSemanticOptions = {}
): Promise<{ chunks: string[]; shardMeta: SemanticShardMeta[] }> {
  const plain = text.trim();
  if (!plain) return { chunks: [], shardMeta: [] };

  if (wordCount(plain) < MIN_SEMANTIC_WORDS) {
    return {
      chunks: [plain],
      shardMeta: [{ boundary_sources: ["short_doc"], segment_index: 0 }],
    };
  }

  const maxWords = opts.maxWords ?? 500;
  const overlapWords = opts.overlapWords ?? 50;

  let boundaries = mergeBoundaryHints(
    detectHeuristicBoundaries(plain),
    opts.boundaries ?? []
  );

  if (opts.semanticRegions?.length) {
    boundaries = mergeBoundaryHints(
      boundaries,
      resolveSemanticRegionsToBoundaries(opts.semanticRegions, plain)
    );
  }

  if (semanticChunkingEnabled() && opts.embedBatch) {
    try {
      const embedBounds = await detectEmbedDropBoundaries(plain, opts.embedBatch);
      boundaries = mergeBoundaryHints(boundaries, embedBounds);
    } catch (e) {
      console.warn("[semanticChunking] embed boundary filter degraded", e);
    }
  }

  const segments = segmentsFromBoundaries(plain, boundaries);
  const chunks: string[] = [];
  const shardMeta: SemanticShardMeta[] = [];

  segments.forEach((seg, segmentIndex) => {
    const segmentText = plain.slice(seg.start, seg.end).trim();
    if (!segmentText) return;
    const packed = packSegment(segmentText, maxWords, overlapWords);
    for (const chunk of packed) {
      chunks.push(chunk);
      shardMeta.push({
        semantic_domain: seg.label,
        boundary_sources: seg.sources.length ? seg.sources : ["heuristic"],
        segment_index: segmentIndex,
      });
    }
  });

  if (chunks.length === 0) {
    return {
      chunks: chunkTextByWordsFallback(plain, maxWords, overlapWords),
      shardMeta: [{ boundary_sources: ["fallback"], segment_index: 0 }],
    };
  }

  return { chunks, shardMeta };
}
