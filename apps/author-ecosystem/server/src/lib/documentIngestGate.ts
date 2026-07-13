import { heuristicWikiFromTables } from "./documentIngestOutline.js";
import { mergeRagProposedWiki } from "./documentIngestRagParser.js";
import { splitTabSections } from "./documentPlanningTaxonomy.js";

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
  const a = answer
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .toLowerCase();
  if (a.length < 2) return false;
  const src = source.toLowerCase();
  if (src.includes(a)) return true;
  const tokens = a.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((t) => src.includes(t)).length;
  return hits >= Math.ceil(tokens.length * 0.55);
}

/** Authorship Q&A grounded in the uploaded text (avoids generic prompts that fail verification). */
export function buildAuthorshipQuestionsFromSource(
  source: string,
  count: number
): AuthorshipQuestion[] {
  const sample = source.slice(0, 80_000);
  const questions: AuthorshipQuestion[] = [];
  let id = 0;

  const names = [...new Set(sample.match(/\b[A-Z][a-z]{2,}(?:['’][a-z]+)?\b/g) ?? [])].filter(
    (n) => !/^(The|And|But|For|With|From|Chapter|Scene|Tab)$/i.test(n)
  );
  for (const name of names.slice(0, 4)) {
    if (questions.length >= count) break;
    if (!sample.toLowerCase().includes(name.toLowerCase())) continue;
    questions.push({
      id: `src-${id++}`,
      question: `Type the name "${name}" exactly as it appears in your document.`,
      hint: "proper noun from your file",
    });
  }

  const lines = sample
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 18 && l.length <= 220 && !/^---\s*tab:/i.test(l));
  for (const line of lines) {
    if (questions.length >= count) break;
    const snippet = line.replace(/\s+/g, " ").slice(0, 72);
    if (snippet.length < 12) continue;
    questions.push({
      id: `src-${id++}`,
      question: `Quote this phrase from your document (copy/paste): "${snippet}"`,
      hint: "must appear verbatim in the upload",
    });
  }

  return questions.slice(0, Math.max(3, Math.min(count, 10)));
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
  /** Multi-pass compiler beat identifier (Pass 2). */
  beat_id?: string;
  /** Entity fingerprints active in this beat (Pass 2). */
  active_entity_fingerprints?: string[];
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

const DRAFT_NAME_STOP = new Set([
  "The",
  "And",
  "But",
  "When",
  "Then",
  "She",
  "He",
  "They",
  "It",
  "His",
  "Her",
  "Chapter",
  "Scene",
  "Part",
  "Book",
  "Act",
  "Notes",
  "Outline",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

function excerptAround(text: string, needle: string, radius = 380): string {
  const idx = text.indexOf(needle);
  if (idx < 0) return "";
  return text.slice(Math.max(0, idx - 40), idx + radius).trim();
}

/** Extract cast, settings, and world traits from full-draft prose (no tables / LLM). */
export function heuristicDraftWikiFromProse(
  text: string,
  manuscriptId: string
): ProposedWikiEntry[] {
  const scan = text.slice(0, 120_000);
  const metaBase = slotDefaultMetadata("current_draft", manuscriptId);
  const entries: ProposedWikiEntry[] = [];
  const seen = new Set<string>();

  const push = (entry: ProposedWikiEntry) => {
    const key = entry.title.toLowerCase();
    if (seen.has(key)) return;
    if (entry.excerpt.trim().length < 40) return;
    seen.add(key);
    entries.push(entry);
  };

  const nameCounts = new Map<string, number>();
  for (const m of scan.matchAll(/\b[A-Z][a-z]{2,}(?:['’][a-z]+)?\b/g)) {
    const word = m[0];
    if (DRAFT_NAME_STOP.has(word)) continue;
    nameCounts.set(word, (nameCounts.get(word) ?? 0) + 1);
  }

  const cast = [...nameCounts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [name] of cast) {
    const excerpt = excerptAround(scan, name);
    if (excerpt.length < 40) continue;
    push({
      title: name,
      excerpt,
      chunk_type: "character",
      tags: ["character", "draft_import", "auto_extract"],
      wiki_metadata: {
        ...metaBase,
        outline_entity_kind: "character",
        wiki_author_entry: true,
        auto_extracted: true,
      },
    });
  }

  const settingRe =
    /\b(?:the\s+)?([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*){0,4})\s+(spire|compound|city|realm|forest|station|tower|palace|temple|harbor|village|kingdom|district|quarter)\b/gi;
  for (const m of scan.matchAll(settingRe)) {
    const label = `${m[1]} ${m[2]}`.trim();
    const excerpt = excerptAround(scan, label, 420);
    push({
      title: label.slice(0, 80),
      excerpt: excerpt || scan.slice(0, 420),
      chunk_type: "location",
      tags: ["setting", "draft_import", "auto_extract"],
      wiki_metadata: {
        ...metaBase,
        outline_entity_kind: "setting",
        wiki_author_entry: true,
        auto_extracted: true,
      },
    });
    if (entries.filter((e) => e.wiki_metadata?.outline_entity_kind === "setting").length >= 6) break;
  }

  const envParas = scan
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(
      (p) =>
        p.length >= 80 &&
        p.length <= 1600 &&
        /\b(climate|storm|war|plague|world|planet|atmosphere|exodus|trials|ceremon|realm|galaxy|orbit)\b/i.test(
          p
        )
    );

  for (const para of envParas.slice(0, 5)) {
    const title =
      para.match(/^[^.!?]{8,60}[.!?]/)?.[0]?.trim().slice(0, 72) ||
      para.split(/\s+/).slice(0, 6).join(" ");
    push({
      title: title.slice(0, 80),
      excerpt: para.slice(0, 1200),
      chunk_type: "location",
      tags: ["environment", "draft_import", "auto_extract"],
      wiki_metadata: {
        ...metaBase,
        outline_entity_kind: "environment",
        wiki_author_entry: true,
        auto_extracted: true,
      },
    });
  }

  return entries;
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
        wiki_metadata: { ...meta, outline_entity_kind: "character", wiki_author_entry: true },
      });
    }
    if (slot === "current_draft") {
      for (const row of heuristicDraftWikiFromProse(text, manuscriptId)) {
        if (!entries.some((e) => e.title.toLowerCase() === row.title.toLowerCase())) {
          entries.push(row);
        }
      }
    }
  }
  if (slot === "world_bible" || slot === "character_sheet") {
    const { proposed: ragRows } = mergeRagProposedWiki([], text, slot, manuscriptId);
    for (const row of ragRows) {
      if (!entries.some((e) => e.title.toLowerCase() === row.title.toLowerCase())) {
        entries.push(row);
      }
    }
  }
  if (slot === "world_bible" && entries.length === 0) {
    const tabs = splitTabSections(text);
    if (tabs.length >= 1) {
      for (const section of tabs.slice(0, 12)) {
        const body = section.body.trim();
        if (body.length < 40) continue;
        const title =
          section.title.trim().slice(0, 80) ||
          body.split(/\n/)[0]?.trim().slice(0, 80) ||
          "World bible section";
        entries.push({
          title,
          excerpt: body.slice(0, 1200),
          chunk_type: "location",
          tags: ["world_bible", "onboarding", section.layer].filter(Boolean),
          wiki_metadata: {
            ...meta,
            planning_layer: section.layer,
            tab_title: section.title,
          },
        });
      }
    }
    if (entries.length === 0) {
      const paras = sample.split(/\n\s*\n+/).filter((p) => p.trim().length > 80);
      for (const para of paras.slice(0, 8)) {
        const excerpt = para.trim();
        const titleLine = excerpt.split(/\n/)[0]?.trim().slice(0, 80) || "World bible excerpt";
        entries.push({
          title: titleLine,
          excerpt: excerpt.slice(0, 1200),
          chunk_type: "location",
          tags: ["world_bible", "onboarding"],
          wiki_metadata: meta,
        });
      }
    }
  }
  if (slot === "current_draft" && entries.length === 0 && sample.length > 80) {
    const draftRows = heuristicDraftWikiFromProse(text, manuscriptId);
    if (draftRows.length) entries.push(...draftRows);
    else {
      entries.push({
        title: "Draft continuity note",
        excerpt: sample.slice(0, 900).trim(),
        chunk_type: "plot",
        tags: ["draft", "onboarding"],
        wiki_metadata: { ...meta, outline_entity_kind: "plot_point", wiki_author_entry: true },
      });
    }
  }
  return entries.slice(0, 24);
}
