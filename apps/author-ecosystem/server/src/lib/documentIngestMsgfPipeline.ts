import { createRequire } from "node:module";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthorshipQuestion,
  DocumentIngestSlot,
  IngestOutlineBeat,
  ProposedWikiEntry,
  ScanThought,
} from "./documentIngestGate.js";
import { answerFoundInSource, buildHeuristicScanThoughts, heuristicProposedWiki } from "./documentIngestGate.js";
import { MAX_LLM_DOCUMENT_CHARS, MAX_WIKI_PROPOSED } from "./documentIngestLimits.js";
import {
  formatKeywordHintsForPrompt,
  loadDocumentIngestKeywords,
  matchKeywordHintsInText,
} from "./documentIngestKeywords.js";
import {
  extractOutlineBeatsFromText,
  mergePlotBeats,
  plotBeatsToSceneWikiEntries,
} from "./documentIngestOutline.js";
import {
  buildDocumentIngestSignals,
  formatSignalsForConvergePrompt,
} from "./documentIngestSignals.js";
import type {
  ClarifyingQuestion,
  ContentSignal,
  IngestConflict,
  StoryFingerprint,
} from "./documentIngestStructure.js";
import {
  buildClarifyingQuestions,
  detectInDocumentConflicts,
  extractStoryFingerprint,
  inferWikiFromSignals,
  loadManuscriptProjectContext,
  mergeConflicts,
} from "./documentIngestStructure.js";
import {
  parseContentSignals,
  parseFingerprint,
  parseLlmClarifying,
  parseLlmConflicts,
  parseJsonStripFences,
  parseLlmWikiAndBeats,
} from "./documentIngestLlmParse.js";

const require = createRequire(import.meta.url);
const { generateBullets, hasGeminiCredentials } = require("../services/geminiClient.js") as {
  generateBullets: (opts: { system: string; user: string; model?: string }) => Promise<string>;
  hasGeminiCredentials: () => boolean;
};

export type DocumentIngestMode = "converge" | "heuristic" | "hybrid";

export type DocumentIngestMsgfMeta = {
  mode: DocumentIngestMode;
  lineage_reinforcement: string | null;
  signals_summary: string;
  keyword_hits: string[];
  grounding: { kept: number; dropped: number };
};

export function resolveDocumentIngestMode(): DocumentIngestMode {
  const raw = process.env.MSGF_DOCUMENT_INGEST_MODE?.trim().toLowerCase();
  if (raw === "heuristic" || raw === "hybrid" || raw === "converge") return raw;
  return "converge";
}

const CONVERGE_SYSTEM = [
  "MSGF V3.2 Author document ingest — CONVERGE phase.",
  "Map AUTHOR UPLOADS into a story wiki + outline. Read CONTENT ONLY; ignore filename unless it disambiguates slot.",
  "Structural signals and optional keywords are HINTS — never invent facts to satisfy a hint.",
  "Forms you may see: scene cards, chapter breakdowns, character cards, world bible, notes, beat sheets, draft prose, bullet outlines, TABLES (markdown | col |), SECTION breaks (--- SECTION ---), GOOGLE DOC TABS (--- TAB: Name ---).",
  "Planning layers (wiki_metadata.planning_layer when supported): front_matter, book_synopsis, macro_outline, chapter_breakdown, scene_grid, notes.",
  "POV: detect any viewpoint name (Name Pov, Name's POV, Summers POV, POV: Name, told in X's POV, POV column with bare name). One POV → single; two+ or split POV → split. Do not duplicate macro/blurb across tabs.",
  "macro_outline titles must use section headings (Beginning, Middle) or beat text — never generic 'Item 1'.",
  "Do NOT collapse macro_outline and chapter_breakdown. Do NOT merge scene_grid rows into one beat.",
  "Each table DATA ROW → its own outline_beat and/or proposed_wiki when it carries distinct story facts.",
  "Excerpts in proposed_wiki MUST be verbatim substrings from the document (>=40 chars).",
  "Output ONLY valid JSON (no markdown fences).",
  `Schema: {
  "thoughts":["string"],
  "content_signals":[{"kind":"scene_cards|chapter_breakdown|character_cards|world_lore|notes_brainstorm|full_draft|outline_list|mixed","confidence":"high|medium|low","evidence":"string"}],
  "story_fingerprint":{"working_title":null,"protagonist_names":["string"],"setting_anchors":["string"],"tone_or_genre":null},
  "conflicts":[{"code":"string","severity":"blocking|warning","message":"string"}],
  "clarifying_questions":[{"id":"string","code":"string","question":"string","hint":"string","required":true,"options":["string"]}],
  "proposed_wiki":[{"title":"string","excerpt":"string","chunk_type":"character|location|plot|theme|other","outline_entity_kind":"character|setting|environment|technology|plot_point|genre|theme|spoiler|note|chapter","tags":["string"],"plot_point_order":1,"planning_layer":"string"}],
  "outline_beats":[{"synopsis":"string","order":0,"plot_point_order":1,"title":"string","chapter_number":null}],
  "questions":[{"id":"q1","question":"string","hint":"phrase in text"}]
}`,
].join("\n");

const SLOT_CONVERGE_HINTS: Record<DocumentIngestSlot, string> = {
  character_sheet:
    "Prefer character_cards: one proposed_wiki row per named character with outline_entity_kind character.",
  world_bible:
    "Prefer world_lore: extract setting, environment, and technology/system rows (outline_entity_kind setting|environment|technology).",
  current_draft:
    "Prefer scene_grid and chapter_breakdown beats; character/setting rows only when clearly stated in prose.",
};

function excerptTokenOverlap(excerpt: string, source: string): number {
  const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
  const tokens = norm(excerpt)
    .split(" ")
    .filter((w) => w.length > 3);
  if (tokens.length === 0) return 0;
  const src = norm(source);
  const hits = tokens.filter((w) => src.includes(w)).length;
  return hits / tokens.length;
}

export function groundProposedWikiToSource(
  proposed: ProposedWikiEntry[],
  sourceText: string
): { kept: ProposedWikiEntry[]; dropped: number } {
  const src = sourceText;
  const kept: ProposedWikiEntry[] = [];
  let dropped = 0;
  for (const p of proposed) {
    const excerpt = p.excerpt.trim();
    const title = String(p.title ?? "").trim();
    if (excerpt.length < 40) {
      dropped++;
      continue;
    }
    if (answerFoundInSource(excerpt.slice(0, 200), src) || answerFoundInSource(excerpt, src)) {
      kept.push(p);
      continue;
    }
    const norm = excerpt.replace(/\s+/g, " ").toLowerCase();
    const srcNorm = src.replace(/\s+/g, " ").toLowerCase();
    if (srcNorm.includes(norm.slice(0, Math.min(120, norm.length)))) {
      kept.push(p);
      continue;
    }
    const titleInSource = title.length > 1 && srcNorm.includes(title.toLowerCase());
    if (titleInSource && excerptTokenOverlap(excerpt, src) >= 0.6) {
      kept.push(p);
      continue;
    }
    dropped++;
  }
  return { kept, dropped };
}

async function fetchIngestLineage(
  supabase: SupabaseClient,
  tenantId: string,
  preview: string
): Promise<string | null> {
  try {
    const { getLogicLineage } = await import("msgf/lib/msgf-index");
    const result = await getLogicLineage(supabase, {
      tenantId,
      queryText: `author document ingest wiki outline table mapping ${preview.slice(0, 400)}`,
      matchCount: 3,
    });
    return result.positiveReinforcement || null;
  } catch {
    return null;
  }
}

export async function runMsgfDocumentConverge(params: {
  supabase: SupabaseClient;
  tenantId: string;
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
  msgf_meta: DocumentIngestMsgfMeta;
}> {
  const mode = resolveDocumentIngestMode();
  const signals = buildDocumentIngestSignals(params.text);
  const keywords = loadDocumentIngestKeywords();
  const keyword_hits = matchKeywordHintsInText(params.text, keywords);

  const heuristicThoughts = buildHeuristicScanThoughts(params.text, params.slot);
  const heuristicWiki = heuristicProposedWiki(params.text, params.slot, params.manuscriptId);
  const textBeats = extractOutlineBeatsFromText(params.text);
  const sceneWiki = plotBeatsToSceneWikiEntries(textBeats, params.manuscriptId, params.slot);

  const fingerprint = extractStoryFingerprint(params.text);
  const heuristicConflicts = detectInDocumentConflicts(params.text, params.slot);
  const { outline: existingOutline } = await loadManuscriptProjectContext(
    params.supabase,
    params.manuscriptId
  );

  let lineage_reinforcement: string | null = null;
  if (mode !== "heuristic") {
    lineage_reinforcement = await fetchIngestLineage(
      params.supabase,
      params.tenantId,
      signals.summary
    );
  }

  let thoughts = heuristicThoughts;
  let proposed: ProposedWikiEntry[] = [];
  let outline_beats = mergePlotBeats([], textBeats);
  let questions: AuthorshipQuestion[] = [];
  let llmSignals = signals.content_signals;
  let llmFingerprint = fingerprint;
  let llmConflicts: IngestConflict[] = [];
  let llmClarifying: ClarifyingQuestion[] = [];
  let usedLlm = false;
  let grounding = { kept: 0, dropped: 0 };

  if (mode !== "heuristic" && hasGeminiCredentials()) {
    try {
      const raw = await generateBullets({
        system: CONVERGE_SYSTEM,
        user: [
          `Slot hint (soft): ${params.slot}`,
          SLOT_CONVERGE_HINTS[params.slot] ?? "",
          `Manuscript id: ${params.manuscriptId}`,
          formatSignalsForConvergePrompt(signals),
          formatKeywordHintsForPrompt(keyword_hits, keywords),
          lineage_reinforcement ? `Vault lineage: ${lineage_reinforcement}` : "",
          `Existing outline excerpt (may be empty): ${(existingOutline ?? "").slice(0, 2000)}`,
          `Authorship questions to generate: ${params.questionCount}`,
          "",
          "Document:",
          params.text.slice(0, MAX_LLM_DOCUMENT_CHARS),
        ]
          .filter(Boolean)
          .join("\n"),
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

      const { proposed: llmWiki, outline_beats: llmBeats } = parseLlmWikiAndBeats(parsed);
      const grounded = groundProposedWikiToSource(llmWiki, params.text);
      proposed = grounded.kept;
      grounding = { kept: grounded.kept.length, dropped: grounded.dropped };
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

  if (mode === "hybrid" || !proposed.length) {
    proposed = proposed.length
      ? proposed
      : [...heuristicWiki, ...sceneWiki];
  } else if (!proposed.some((p) => String(p.wiki_metadata?.outline_entity_kind) === "plot_point")) {
    proposed = [...proposed, ...sceneWiki];
  }

  if (mode === "heuristic") {
    proposed = [...heuristicWiki, ...sceneWiki];
    outline_beats = mergePlotBeats([], textBeats);
    usedLlm = false;
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
  ].filter((q, i, arr) => arr.findIndex((x) => x.code === q.code) === i);

  thoughts.push({
    phase: "structure",
    line: `MSGF ${mode}: ${signals.summary}`,
  });
  if (usedLlm && grounding.dropped > 0) {
    thoughts.push({
      phase: "structure",
      line: `Accuracy: dropped ${grounding.dropped} wiki excerpt(s) not grounded in source text.`,
    });
  }
  if (ingest_conflicts.some((c) => c.severity === "blocking")) {
    thoughts.push({
      phase: "structure",
      line: "Possible mixed WIPs or contradictions — clarify before merging.",
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
    msgf_meta: {
      mode,
      lineage_reinforcement,
      signals_summary: signals.summary,
      keyword_hits,
      grounding,
    },
  };
}
