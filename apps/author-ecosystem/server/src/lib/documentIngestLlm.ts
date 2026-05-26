import { createRequire } from "node:module";

import type {
  AuthorshipQuestion,
  IngestOutlineBeat,
  ProposedWikiEntry,
  ScanThought,
} from "./documentIngestGate.js";
import { MAX_LLM_DOCUMENT_CHARS, MAX_WIKI_PROPOSED } from "./documentIngestLimits.js";
import {
  extractOutlineBeatsFromText,
  mergePlotBeats,
  plotBeatsToSceneWikiEntries,
} from "./documentIngestOutline.js";
import { buildHeuristicScanThoughts, heuristicProposedWiki } from "./documentIngestGate.js";
import type { DocumentIngestSlot } from "./documentIngestGate.js";
import { authorshipQuestionCount } from "./documentIngestGate.js";
import type {
  ClarifyingQuestion,
  ContentSignal,
  IngestConflict,
  StoryFingerprint,
} from "./documentIngestStructure.js";
import {
  buildClarifyingQuestions,
  detectContentSignals,
  detectInDocumentConflicts,
  extractStoryFingerprint,
  inferWikiFromSignals,
  loadManuscriptProjectContext,
  mergeConflicts,
} from "./documentIngestStructure.js";
import type { SupabaseClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { generateBullets } = require("../services/geminiClient.js") as {
  generateBullets: (opts: { system: string; user: string; model?: string }) => Promise<string>;
};

function parseJsonStripFences(text: string): unknown {
  let s = String(text || "").trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)```/im);
  if (m) s = m[1].trim();
  return JSON.parse(s) as unknown;
}

const ENRICH_SYSTEM = [
  "You map AUTHOR UPLOADS into a story database. Ignore document type/filename — read CONTENT ONLY.",
  "Forms you may see mixed in one file: scene cards, chapter breakdowns, character cards, world bible, notes, beat sheets, full draft prose, bullet outlines, TABLES (markdown | col | rows or tab-separated rows), SECTION breaks (--- SECTION ---), and GOOGLE DOC TABS (--- TAB: Tab Name ---).",
  "Planning layers (use in wiki_metadata.planning_layer): front_matter (prologue, epigraph), book_synopsis, macro_outline (beginning/general outline — act-level, NOT per chapter), chapter_breakdown (per-chapter sections), scene_grid (scene 1..N tables or cards).",
  "POV: if a chapter has one 'Name Pov' line → single POV; if two+ POV lines or text says 'split POV' → split POV. Do not duplicate the same Beginning/macro blurb from multiple tabs.",
  "Do NOT collapse macro_outline and chapter_breakdown — they are different planning depths. Do NOT merge scene_grid rows into one beat.",
  "For tables: treat EACH DATA ROW as its own outline_beat and/or proposed_wiki entry. A 30-row scene table must yield ~30 outline_beats unless rows are duplicates.",
  "Output ONLY valid JSON (no markdown).",
  `Schema: {
  "thoughts":["string"],
  "content_signals":[{"kind":"scene_cards|chapter_breakdown|character_cards|world_lore|notes_brainstorm|full_draft|outline_list|mixed","confidence":"high|medium|low","evidence":"string"}],
  "story_fingerprint":{"working_title":null,"protagonist_names":["string"],"setting_anchors":["string"],"tone_or_genre":null},
  "conflicts":[{"code":"string","severity":"blocking|warning","message":"string"}],
  "clarifying_questions":[{"id":"string","code":"string","question":"string","hint":"string","required":true,"options":["string"]}],
  "proposed_wiki":[{"title":"string","excerpt":"string (verbatim from doc, >=40 chars)","chunk_type":"character|location|plot|theme|other","outline_entity_kind":"character|setting|environment|plot_point|genre|theme|spoiler|note|chapter","tags":["string"],"plot_point_order":1}],
  "outline_beats":[{"synopsis":"string","order":0,"plot_point_order":1}],
  "questions":[{"id":"q1","question":"string","hint":"phrase in text"}]
}`,
  "Map every distinct story fact to proposed_wiki building blocks. Excerpts must be copied from the document, not invented.",
  "outline_beats: one row per scene/chapter/beat card — synopsis summarizes that unit for Plot Sandbox.",
  "conflicts: flag multiple unrelated books in one file, contradictory timelines, or cast that cannot coexist. severity=blocking if merging would corrupt the manuscript.",
  "clarifying_questions: ask the author when unsure (two WIPs, old draft vs new, wrong slot). required=true only when blocking.",
  "questions: authorship proof only; count matches user request.",
].join("\n");

function parseLlmConflicts(raw: unknown): IngestConflict[] {
  if (!Array.isArray(raw)) return [];
  const out: IngestConflict[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const c = row as Record<string, unknown>;
    const message = String(c.message ?? "").trim();
    if (!message) continue;
    const severity = String(c.severity ?? "warning") === "blocking" ? "blocking" : "warning";
    out.push({
      code: String(c.code ?? "llm_conflict").slice(0, 64),
      severity,
      message,
    });
  }
  return out;
}

function parseLlmClarifying(raw: unknown): ClarifyingQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: ClarifyingQuestion[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const q = row as Record<string, unknown>;
    const question = String(q.question ?? "").trim();
    if (!question) continue;
    out.push({
      id: String(q.id ?? `cq${out.length + 1}`),
      code: String(q.code ?? "clarify"),
      question,
      hint: String(q.hint ?? "").trim() || undefined,
      required: q.required !== false,
      options: Array.isArray(q.options) ? q.options.map((o) => String(o)) : undefined,
    });
  }
  return out.slice(0, 6);
}

function parseContentSignals(raw: unknown): ContentSignal[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set([
    "scene_cards",
    "chapter_breakdown",
    "character_cards",
    "world_lore",
    "notes_brainstorm",
    "full_draft",
    "outline_list",
    "mixed",
  ]);
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const row = r as Record<string, unknown>;
      const kind = String(row.kind ?? "mixed");
      return {
        kind: (allowed.has(kind) ? kind : "mixed") as ContentSignal["kind"],
        confidence: String(row.confidence ?? "medium") === "high" ? "high" : String(row.confidence) === "low" ? "low" : "medium",
        evidence: String(row.evidence ?? "").slice(0, 200),
      } as ContentSignal;
    })
    .slice(0, 8);
}

function parseFingerprint(raw: unknown, fallback: StoryFingerprint): StoryFingerprint {
  if (!raw || typeof raw !== "object") return fallback;
  const f = raw as Record<string, unknown>;
  return {
    working_title: f.working_title != null ? String(f.working_title).slice(0, 120) : fallback.working_title,
    protagonist_names: Array.isArray(f.protagonist_names)
      ? f.protagonist_names.map((n) => String(n)).filter(Boolean).slice(0, 8)
      : fallback.protagonist_names,
    setting_anchors: Array.isArray(f.setting_anchors)
      ? f.setting_anchors.map((n) => String(n)).filter(Boolean).slice(0, 8)
      : fallback.setting_anchors,
    tone_or_genre:
      f.tone_or_genre != null ? String(f.tone_or_genre).slice(0, 80) : fallback.tone_or_genre,
  };
}

export async function analyzeDocumentIngest(params: {
  supabase: SupabaseClient;
  text: string;
  slot: DocumentIngestSlot;
  manuscriptId: string;
  questionCount: number;
}): Promise<{
  thoughts: ScanThought[];
  proposed: ProposedWikiEntry[];
  outline_beats: IngestOutlineBeat[];
  questions: AuthorshipQuestion[];
  content_signals: ContentSignal[];
  story_fingerprint: StoryFingerprint;
  ingest_conflicts: IngestConflict[];
  clarifying_questions: ClarifyingQuestion[];
  usedLlm: boolean;
}> {
  const heuristicThoughts = buildHeuristicScanThoughts(params.text, params.slot);
  const heuristicWiki = heuristicProposedWiki(params.text, params.slot, params.manuscriptId);
  const textBeats = extractOutlineBeatsFromText(params.text);
  const sceneWiki = plotBeatsToSceneWikiEntries(textBeats, params.manuscriptId, params.slot);

  const content_signals = detectContentSignals(params.text);
  const fingerprint = extractStoryFingerprint(params.text);
  const heuristicConflicts = detectInDocumentConflicts(params.text, params.slot);
  const { outline: existingOutline } = await loadManuscriptProjectContext(
    params.supabase,
    params.manuscriptId
  );

  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();

  let llmSignals = content_signals;
  let llmFingerprint = fingerprint;
  let llmConflicts: IngestConflict[] = [];
  let llmClarifying: ClarifyingQuestion[] = [];
  let thoughts = heuristicThoughts;
  let proposed: ProposedWikiEntry[] = [];
  let outline_beats = mergePlotBeats([], textBeats);
  let questions: AuthorshipQuestion[] = [];
  let usedLlm = false;

  if (key) {
    try {
      const raw = await generateBullets({
        system: ENRICH_SYSTEM,
        user: [
          `Slot hint (soft): ${params.slot}`,
          `Manuscript id: ${params.manuscriptId}`,
          `Existing outline excerpt (may be empty): ${(existingOutline ?? "").slice(0, 2000)}`,
          `Authorship questions to generate: ${params.questionCount}`,
          "",
          "Document:",
          params.text.slice(0, MAX_LLM_DOCUMENT_CHARS),
        ].join("\n"),
      });
      const parsed = parseJsonStripFences(raw) as Record<string, unknown>;
      usedLlm = true;

      const thoughtsRaw = Array.isArray(parsed.thoughts) ? parsed.thoughts : [];
      const mapped: ScanThought[] = thoughtsRaw
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, 10)
        .map((line, i) => ({
          line,
          phase: (i < 2
            ? "scan"
            : i < 4
              ? "structure"
              : i < 6
                ? "character"
                : i < 8
                  ? "lore"
                  : "done") as ScanThought["phase"],
        }));
      if (mapped.length) thoughts = mapped;

      const parsedSignals = parseContentSignals(parsed.content_signals);
      if (parsedSignals.length) llmSignals = parsedSignals;
      llmFingerprint = parseFingerprint(parsed.story_fingerprint, fingerprint);
      llmConflicts = parseLlmConflicts(parsed.conflicts);
      llmClarifying = parseLlmClarifying(parsed.clarifying_questions);

      const wikiRaw = parsed.proposed_wiki;
      if (Array.isArray(wikiRaw)) {
        for (const row of wikiRaw) {
          if (!row || typeof row !== "object") continue;
          const w = row as Record<string, unknown>;
          const title = String(w.title ?? "").trim();
          const excerpt = String(w.excerpt ?? "").trim();
          if (title.length < 2 || excerpt.length < 40) continue;
          const kind = String(w.outline_entity_kind ?? "plot_point").trim();
          proposed.push({
            title,
            excerpt,
            chunk_type: String(w.chunk_type ?? "other"),
            tags: Array.isArray(w.tags) ? w.tags.map((t) => String(t)) : ["file_import"],
            wiki_metadata: { outline_entity_kind: kind },
            plot_point_order:
              w.plot_point_order != null ? Number(w.plot_point_order) : undefined,
          });
        }
      }

      const llmBeats: IngestOutlineBeat[] = [];
      const beatsRaw = parsed.outline_beats;
      if (Array.isArray(beatsRaw)) {
        for (const row of beatsRaw) {
          if (!row || typeof row !== "object") continue;
          const b = row as Record<string, unknown>;
          const synopsis = String(b.synopsis ?? "").trim();
          if (!synopsis) continue;
          llmBeats.push({
            synopsis,
            order: Number(b.order ?? llmBeats.length),
            plot_point_order:
              b.plot_point_order != null ? Number(b.plot_point_order) : undefined,
          });
        }
      }
      outline_beats = mergePlotBeats(llmBeats, textBeats);

      const qRaw = parsed.questions;
      if (params.questionCount > 0 && Array.isArray(qRaw)) {
        for (const row of qRaw.slice(0, params.questionCount)) {
          if (!row || typeof row !== "object") continue;
          const q = row as Record<string, unknown>;
          const question = String(q.question ?? "").trim();
          if (!question) continue;
          questions.push({
            id: String(q.id ?? `q${questions.length + 1}`),
            question,
            hint: String(q.hint ?? "").trim() || undefined,
          });
        }
      }
    } catch {
      usedLlm = false;
    }
  }

  if (!proposed.length) {
    proposed = [...heuristicWiki, ...sceneWiki];
  } else if (
    !proposed.some((p) => String(p.wiki_metadata?.outline_entity_kind) === "plot_point")
  ) {
    proposed = [...proposed, ...sceneWiki];
  }

  proposed = inferWikiFromSignals(
    params.text,
    llmSignals,
    params.manuscriptId,
    params.slot,
    proposed
  );

  const ingest_conflicts = mergeConflicts(heuristicConflicts, llmConflicts);
  const clarifying_questions = [
    ...llmClarifying,
    ...buildClarifyingQuestions(ingest_conflicts, llmFingerprint, existingOutline),
  ].filter(
    (q, i, arr) => arr.findIndex((x) => x.code === q.code) === i
  );

  thoughts.push({
    phase: "structure",
    line: `Mapped as: ${llmSignals.map((s) => s.kind).join(", ")} — building wiki + outline from content.`,
  });

  if (ingest_conflicts.some((c) => c.severity === "blocking")) {
    thoughts.push({
      phase: "structure",
      line: "Possible mixed WIPs or contradictions — we will ask you to clarify before merging.",
    });
  }

  return {
    thoughts,
    proposed: proposed.slice(0, MAX_WIKI_PROPOSED),
    outline_beats,
    questions,
    content_signals: llmSignals,
    story_fingerprint: llmFingerprint,
    ingest_conflicts,
    clarifying_questions,
    usedLlm,
  };
}

/** @deprecated use analyzeDocumentIngest */
export async function enrichDocumentIngestWithLlm(params: {
  text: string;
  slot: DocumentIngestSlot;
  manuscriptId: string;
  questionCount: number;
  supabase?: SupabaseClient;
}): Promise<{
  thoughts: ScanThought[];
  proposed: ProposedWikiEntry[];
  outline_beats: IngestOutlineBeat[];
  questions: AuthorshipQuestion[];
  usedLlm: boolean;
  content_signals?: ContentSignal[];
  story_fingerprint?: StoryFingerprint;
  ingest_conflicts?: IngestConflict[];
  clarifying_questions?: ClarifyingQuestion[];
}> {
  if (!params.supabase) {
    const textBeats = extractOutlineBeatsFromText(params.text);
    return {
      thoughts: buildHeuristicScanThoughts(params.text, params.slot),
      proposed: heuristicProposedWiki(params.text, params.slot, params.manuscriptId),
      outline_beats: textBeats,
      questions: [],
      usedLlm: false,
    };
  }
  const r = await analyzeDocumentIngest({
    supabase: params.supabase,
    text: params.text,
    slot: params.slot,
    manuscriptId: params.manuscriptId,
    questionCount: params.questionCount,
  });
  return r;
}

export function fallbackAuthorshipQuestions(count: number): AuthorshipQuestion[] {
  const pool = [
    {
      id: "q1",
      question: "Quote a specific place name or location phrase that appears in your document.",
      hint: "city, town, room",
    },
    {
      id: "q2",
      question: "Name a character or proper noun exactly as written in the text.",
      hint: "capitalized name",
    },
    {
      id: "q3",
      question: "Paste a distinctive object or detail mentioned in the document (a few words).",
      hint: "object",
    },
    {
      id: "q4",
      question: "What distinctive phrase or sentence opening appears in your upload?",
      hint: "first line",
    },
    {
      id: "q5",
      question: "Mention a verb or action word used in a pivotal moment in the text.",
      hint: "action",
    },
  ];
  return pool.slice(0, Math.max(3, Math.min(count, pool.length)));
}

export function resolveQuestionCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return authorshipQuestionCount(words);
}
