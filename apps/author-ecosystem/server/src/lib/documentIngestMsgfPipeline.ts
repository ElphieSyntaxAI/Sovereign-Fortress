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
import { areNearDuplicateTexts } from "./documentIngestCompile.js";
import { mergeRagProposedWiki, type IngestPairingDiagnostic } from "./documentIngestRagParser.js";
import { MAX_WIKI_PROPOSED } from "./documentIngestLimits.js";
import {
  compilerStateDigest,
  runMultiPassDocumentCompiler,
  type DocumentIngestCompilerState,
} from "./documentIngestMultiPassCompiler.js";
import {
  loadDocumentIngestKeywords,
  matchKeywordHintsInText,
} from "./documentIngestKeywords.js";
import {
  extractOutlineBeatsFromText,
  mergePlotBeats,
} from "./documentIngestOutline.js";
import { FOUNDATION_PASS1_DOMAIN_HINT } from "./storyFoundationTaxonomy.js";
import {
  buildDocumentIngestSignals,
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
import type { SemanticRegion } from "./narrative/semanticChunking.js";

const require = createRequire(import.meta.url);
const { hasGeminiCredentials } = require("../services/geminiClient.js") as {
  hasGeminiCredentials: () => boolean;
};

export type DocumentIngestMode = "converge" | "heuristic" | "hybrid";

export type DocumentIngestMsgfMeta = {
  mode: DocumentIngestMode;
  lineage_reinforcement: string | null;
  signals_summary: string;
  keyword_hits: string[];
  grounding: { kept: number; dropped: number };
  semantic_regions?: SemanticRegion[];
  parse_coverage?: {
    source_chars: number;
    llm_chars_processed: number;
    llm_chunks: number;
    rag_sections: number;
    domains: string[];
    capped: boolean;
  };
  compiler_state?: DocumentIngestCompilerState;
  compiler_passes?: Array<"pass1" | "pass2" | "pass3">;
  compiler_digest?: string;
};

export function resolveDocumentIngestMode(): DocumentIngestMode {
  const raw = process.env.MSGF_DOCUMENT_INGEST_MODE?.trim().toLowerCase();
  if (raw === "heuristic" || raw === "hybrid" || raw === "converge") return raw;
  return "converge";
}

function wikiRowQuality(row: ProposedWikiEntry): number {
  let score = 0;
  if (row.wiki_metadata?.multi_pass === true) score += 40;
  if (row.wiki_metadata?.fact_card === true || row.wiki_metadata?.lore_fact_distill === true) {
    score += 35;
  }
  if (row.wiki_metadata?.rag_canon === true) score += 5;
  const len = row.excerpt.length;
  if (len > 0 && len <= 520) score += 20;
  if (len > 1200) score -= 30;
  return score;
}

function mergeProposedDedupe(into: ProposedWikiEntry[], add: ProposedWikiEntry[]): ProposedWikiEntry[] {
  const merged = [...into];
  for (const row of add) {
    const dup = merged.find(
      (e) =>
        areNearDuplicateTexts(e.excerpt, row.excerpt) ||
        (e.title.toLowerCase() === row.title.toLowerCase() &&
          String(e.wiki_metadata?.section_path ?? "") ===
            String(row.wiki_metadata?.section_path ?? "")) ||
        (e.title.toLowerCase() === row.title.toLowerCase() &&
          String(e.wiki_metadata?.entity_fingerprint ?? "") ===
            String(row.wiki_metadata?.entity_fingerprint ?? "") &&
          String(e.wiki_metadata?.entity_fingerprint ?? "").length > 0)
    );
    if (!dup) merged.push(row);
    else if (wikiRowQuality(row) > wikiRowQuality(dup)) {
      merged[merged.indexOf(dup)] = row;
    }
  }
  return merged;
}

/** Prefer entity fact cards / multi-pass over raw section dumps when capping. */
function capProposedWikiWithRagPriority(
  rows: ProposedWikiEntry[],
  limit: number
): { rows: ProposedWikiEntry[]; capped: boolean } {
  if (rows.length <= limit) return { rows, capped: false };
  const ranked = [...rows].sort((a, b) => wikiRowQuality(b) - wikiRowQuality(a));
  return { rows: ranked.slice(0, limit), capped: true };
}

function collectSemanticDomains(rows: ProposedWikiEntry[]): string[] {
  const domains = new Set<string>();
  for (const row of rows) {
    const d = String(row.wiki_metadata?.semantic_domain ?? "").trim();
    if (d) domains.add(d);
  }
  return [...domains].sort();
}

const SLOT_CONVERGE_HINTS: Record<DocumentIngestSlot, string> = {
  character_sheet:
    "Prefer character_cards: one proposed_wiki row per named character with outline_entity_kind character.",
  world_bible:
    `Prefer world_lore FACT CARDS for every planner/RAG foundation. ${FOUNDATION_PASS1_DOMAIN_HINT} Use outline_entity_kind setting|environment|character|theme|plot_point and matching semantic_domain. Never dump a whole domain section into one excerpt.`,
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
  semantic_regions: SemanticRegion[];
  pairing_diagnostics: IngestPairingDiagnostic[];
  usedLlm: boolean;
  parse_coverage: DocumentIngestMsgfMeta["parse_coverage"];
  msgf_meta: DocumentIngestMsgfMeta;
}> {
  const mode = resolveDocumentIngestMode();
  const signals = buildDocumentIngestSignals(params.text);
  const keywords = loadDocumentIngestKeywords();
  const keyword_hits = matchKeywordHintsInText(params.text, keywords);

  const heuristicThoughts = buildHeuristicScanThoughts(params.text, params.slot);
  const heuristicWiki = heuristicProposedWiki(params.text, params.slot, params.manuscriptId);
  const textBeats = extractOutlineBeatsFromText(params.text);

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
  let semantic_regions: SemanticRegion[] = [];
  let usedLlm = false;
  let grounding = { kept: 0, dropped: 0 };
  let llmCharsProcessed = 0;
  let llmChunkTotal = 0;
  let compiler_state: DocumentIngestCompilerState | undefined;

  if (mode !== "heuristic" && hasGeminiCredentials()) {
    try {
      const multiPass = await runMultiPassDocumentCompiler({
        text: params.text,
        slot: params.slot,
        manuscriptId: params.manuscriptId,
        signals,
        slotHint: SLOT_CONVERGE_HINTS[params.slot] ?? "",
        lineageReinforcement: lineage_reinforcement,
        existingOutline,
      });

      compiler_state = multiPass.state;
      llmChunkTotal = multiPass.state.macro_windows.length;
      llmCharsProcessed = multiPass.state.macro_windows.reduce((n, w) => n + w.text.length, 0);
      usedLlm = multiPass.state.passes_completed.length > 0;

      if (multiPass.state.macro_windows.length > 1) {
        thoughts.push({
          phase: "structure",
          line: `Multi-pass CONVERGE: ${multiPass.state.macro_windows.length} structural windows × 3 passes (${params.text.length.toLocaleString()} chars).`,
        });
      } else {
        thoughts.push({
          phase: "structure",
          line: "Multi-pass CONVERGE: 3-pass stateful compiler (Entity Map → Event Arc → Metacognitive Weaver).",
        });
      }

      thoughts.push({
        phase: "character",
        line: `Pass 1 entities: ${multiPass.state.entities.length} · Pass 2 beats: ${multiPass.state.plot_beats.length} · Pass 3 windows: ${multiPass.state.window_metacognition.length}`,
      });

      if (multiPass.window_errors.length) {
        thoughts.push({
          phase: "structure",
          line: `Compiler window errors: ${multiPass.window_errors.length} (partial state retained).`,
        });
      }

      const grounded = groundProposedWikiToSource(multiPass.proposed, params.text);
      proposed = mergeProposedDedupe([], grounded.kept);
      grounding = { kept: grounded.kept.length, dropped: grounded.dropped };
      outline_beats = mergePlotBeats(outline_beats, multiPass.outline_beats);
      semantic_regions = [...semantic_regions, ...multiPass.semantic_regions];

      const protagonistNames = multiPass.state.entities
        .filter((e) => e.kind === "character")
        .map((e) => e.name)
        .slice(0, 8);
      if (protagonistNames.length) {
        llmFingerprint = {
          ...llmFingerprint,
          protagonist_names: [
            ...new Set([...llmFingerprint.protagonist_names, ...protagonistNames]),
          ].slice(0, 8),
        };
      }

      const settingAnchors = multiPass.state.entities
        .filter((e) => e.kind === "setting")
        .map((e) => e.name)
        .slice(0, 8);
      if (settingAnchors.length) {
        llmFingerprint = {
          ...llmFingerprint,
          setting_anchors: [
            ...new Set([...llmFingerprint.setting_anchors, ...settingAnchors]),
          ].slice(0, 8),
        };
      }

      for (const meta of multiPass.state.window_metacognition) {
        if (meta.thematic_breadcrumbs.some((t) => /foreshadow|contradict|conflict/i.test(t))) {
          llmConflicts.push({
            code: "thematic_tension",
            severity: "warning",
            message: `Thematic breadcrumbs in ${meta.window_id}: ${meta.thematic_breadcrumbs.join(", ")}`,
          });
        }
      }
    } catch {
      usedLlm = false;
    }
  }

  if (mode === "hybrid" || !proposed.length) {
    proposed = proposed.length ? proposed : [...heuristicWiki];
  }

  if (mode === "heuristic") {
    proposed = [...heuristicWiki];
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

  const ragMerge = mergeRagProposedWiki(
    proposed,
    params.text,
    params.slot,
    params.manuscriptId
  );
  proposed = ragMerge.proposed;
  const pairing_diagnostics = ragMerge.diagnostics;
  if (pairing_diagnostics.length > 0) {
    thoughts.push({
      phase: "lore",
      line: `RAG sections paired: ${pairing_diagnostics.length} (${[...new Set(pairing_diagnostics.map((d) => d.outline_entity_kind))].join(", ")})`,
    });
    const domains = collectSemanticDomains(proposed);
    if (domains.length) {
      thoughts.push({
        phase: "lore",
        line: `Lore domains detected: ${domains.join(", ")}`,
      });
    }
  }

  const capped = capProposedWikiWithRagPriority(proposed, MAX_WIKI_PROPOSED);
  proposed = capped.rows;
  if (capped.capped) {
    thoughts.push({
      phase: "structure",
      line: `Wiki preview capped at ${MAX_WIKI_PROPOSED} rows — RAG canon sections kept first.`,
    });
  }

  const parse_coverage = {
    source_chars: params.text.length,
    llm_chars_processed: llmCharsProcessed,
    llm_chunks: llmChunkTotal,
    rag_sections: pairing_diagnostics.length,
    domains: collectSemanticDomains(proposed),
    capped: capped.capped,
  };

  return {
    thoughts,
    proposed,
    outline_beats,
    questions,
    content_signals: llmSignals,
    story_fingerprint: llmFingerprint,
    ingest_conflicts,
    clarifying_questions,
    semantic_regions,
    pairing_diagnostics,
    usedLlm,
    parse_coverage,
    msgf_meta: {
      mode,
      lineage_reinforcement,
      signals_summary: signals.summary,
      keyword_hits,
      grounding,
      ...(semantic_regions.length > 0 ? { semantic_regions } : {}),
      parse_coverage,
      ...(compiler_state
        ? {
            compiler_state,
            compiler_passes: compiler_state.passes_completed,
            compiler_digest: compilerStateDigest(compiler_state),
          }
        : {}),
    },
  };
}
