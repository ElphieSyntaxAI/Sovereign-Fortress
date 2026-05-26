import { heuristicWikiFromTables } from "./documentIngestOutline.js";

export type DocumentIngestSlot = "world_bible" | "current_draft" | "character_sheet";

export const DOCUMENT_SLOTS: DocumentIngestSlot[] = [
  "world_bible",
  "current_draft",
  "character_sheet",
];

export const SLOT_LABELS: Record<DocumentIngestSlot, string> = {
  world_bible: "World Bible",
  current_draft: "Current Draft",
  character_sheet: "Character Sheets",
};

export const WORDS_PER_PAGE_ESTIMATE = 300;
export const AUTHORSHIP_WORD_THRESHOLD = 3000;
export const AUTHORSHIP_PAGE_THRESHOLD = 3;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimatePages(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE_ESTIMATE));
}

export function requiresAuthorshipGate(wordCount: number, pageEstimate: number): boolean {
  return wordCount > AUTHORSHIP_WORD_THRESHOLD || pageEstimate > AUTHORSHIP_PAGE_THRESHOLD;
}

/** 3–10 questions scaled by document length (only when gate applies). */
export function authorshipQuestionCount(wordCount: number): number {
  if (wordCount <= AUTHORSHIP_WORD_THRESHOLD) return 0;
  const extra = Math.floor((wordCount - AUTHORSHIP_WORD_THRESHOLD) / 2000);
  return Math.min(10, Math.max(3, 3 + extra));
}

export function answerFoundInSource(answer: string, source: string): boolean {
  const a = answer.trim().toLowerCase();
  if (a.length < 2) return false;
  const src = source.toLowerCase();
  if (src.includes(a)) return true;
  const tokens = a.split(/\s+/).filter((t) => t.length > 3);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((t) => src.includes(t)).length;
  return hits >= Math.ceil(tokens.length * 0.6);
}

export type AuthorshipQuestion = {
  id: string;
  question: string;
  hint?: string;
};

export type ScanThought = {
  line: string;
  phase: "scan" | "genre" | "character" | "lore" | "structure" | "done";
};

const GENRE_CUES: Array<{ re: RegExp; label: string }> = [
  { re: /\b(space|starship|orbit|alien)\b/i, label: "science fiction" },
  { re: /\b(dragon|sword|kingdom|quest|mage)\b/i, label: "fantasy" },
  { re: /\b(murder|detective|clue|suspect)\b/i, label: "mystery" },
  { re: /\b(love|heart|kiss|romance)\b/i, label: "romance" },
  { re: /\b(ghost|haunted|curse|ritual)\b/i, label: "supernatural" },
];

const ANIMAL_CUES =
  /\b(dog|cat|horse|wolf|bird|raven|fox|bear|lion|tiger|eagle|hawk|serpent|dragon)\b/gi;

/** Low-token scan narration before optional LLM enrichment. */
export function buildHeuristicScanThoughts(text: string, slot: DocumentIngestSlot): ScanThought[] {
  const sample = text.slice(0, 24000);
  const words = countWords(sample);
  const thoughts: ScanThought[] = [
    {
      phase: "scan",
      line: `Scanning your ${SLOT_LABELS[slot]} (${words.toLocaleString()} words)…`,
    },
  ];

  const animals = [...new Set((sample.match(ANIMAL_CUES) ?? []).map((m) => m.toLowerCase()))].slice(0, 4);
  if (animals.length) {
    thoughts.push({
      phase: "lore",
      line: `Noticing living details — ${animals.join(", ")} — marking these for world continuity.`,
    });
  }

  for (const { re, label } of GENRE_CUES) {
    if (re.test(sample)) {
      thoughts.push({
        phase: "genre",
        line: `Tone and signals suggest this may be ${label}; tagging retrieval accordingly.`,
      });
      break;
    }
  }

  const nameCandidates = sample.match(
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g
  );
  const names = [...new Set(nameCandidates ?? [])]
    .filter((n) => n.length > 2 && !/^(The|And|But|When|Then|She|He|They|It)$/i.test(n))
    .slice(0, 3);
  if (names.length) {
    thoughts.push({
      phase: "character",
      line: `Possible focal figures: ${names.join(", ")}.`,
    });
  } else {
    thoughts.push({
      phase: "character",
      line: "Still mapping who carries the scene — may ask you to confirm names in review.",
    });
  }

  thoughts.push({
    phase: "done",
    line: "Preparing wiki entries for your review…",
  });
  return thoughts;
}

export type ProposedWikiEntry = {
  title: string;
  excerpt: string;
  chunk_type: string;
  tags: string[];
  wiki_metadata: Record<string, unknown>;
  /** Scene / chapter card in plot sandbox when true in metadata. */
  plot_point_order?: number | null;
};

export type IngestOutlineBeat = {
  synopsis: string;
  order: number;
  title?: string;
  plot_point_order?: number | null;
  planning_layer?: string;
  chapter_number?: number | null;
  pov_mode?: "single" | "split" | "unknown";
  pov_names?: string[];
};

export function slotDefaultMetadata(
  slot: DocumentIngestSlot,
  manuscriptId: string
): Record<string, unknown> {
  const base = {
    manuscript_id: manuscriptId,
    onboarding_ingest: true,
    ingest_slot: slot,
    ledger: "wiki_snapshot",
    wiki_visibility: "draft",
  };
  if (slot === "world_bible") {
    return { ...base, source_type: "world_bible", outline_entity_kind: "environment" };
  }
  if (slot === "character_sheet") {
    return { ...base, source_type: "character_sheet", outline_entity_kind: "character" };
  }
  return { ...base, source_type: "story_outline", outline_entity_kind: "plot_point", is_outline: true };
}

export function heuristicProposedWiki(
  text: string,
  slot: DocumentIngestSlot,
  manuscriptId: string
): ProposedWikiEntry[] {
  const meta = slotDefaultMetadata(slot, manuscriptId);
  const sample = text.slice(0, 8000);

  const fromTables = heuristicWikiFromTables(text, slot, manuscriptId);
  if (fromTables.length >= 2) return fromTables;

  const names = [
    ...new Set(sample.match(/\b[A-Z][a-z]{2,}\b/g) ?? []),
  ].slice(0, 6);

  const entries: ProposedWikiEntry[] = [];
  if (slot === "character_sheet" || slot === "current_draft") {
    for (const name of names.slice(0, 4)) {
      const idx = sample.indexOf(name);
      const excerpt = sample.slice(Math.max(0, idx), idx + 420).trim();
      if (excerpt.length < 40) continue;
      entries.push({
        title: name,
        excerpt,
        chunk_type: "character",
        tags: ["character", "onboarding"],
        wiki_metadata: { ...meta, outline_entity_kind: "character" },
      });
    }
  }
  if (slot === "world_bible") {
    const para = sample.split(/\n\s*\n+/).find((p) => p.trim().length > 80);
    if (para) {
      entries.push({
        title: "World bible excerpt",
        excerpt: para.trim().slice(0, 1200),
        chunk_type: "location",
        tags: ["world_bible", "onboarding"],
        wiki_metadata: meta,
      });
    }
  }
  if (slot === "current_draft" && entries.length === 0 && sample.length > 80) {
    entries.push({
      title: "Draft continuity note",
      excerpt: sample.slice(0, 900).trim(),
      chunk_type: "plot",
      tags: ["draft", "onboarding"],
      wiki_metadata: meta,
    });
  }
  return entries.slice(0, 12);
}
