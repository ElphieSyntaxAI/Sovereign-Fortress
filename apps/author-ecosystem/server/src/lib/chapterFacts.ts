/**
 * Chapter-scoped major-event fact extraction (lightweight vs full document ingest).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { areNearDuplicateTexts } from "./documentIngestCompile.js";
import type { ProposedWikiEntry } from "./documentIngestGate.js";
import { groundProposedWikiToSource } from "./documentIngestMsgfPipeline.js";
import { retrieveP4NarrativeChunks } from "./p4RagRetrieval.js";
import {
  buildWikiProvenance,
  formatWikiProvenanceRef,
  type WikiProvenance,
} from "./wikiProvenance.js";

export type ContinuityFlagStatus = "ok" | "drift" | "conflict";

export type ContinuityFlag = {
  status: ContinuityFlagStatus;
  note: string;
  matched_title?: string;
};

export type ChapterFactCard = ProposedWikiEntry & {
  continuity_flags?: ContinuityFlag;
  provenance?: WikiProvenance;
  ref_label?: string;
  major_event?: boolean;
};

const MAX_CHAPTER_FACTS = 18;

function hasGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

/** Heuristic major events from chapter freewriting. */
export function extractHeuristicChapterFacts(
  text: string,
  manuscriptId: string,
  chapterNumber?: number | null
): ChapterFactCard[] {
  const provenance = buildWikiProvenance({
    source: "live_manuscript",
    channel: "chapter_facts",
    manuscriptId,
    chapterNumber: chapterNumber ?? null,
  });
  const cards: ChapterFactCard[] = [];
  const paras = text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 60);

  const eventRe =
    /\b(arrived|fled|died|killed|revealed|betrayed|married|escaped|declared|war|alliance|crowned|banished|destroyed|opened the|crossed|discovered|confessed|vanished)\b/i;

  for (const para of paras) {
    if (!eventRe.test(para) && !/^chapter\s+\d+/i.test(para)) continue;
    const title =
      para.slice(0, 80).replace(/[.!?].*$/, "").trim() ||
      (chapterNumber != null ? `Chapter ${chapterNumber} event` : "Chapter event");
    if (cards.some((c) => areNearDuplicateTexts(c.excerpt, para))) continue;
    cards.push({
      title: title.slice(0, 100),
      excerpt: para.slice(0, 520),
      chunk_type: "event",
      tags: ["chapter_fact", "major_event", "live_manuscript"],
      wiki_metadata: {
        ledger: "wiki_snapshot",
        manuscript_id: manuscriptId,
        outline_entity_kind: "plot_point",
        chapter_fact: true,
        major_event: true,
        chapter_number: chapterNumber ?? null,
        wiki_visibility: "draft",
        wiki_author_entry: true,
        provenance,
      },
      provenance,
      ref_label: formatWikiProvenanceRef(provenance),
      major_event: true,
    });
    if (cards.length >= MAX_CHAPTER_FACTS) break;
  }

  // POV / character name leads
  const povMatches = text.matchAll(
    /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s*(?:'s)?\s*(?:POV|pov|point of view)\b/g
  );
  for (const m of povMatches) {
    const name = String(m[1] ?? "").trim();
    if (name.length < 2) continue;
    if (cards.some((c) => c.title.toLowerCase() === name.toLowerCase())) continue;
    const idx = text.indexOf(m[0]!);
    const excerpt = text.slice(Math.max(0, idx - 40), idx + 380).replace(/\s+/g, " ").trim();
    if (excerpt.length < 40) continue;
    cards.push({
      title: name,
      excerpt: excerpt.slice(0, 520),
      chunk_type: "character",
      tags: ["chapter_fact", "pov", "live_manuscript"],
      wiki_metadata: {
        ledger: "wiki_snapshot",
        manuscript_id: manuscriptId,
        outline_entity_kind: "character",
        chapter_fact: true,
        chapter_number: chapterNumber ?? null,
        wiki_visibility: "draft",
        wiki_author_entry: true,
        provenance,
      },
      provenance,
      ref_label: formatWikiProvenanceRef(provenance),
    });
    if (cards.length >= MAX_CHAPTER_FACTS) break;
  }

  return cards.slice(0, MAX_CHAPTER_FACTS);
}

async function extractLlmChapterFacts(
  text: string,
  manuscriptId: string,
  chapterNumber?: number | null
): Promise<ChapterFactCard[]> {
  if (!hasGemini()) return [];
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.0-flash" });
    const slice = text.slice(0, 28_000);
    const prompt = `Extract ONLY major chapter facts from this manuscript chapter (not every sentence).
Return JSON: {"facts":[{"title":"string","excerpt":"verbatim quote >=40 chars from the text","kind":"plot_point|character|environment|note","major_event":true|false}]}
Max ${MAX_CHAPTER_FACTS} facts. Prefer plot-changing events, POV character state, breadcrumbs/foreshadow.
Chapter number hint: ${chapterNumber ?? "unknown"}

TEXT:
${slice}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as {
      facts?: Array<{ title?: string; excerpt?: string; kind?: string; major_event?: boolean }>;
    };
    const provenance = buildWikiProvenance({
      source: "live_manuscript",
      channel: "chapter_facts",
      manuscriptId,
      chapterNumber: chapterNumber ?? null,
    });
    const out: ChapterFactCard[] = [];
    for (const f of parsed.facts ?? []) {
      const title = String(f.title ?? "").trim();
      const excerpt = String(f.excerpt ?? "").trim();
      if (title.length < 2 || excerpt.length < 40) continue;
      const kind = String(f.kind ?? "plot_point").trim();
      out.push({
        title: title.slice(0, 100),
        excerpt: excerpt.slice(0, 520),
        chunk_type: kind === "character" ? "character" : kind === "plot_point" ? "event" : "location",
        tags: ["chapter_fact", "live_manuscript", f.major_event ? "major_event" : "fact"].filter(
          Boolean
        ) as string[],
        wiki_metadata: {
          ledger: "wiki_snapshot",
          manuscript_id: manuscriptId,
          outline_entity_kind: kind,
          chapter_fact: true,
          major_event: f.major_event === true,
          chapter_number: chapterNumber ?? null,
          wiki_visibility: "draft",
          wiki_author_entry: true,
          provenance,
        },
        provenance,
        ref_label: formatWikiProvenanceRef(provenance),
        major_event: f.major_event === true,
      });
      if (out.length >= MAX_CHAPTER_FACTS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function proposeChapterFacts(params: {
  text: string;
  manuscriptId: string;
  chapterNumber?: number | null;
}): Promise<{ cards: ChapterFactCard[]; used_llm: boolean }> {
  const llm = await extractLlmChapterFacts(
    params.text,
    params.manuscriptId,
    params.chapterNumber
  );
  const heuristic = extractHeuristicChapterFacts(
    params.text,
    params.manuscriptId,
    params.chapterNumber
  );
  const merged = [...llm];
  for (const h of heuristic) {
    if (merged.some((m) => areNearDuplicateTexts(m.excerpt, h.excerpt))) continue;
    merged.push(h);
    if (merged.length >= MAX_CHAPTER_FACTS) break;
  }
  const grounded = groundProposedWikiToSource(merged, params.text);
  const cards = grounded.kept.map((k) => {
    const c = k as ChapterFactCard;
    return {
      ...c,
      ref_label: formatWikiProvenanceRef(c.provenance ?? readProv(c)),
    };
  });
  return { cards, used_llm: llm.length > 0 };
}

function readProv(c: ChapterFactCard): WikiProvenance | undefined {
  const p = c.wiki_metadata?.provenance;
  if (p && typeof p === "object") return p as WikiProvenance;
  return c.provenance;
}

export async function attachContinuityFlags(
  supabase: SupabaseClient,
  params: { tenantId: string; manuscriptId: string; cards: ChapterFactCard[] }
): Promise<ChapterFactCard[]> {
  const out: ChapterFactCard[] = [];
  for (const card of params.cards) {
    let flag: ContinuityFlag = {
      status: "drift",
      note: "New major fact — not clearly present in planning bible/outline",
    };
    try {
      const { chunks } = await retrieveP4NarrativeChunks(supabase, {
        tenantId: params.tenantId,
        manuscriptId: params.manuscriptId,
        question: `${card.title}. ${card.excerpt.slice(0, 240)}`,
        topK: 6,
        includeWikiDrafts: true,
        audience: "author",
        chunkTypes: ["lore", "plot", "character"],
      });
      const settled = chunks.filter((h) => h.metadata?.merge_pending !== true);
      if (settled.length === 0) {
        out.push({ ...card, continuity_flags: flag });
        continue;
      }
      const best = settled[0]!;
      const bestTitle = String(
        best.metadata?.proposed_chunk_title ?? best.source_document ?? "wiki"
      );
      if (areNearDuplicateTexts(best.content, card.excerpt)) {
        flag = {
          status: "ok",
          note: `Reinforces existing lore: ${bestTitle}`,
          matched_title: bestTitle,
        };
      } else {
        const overlap = tokenOverlap(best.content, card.excerpt);
        if (overlap >= 0.35) {
          flag = {
            status: "conflict",
            note: `Diverges from existing lore «${bestTitle}» — open Lore Merge on save if same entity`,
            matched_title: bestTitle,
          };
        } else {
          flag = {
            status: "drift",
            note: `Related retrieval «${bestTitle}» but looks like a new event`,
            matched_title: bestTitle,
          };
        }
      }
    } catch {
      /* keep drift default */
    }
    out.push({ ...card, continuity_flags: flag });
  }
  return out;
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(
    a
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
  );
  const tb = new Set(
    b
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
  );
  if (ta.size < 3 || tb.size < 3) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.min(ta.size, tb.size);
}
