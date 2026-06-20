import type { SupabaseClient } from "@supabase/supabase-js";

import type { DocumentIngestSlot, ProposedWikiEntry } from "./documentIngestGate.js";
import { MAX_WIKI_PROPOSED } from "./documentIngestLimits.js";
import { extractOutlineBeatsFromText, type IngestPlotBeat } from "./documentIngestOutline.js";
import { detectHeuristicBoundaries } from "./narrative/semanticChunking.js";

export type ContentSignalKind =
  | "scene_cards"
  | "chapter_breakdown"
  | "character_cards"
  | "world_lore"
  | "notes_brainstorm"
  | "full_draft"
  | "outline_list"
  | "mixed"
  | "topic_shift";

export type ContentSignal = {
  kind: ContentSignalKind;
  confidence: "high" | "medium" | "low";
  evidence: string;
};

export type StoryFingerprint = {
  working_title?: string | null;
  protagonist_names: string[];
  setting_anchors: string[];
  tone_or_genre?: string | null;
};

export type IngestConflictSeverity = "blocking" | "warning";

export type IngestConflict = {
  code: string;
  severity: IngestConflictSeverity;
  message: string;
};

export type ClarifyingQuestion = {
  id: string;
  code: string;
  question: string;
  hint?: string;
  required: boolean;
  options?: string[];
};

const NAME_RE = /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?\b/g;
const STOP_NAMES = new Set([
  "The",
  "And",
  "But",
  "When",
  "Then",
  "She",
  "He",
  "They",
  "It",
  "Chapter",
  "Scene",
  "Part",
  "Book",
  "Act",
  "Notes",
  "Outline",
]);

export function detectContentSignals(text: string): ContentSignal[] {
  const sample = text.slice(0, 48000);
  const lower = sample.toLowerCase();
  const signals: ContentSignal[] = [];

  const tabSections = (sample.match(/^---\s*TAB:/gim) ?? []).length;
  if (tabSections >= 2) {
    signals.push({
      kind: "mixed",
      confidence: "high",
      evidence: `${tabSections} Google Doc tabs merged (multi-tab planning doc)`,
    });
  }

  if (/\b(prologue|epigraph|preface)\b/i.test(sample)) {
    signals.push({
      kind: "notes_brainstorm",
      confidence: "medium",
      evidence: "front matter (prologue/epigraph/preface)",
    });
  }

  if (/\b(book synopsis|logline|elevator pitch)\b/i.test(sample)) {
    signals.push({
      kind: "outline_list",
      confidence: "high",
      evidence: "book-level synopsis / pitch material",
    });
  }

  if (/\b(spin[- ]?off|sequel book ideas|gods games)\b/i.test(sample)) {
    signals.push({
      kind: "notes_brainstorm",
      confidence: "high",
      evidence: "sequel / spin-off planning (not in-manuscript chapters)",
    });
  }

  if (/\b(beginning outline|general outline|master outline)\b/i.test(lower)) {
    signals.push({
      kind: "outline_list",
      confidence: "high",
      evidence: "macro / beginning outline (not chapter-by-chapter)",
    });
  }

  if (/\b(chapter breakdown|chapter outline|chapter by chapter)\b/i.test(lower)) {
    signals.push({
      kind: "chapter_breakdown",
      confidence: "high",
      evidence: "per-chapter breakdown sections",
    });
  }

  const sceneHits =
    (sample.match(/\bscene\s*(?:card|#|\d+)/gi) ?? []).length +
    (sample.match(/\b(?:int\.|ext\.)\s/g) ?? []).length;
  if (sceneHits >= 2) {
    signals.push({
      kind: "scene_cards",
      confidence: sceneHits >= 4 ? "high" : "medium",
      evidence: `${sceneHits} scene-style markers`,
    });
  }

  const chapterHits = (sample.match(/(?:^|\n)\s*(?:chapter|ch\.?)\s*\d+/gim) ?? []).length;
  if (chapterHits >= 2) {
    signals.push({
      kind: "chapter_breakdown",
      confidence: chapterHits >= 3 ? "high" : "medium",
      evidence: `${chapterHits} chapter headings`,
    });
  }

  const charCardHits =
    (sample.match(/\bcharacter\s*(?:sheet|card|profile|bio)\b/gi) ?? []).length +
    (sample.match(/\b(?:age|pronouns|arc|motivation)\s*:/gi) ?? []).length;
  if (charCardHits >= 2) {
    signals.push({
      kind: "character_cards",
      confidence: "medium",
      evidence: "character sheet / profile fields",
    });
  }

  if (/\b(world bible|magic system|immutable|canon law)\b/i.test(sample)) {
    signals.push({
      kind: "world_lore",
      confidence: "high",
      evidence: "world-bible vocabulary",
    });
  }

  if (/\b(brainstorm|notes|todo|idea dump|scratch)\b/i.test(lower)) {
    signals.push({
      kind: "notes_brainstorm",
      confidence: "medium",
      evidence: "notes / brainstorm markers",
    });
  }

  const tableRows = (sample.match(/^\|.+\|$/gm) ?? []).length;
  const tabRows = (sample.match(/^[^\n]*\t[^\n\t]+\t/gm) ?? []).length;
  if (tableRows >= 3 || tabRows >= 3) {
    signals.push({
      kind: "character_cards",
      confidence: tableRows + tabRows >= 6 ? "high" : "medium",
      evidence: `${Math.max(tableRows, tabRows)} tabular rows (table or tab layout)`,
    });
  }

  const listLines = (sample.match(/^\s*(\d+[\.\):]|[\*\-]\s).+/gm) ?? []).length;
  if (listLines >= 6 && chapterHits < 2) {
    signals.push({
      kind: "outline_list",
      confidence: "medium",
      evidence: `${listLines} outline-style list rows`,
    });
  }

  const words = sample.trim().split(/\s+/).filter(Boolean).length;
  if (words > 2500 && chapterHits >= 1) {
    signals.push({
      kind: "full_draft",
      confidence: "medium",
      evidence: `${words.toLocaleString()} words with narrative structure`,
    });
  }

  if (signals.length >= 3) {
    signals.push({
      kind: "mixed",
      confidence: "high",
      evidence: "multiple structural patterns in one file",
    });
  }

  if (signals.length === 0) {
    signals.push({
      kind: "mixed",
      confidence: "low",
      evidence: "unlabeled prose — mapping by content, not filename",
    });
  }

  const topicBoundaries = detectHeuristicBoundaries(sample).slice(0, 6);
  for (const b of topicBoundaries) {
    signals.push({
      kind: "topic_shift",
      confidence: b.source === "keyword" ? "medium" : "high",
      evidence: b.label ? `topic boundary: ${b.label}` : `topic boundary at char ${b.charOffset}`,
    });
  }

  return signals;
}

export function extractStoryFingerprint(text: string): StoryFingerprint {
  const sample = text.slice(0, 20000);
  const titleMatch = sample.match(
    /(?:^|\n)\s*(?:title|working title|book)\s*[:\-]\s*(.+)/im
  );
  const names = [...new Set(sample.match(NAME_RE) ?? [])]
    .filter((n) => !STOP_NAMES.has(n.split(/\s/)[0] ?? n))
    .slice(0, 8);

  const settings = [
    ...new Set(
      (sample.match(
        /\b(?:in|at|on)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g
      ) ?? [])
        .map((m) => m.replace(/^(?:in|at|on)\s+/i, "").trim())
        .filter((s) => s.length > 2 && !STOP_NAMES.has(s))
    ),
  ].slice(0, 5);

  let tone: string | null = null;
  if (/\b(space|starship|orbit)\b/i.test(sample)) tone = "science fiction";
  else if (/\b(dragon|kingdom|mage)\b/i.test(sample)) tone = "fantasy";
  else if (/\b(murder|detective)\b/i.test(sample)) tone = "mystery";

  return {
    working_title: titleMatch?.[1]?.trim().slice(0, 120) ?? null,
    protagonist_names: names.slice(0, 5),
    setting_anchors: settings,
    tone_or_genre: tone,
  };
}

function nameSetsOverlap(a: string[], b: string[]): number {
  const norm = (x: string) => x.trim().toLowerCase();
  const setB = new Set(b.map(norm));
  return a.map(norm).filter((n) => n.length > 2 && setB.has(n)).length;
}

/** Heuristic: two books / WIPs pasted into one upload. */
export function detectInDocumentConflicts(
  text: string,
  slot: DocumentIngestSlot
): IngestConflict[] {
  const conflicts: IngestConflict[] = [];
  const sample = text.slice(0, 80000);

  const chapterOnes = sample.match(/(?:^|\n)\s*(?:chapter|ch\.?)\s*1\b/gim) ?? [];
  if (chapterOnes.length >= 2) {
    conflicts.push({
      code: "multiple_chapter_one",
      severity: "blocking",
      message:
        "This file looks like more than one book or outline (multiple “Chapter 1” openings). Tell us how to treat it before we merge into this manuscript.",
    });
  }

  const bookParts = sample.match(/(?:^|\n)\s*(?:book|part)\s+(?:one|i|1)\b/gim) ?? [];
  if (bookParts.length >= 2) {
    conflicts.push({
      code: "multiple_book_one",
      severity: "blocking",
      message:
        "Multiple “Book 1” / “Part I” sections detected — possible second WIP in the same file.",
    });
  }

  const third = Math.floor(sample.length / 3);
  const head = sample.slice(0, third);
  const tail = sample.slice(third * 2);
  const headNames = [...new Set(head.match(NAME_RE) ?? [])].filter((n) => !STOP_NAMES.has(n)).slice(0, 6);
  const tailNames = [...new Set(tail.match(NAME_RE) ?? [])].filter((n) => !STOP_NAMES.has(n)).slice(0, 6);
  if (
    headNames.length >= 2 &&
    tailNames.length >= 2 &&
    nameSetsOverlap(headNames, tailNames) === 0
  ) {
    conflicts.push({
      code: "disjoint_cast_halves",
      severity: "blocking",
      message:
        "The beginning and end of this file reference completely different character sets — we may be looking at two stories.",
    });
  }

  const genreA = /\b(dragon|kingdom|sword)\b/i.test(head);
  const genreB = /\b(murder|detective|crime)\b/i.test(tail);
  const genreC = /\b(starship|orbit|colony)\b/i.test(head);
  const genreD = /\b(love|wedding|romance)\b/i.test(tail);
  if ((genreA && genreD) || (genreC && genreB)) {
    conflicts.push({
      code: "genre_shift",
      severity: "warning",
      message: "Genre/tone shifts sharply mid-file — confirm this is one project.",
    });
  }

  if (slot === "world_bible" && /\bchapter\s+\d+/i.test(sample) && chapterOnes.length === 0) {
    conflicts.push({
      code: "slot_shape_mismatch",
      severity: "warning",
      message:
        "Uploaded as World Bible but reads like chapter/scene prose — confirm slot or we will still extract lore + beats.",
    });
  }

  if (slot === "character_sheet" && chapterOnes.length >= 2) {
    conflicts.push({
      code: "slot_shape_mismatch",
      severity: "warning",
      message: "Uploaded as Character Sheets but contains multi-chapter outline material.",
    });
  }

  return conflicts;
}

export function buildClarifyingQuestions(
  conflicts: IngestConflict[],
  fingerprint: StoryFingerprint,
  existingOutline: string | null
): ClarifyingQuestion[] {
  const questions: ClarifyingQuestion[] = [];
  const blocking = conflicts.filter((c) => c.severity === "blocking");

  if (blocking.some((c) => c.code.startsWith("multiple_") || c.code === "disjoint_cast_halves")) {
    questions.push({
      id: "q_scope",
      code: "single_story_scope",
      required: true,
      question:
        "Is this file ONE story for this manuscript, or did multiple books/outlines get combined?",
      hint: "Explain which parts belong to this project.",
      options: [
        "One story — import everything together",
        "Multiple WIPs — I will split files and re-upload",
        "Old draft + new draft — see my note below",
      ],
    });
  }

  if (blocking.length || conflicts.some((c) => c.code === "genre_shift")) {
    questions.push({
      id: "q_intent",
      code: "import_intent",
      required: blocking.length > 0,
      question:
        "What should we treat as authoritative for this manuscript right now?",
      options: [
        "Replace / refresh outline & wiki from this file",
        "Add only — keep existing wiki, merge new facts",
        "Old archive only — do not overwrite current outline",
      ],
    });
  }

  if (existingOutline && existingOutline.trim().length > 80) {
    const overlap = nameSetsOverlap(
      fingerprint.protagonist_names,
      [...new Set(existingOutline.match(NAME_RE) ?? [])].filter((n) => !STOP_NAMES.has(n))
    );
    if (overlap === 0 && fingerprint.protagonist_names.length >= 2) {
      questions.push({
        id: "q_existing",
        code: "contradicts_manuscript",
        required: true,
        question:
          "This upload names different leads than your saved manuscript outline. Same book, or a different project?",
        hint: "If same book, describe retitle/rename; if different, choose split or new manuscript.",
        options: [
          "Same book — overwrite outline with this file",
          "Different book — I uploaded to the wrong manuscript",
          "Supplemental — add wiki only, keep old outline",
        ],
      });
    }
  }

  if (
    questions.length === 0 &&
    conflicts.some((c) => c.severity === "warning")
  ) {
    questions.push({
      id: "q_ack",
      code: "acknowledge_warnings",
      required: false,
      question: "Optional: note anything we should know about this file (old draft, co-author section, etc.)",
      hint: "e.g. “Chapters 1–5 are discarded; rest is current.”",
    });
  }

  return questions.slice(0, 5);
}

export async function loadManuscriptProjectContext(
  supabase: SupabaseClient,
  manuscriptId: string
): Promise<{ outline: string | null; priorFingerprints: StoryFingerprint[] }> {
  const { data: ms } = await supabase
    .from("p4_manuscripts")
    .select("outline, title")
    .eq("id", manuscriptId)
    .maybeSingle();

  const outline = String(ms?.outline ?? "").trim() || null;

  let priorFingerprints: StoryFingerprint[] = [];
  const { data: sessions, error: sessErr } = await supabase
    .from("p4_document_ingest_sessions")
    .select("story_fingerprint")
    .eq("manuscript_id", manuscriptId)
    .eq("status", "committed")
    .order("created_at", { ascending: false })
    .limit(3);

  if (!sessErr && sessions) {
    priorFingerprints = sessions
      .map((s) => s.story_fingerprint as StoryFingerprint | null)
      .filter((f): f is StoryFingerprint => Boolean(f && typeof f === "object"));
  }

  return { outline, priorFingerprints };
}

export function mergeConflicts(
  heuristic: IngestConflict[],
  fromLlm: IngestConflict[] | undefined
): IngestConflict[] {
  const byCode = new Map<string, IngestConflict>();
  for (const c of [...heuristic, ...(fromLlm ?? [])]) {
    if (!c?.code || !c.message) continue;
    const prev = byCode.get(c.code);
    if (!prev || c.severity === "blocking") byCode.set(c.code, c);
  }
  return [...byCode.values()];
}

export function needsClarificationStep(questions: ClarifyingQuestion[]): boolean {
  return questions.some((q) => q.required);
}

export function resolveNextStatusAfterScan(params: {
  gate: boolean;
  authorshipQuestionCount: number;
  clarifying: ClarifyingQuestion[];
}): "authorship" | "clarification" | "review" {
  if (needsClarificationStep(params.clarifying)) return "clarification";
  if (params.gate && params.authorshipQuestionCount > 0) return "authorship";
  return "review";
}

export function structureAwareOutlineBeats(text: string): IngestPlotBeat[] {
  return extractOutlineBeatsFromText(text);
}

export function inferWikiFromSignals(
  text: string,
  signals: ContentSignal[],
  manuscriptId: string,
  slot: DocumentIngestSlot,
  proposed: ProposedWikiEntry[]
): ProposedWikiEntry[] {
  const kinds = new Set(signals.map((s) => s.kind));
  const out = [...proposed];

  if (kinds.has("notes_brainstorm")) {
    const chunk = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .find((p) => p.length > 60);
    if (chunk && !out.some((e) => e.wiki_metadata?.outline_entity_kind === "note")) {
      out.push({
        title: "Imported notes",
        excerpt: chunk.slice(0, 1200),
        chunk_type: "other",
        tags: ["notes", "file_import"],
        wiki_metadata: { outline_entity_kind: "note", source_type: "notes_brainstorm" },
      });
    }
  }

  return out.slice(0, MAX_WIKI_PROPOSED);
}
