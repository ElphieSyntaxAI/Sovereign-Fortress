import type { DocumentIngestSlot, ProposedWikiEntry } from "./documentIngestGate.js";
import {
  MAX_OUTLINE_BEATS,
  MAX_SCENE_WIKI_FROM_BEATS,
  MAX_TABLE_BEATS,
  MAX_WIKI_PROPOSED,
} from "./documentIngestLimits.js";
import {
  beatPriorityForLayer,
  classifyPlanningLayer,
  splitTabSections,
  wikiKindForPlanningLayer,
  type PlanningLayer,
} from "./documentPlanningTaxonomy.js";
import { compileOutlineBeats } from "./documentIngestCompile.js";
import { splitTabularLine } from "./documentTextStructure.js";

export type PovMode = "single" | "split" | "unknown";

export type IngestPlotBeat = {
  synopsis: string;
  order: number;
  /** Display title, e.g. "Chapter 11 — Split POV (Kamal & Acina)" */
  title?: string;
  plot_point_order?: number | null;
  planning_layer?: PlanningLayer;
  tab_title?: string;
  chapter_number?: number | null;
  pov_mode?: PovMode;
  /** Character names, e.g. ["Acina", "Kamal"] */
  pov_names?: string[];
};

/** Wiki rail kinds → chunk metadata (aligned with client outlineLoreKinds). */
export const WIKI_BUILDING_BLOCK_META: Record<
  string,
  { chunk_type: string; wiki_metadata: Record<string, unknown> }
> = {
  character: {
    chunk_type: "character",
    wiki_metadata: { source_type: "character_sheet", outline_entity_kind: "character" },
  },
  setting: {
    chunk_type: "location",
    wiki_metadata: { source_type: "world_bible", outline_entity_kind: "setting" },
  },
  environment: {
    chunk_type: "location",
    wiki_metadata: {
      source_type: "world_bible",
      outline_entity_kind: "environment",
      world_bible_section: "environment",
    },
  },
  plot_point: {
    chunk_type: "event",
    wiki_metadata: {
      source_type: "story_outline",
      outline_entity_kind: "plot_point",
      plot_point_order: "not_applicable",
      is_outline: true,
      outline: true,
    },
  },
  genre: {
    chunk_type: "other",
    wiki_metadata: { source_type: "theme_sheet", outline_entity_kind: "genre" },
  },
  theme: {
    chunk_type: "theme",
    wiki_metadata: {
      source_type: "theme_sheet",
      outline_entity_kind: "theme",
      narrative_master_logic: true,
    },
  },
  spoiler: {
    chunk_type: "other",
    wiki_metadata: {
      source_type: "story_outline",
      outline_entity_kind: "spoiler",
      spoiler_level: "high",
    },
  },
  note: {
    chunk_type: "other",
    wiki_metadata: {
      source_type: "notes_brainstorm",
      outline_entity_kind: "note",
    },
  },
  chapter: {
    chunk_type: "plot",
    wiki_metadata: {
      source_type: "story_outline",
      outline_entity_kind: "chapter",
      is_outline: true,
    },
  },
};

export function wikiMetaForEntityKind(
  kind: string,
  manuscriptId: string,
  slot: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const row = WIKI_BUILDING_BLOCK_META[kind] ?? WIKI_BUILDING_BLOCK_META.plot_point;
  return {
    manuscript_id: manuscriptId,
    ingest_slot: slot,
    ledger: "wiki_snapshot",
    wiki_visibility: "draft",
    wiki_author_entry: true,
    file_import: true,
    ...row.wiki_metadata,
    ...(extra ?? {}),
  };
}

export function normalizeProposedWikiEntry(
  entry: ProposedWikiEntry,
  manuscriptId: string,
  slot: string
): ProposedWikiEntry {
  const kind = String(
    entry.wiki_metadata?.outline_entity_kind ?? inferKindFromChunkType(entry.chunk_type)
  ).trim();
  const block = WIKI_BUILDING_BLOCK_META[kind] ?? WIKI_BUILDING_BLOCK_META.plot_point;
  return {
    ...entry,
    chunk_type: block.chunk_type,
    wiki_metadata: {
      ...wikiMetaForEntityKind(kind, manuscriptId, slot),
      ...(entry.wiki_metadata ?? {}),
      outline_entity_kind: kind,
    },
  };
}

function inferKindFromChunkType(chunkType: string): string {
  const x = chunkType.toLowerCase();
  if (x === "character") return "character";
  if (x === "location") return "setting";
  if (x === "plot" || x === "event") return "plot_point";
  if (x === "theme") return "theme";
  return "plot_point";
}

const SCENE_CARD_HEADER =
  /(?=(?:^|\n)\s*(?:scene\s*(?:card)?\s*[#:\d]|(?:int\.|ext\.)\s|[\*\#]{1,3}\s*scene\s))/gim;

const CHAPTER_HEADING_RE = /(?:^|\n)\s*(?:chapter|ch\.?)\s+(\d+)\b/i;
const SPLIT_POV_RE =
  /\b(split\s+pov|dual\s+pov|multiple\s+povs?|two\s+povs?|both\s+povs?|broken\s+into\s+2\s+chapters|split\s+chapter|pov\s+shift|shift(?:s)?\s+to\s+(?:\w+\s+)?pov)\b/i;

/** Name token for POV lines (supports Summer's, Summers, hyphenated). */
const POV_NAME = "[A-Za-z][A-Za-z'\\-]{1,32}";

function normalizePovDisplayName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+Pov\s*$/i, "")
    .replace(/\s+perspective\s*$/i, "")
    .replace(/['']s$/i, "")
    .trim();
}

function pushPovName(seen: Set<string>, out: string[], raw: string): void {
  const name = normalizePovDisplayName(raw);
  if (name.length < 2 || /^(chapter|scene|part|book|act|notes|outline)$/i.test(name)) return;
  const key = name.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(`${name} POV`);
}

export function parseAllPovs(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const patterns: RegExp[] = [
    new RegExp(`\\b(${POV_NAME})\\s*(?:'s|’s)?\\s+Pov\\b`, "gi"),
    new RegExp(`\\b(?:told in|written in|in|from)\\s+(${POV_NAME})\\s*(?:'s|’s)?\\s+(?:POV|perspective)\\b`, "gi"),
    new RegExp(`\\bPOV\\s*[:\\-–—]\\s*(${POV_NAME})\\b`, "gi"),
    new RegExp(`\\b(${POV_NAME})\\s*(?:'s|’s)?\\s+perspective\\b`, "gi"),
    new RegExp(`\\b(?:pov|perspective)\\s+(?:shift|switch)(?:es)?\\s+(?:to\\s+)?(${POV_NAME})\\b`, "gi"),
  ];

  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      if (m[1]) pushPovName(seen, out, m[1]);
    }
  }

  for (const m of text.matchAll(/\(([^)]{2,80})\)/g)) {
    const inner = m[1]!;
    if (!/\bPov\b/i.test(inner) && !/\bperspective\b/i.test(inner)) continue;
    const namePart = inner.replace(/\s*Pov\s*/i, " ").replace(/\s*perspective\s*/i, " ").trim();
    if (namePart.length >= 2) pushPovName(seen, out, namePart);
  }

  return out;
}

/** POV column cells are often just a name (e.g. "Summer" / "Summers") without the word Pov. */
export function extractPovFromTableCell(cell: string): string[] {
  const t = cell.trim();
  if (!t) return [];
  const explicit = parseAllPovs(t);
  if (explicit.length) return explicit;
  const bare = t.replace(/^(?:pov|perspective)\s*[:\\-–—]\s*/i, "").trim();
  if (/^[A-Z][a-z]+(?:'s)?$/.test(bare) || /^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(bare)) {
    return [`${normalizePovDisplayName(bare)} POV`];
  }
  return [];
}

export function resolvePovInfo(text: string): { mode: PovMode; povs: string[] } {
  const povs = parseAllPovs(text);
  if (SPLIT_POV_RE.test(text) || povs.length >= 2) {
    return { mode: "split", povs };
  }
  if (povs.length === 1) return { mode: "single", povs };
  return { mode: "unknown", povs: [] };
}

/** When a chapter tab body accidentally contains multiple chapter blocks, keep only this chapter. */
function isolateChapterTabBody(body: string, chapterNum: number | null): string {
  if (chapterNum == null) return body;
  const blocks = body.split(/(?=(?:^|\n)\s*(?:chapter|ch\.?)\s+\d+[^\n]*\n?)/gim);
  if (blocks.length <= 1) return body;
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length < 8) continue;
    const n = parseChapterNumber(trimmed);
    if (n === chapterNum) return trimmed;
  }
  return body;
}

function titleFromMacroLine(synopsis: string): string {
  const t = synopsis.trim();
  if (!t) return "Outline point";
  const firstLine = t.split("\n")[0]!.trim();
  if (firstLine.length <= 80) return firstLine;
  return `${firstLine.slice(0, 77).trim()}…`;
}

function resolveWikiBeatTitle(
  b: IngestPlotBeat,
  sectionTitle: string,
  fallbackIndex: number
): string {
  const nameField = b.synopsis.match(/(?:^|\n)name\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (nameField && nameField.length >= 2) return nameField.slice(0, 80);

  const rawTitle = b.title?.trim();
  if (rawTitle && !/^item\s+\d+$/i.test(rawTitle)) return rawTitle.slice(0, 80);

  if (b.planning_layer === "macro_outline" || b.planning_layer === "book_synopsis") {
    if (rawTitle && rawTitle.length >= 3) return rawTitle.slice(0, 80);
    const fromLine = titleFromMacroLine(b.synopsis);
    if (fromLine && !/^item\s+\d+$/i.test(fromLine)) return fromLine;
    if (sectionTitle && sectionTitle !== "Document") return sectionTitle.slice(0, 80);
    return "Outline beat";
  }

  if (b.chapter_number != null) {
    return (
      b.title?.trim() ||
      `Chapter ${b.chapter_number}${b.pov_names?.length ? ` — ${b.pov_names.join(" & ")}` : ""}`
    ).slice(0, 80);
  }

  return rawTitle?.slice(0, 80) || `Plot beat ${fallbackIndex + 1}`;
}

export function parseChapterNumber(text: string): number | null {
  const m = text.match(CHAPTER_HEADING_RE);
  if (m?.[1]) {
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }
  const tabOnly = text.trim().match(/^(?:chapter|ch\.?)\s*(\d{1,3})\b/i);
  if (tabOnly?.[1]) {
    const n = Number(tabOnly[1]);
    return Number.isFinite(n) ? n : null;
  }
  const digits = text.trim().match(/^(\d{1,3})$/);
  if (digits?.[1]) {
    const n = Number(digits[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function withChapterPov(
  beat: Omit<IngestPlotBeat, "order">,
  povSourceText: string,
  order: number
): IngestPlotBeat {
  const povInfo = resolvePovInfo(povSourceText);
  const chapterNum = beat.chapter_number ?? null;
  const title =
    chapterNum != null
      ? buildChapterTitle(chapterNum, povInfo, beat.title ?? "")
      : beat.title;
  return makeBeat(
    {
      ...beat,
      title,
      pov_mode: povInfo.mode,
      pov_names: povInfo.povs.map((p) => p.replace(/\s+POV$/i, "")),
    },
    order
  );
}

function isFranchisePlanningTab(tabTitle: string): boolean {
  return /\b(spin[- ]?off|sequel book ideas|sequel ideas|gods games|book ideas)\b/i.test(tabTitle);
}

function isFranchiseChapterContent(tabTitle: string, body: string): boolean {
  if (isFranchisePlanningTab(tabTitle)) return true;
  const head = `${tabTitle}\n${body}`.slice(0, 600).toLowerCase();
  if (!/\b(spin[- ]?off|sequel book ideas|gods games)\b/.test(head)) return false;
  const ch = parseChapterNumber(tabTitle) ?? parseChapterNumber(body.split("\n")[0] ?? "");
  return ch == null || ch >= 29;
}

function isOutlineSubheading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 90) return false;
  return (
    /^(beginning|middle|end)\b/i.test(t) ||
    /^middle\s+the\b/i.test(t) ||
    /^middle\s+chapter\s+outline/i.test(t) ||
    /^book synopsis\b/i.test(t) ||
    /^hints at sequal/i.test(t) ||
    /^hints at sequel/i.test(t) ||
    /^spin off and sequel/i.test(t) ||
    /^ending chapter outline/i.test(t)
  );
}

function layerForOutlineSubheading(heading: string): PlanningLayer {
  const h = heading.trim().toLowerCase();
  if (/^book synopsis\b/.test(h)) return "book_synopsis";
  if (/hints at sequal|hints at sequel|spin off/.test(h)) return "notes";
  if (/^ending chapter outline/.test(h)) return "chapter_breakdown";
  if (/middle chapter outline/.test(h)) return "chapter_breakdown";
  return "macro_outline";
}

/** Split master outline bodies (Beginning / Middle / End / Book Synopsis). */
function extractEmbeddedSubsectionBeats(body: string, tabTitle: string): IngestPlotBeat[] {
  const lines = body.split("\n");
  const chunks: Array<{ heading: string; lines: string[] }> = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (isOutlineSubheading(line)) {
      if (current && (current.lines.join("\n").trim().length > 0 || current.heading)) {
        chunks.push(current);
      }
      current = { heading: line.trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current && current.lines.join("\n").trim().length > 0) {
    chunks.push(current);
  }

  if (chunks.length < 2) {
    const synopsisMatch = body.match(/(?:^|\n)\s*Book Synopsis\s*\n+([\s\S]{40,}?)(?=\n\s*(?:Hints|Spin off|Chapter\s+\d+|$))/i);
    if (synopsisMatch?.[1]) {
      return [
        makeBeat(
          {
            title: "Book Synopsis",
            synopsis: synopsisMatch[1].trim().slice(0, 2000),
            planning_layer: "book_synopsis",
            tab_title: tabTitle,
          },
          0
        ),
      ];
    }
    return [];
  }

  const beats: IngestPlotBeat[] = [];
  let order = 0;
  for (const chunk of chunks) {
    const sectionBody = chunk.lines.join("\n").trim();
    if (sectionBody.length < 8 && !/^book synopsis/i.test(chunk.heading)) continue;

    const layer = layerForOutlineSubheading(chunk.heading);

    if (layer === "book_synopsis") {
      beats.push(
        makeBeat(
          {
            title: "Book Synopsis",
            synopsis: sectionBody.slice(0, 2000),
            planning_layer: "book_synopsis",
            tab_title: tabTitle,
          },
          order++
        )
      );
      continue;
    }

    if (layer === "notes" && /\b(spin[- ]?off|sequel)\b/i.test(chunk.heading + sectionBody)) {
      beats.push(...extractFranchiseIdeaBeats(sectionBody, chunk.heading));
      order = beats.length;
      continue;
    }

    if (layer === "notes") {
      const notesPovSource = `${chunk.heading}\n${sectionBody}`;
      const povInfo = resolvePovInfo(notesPovSource);
      beats.push(
        makeBeat(
          {
            title: chunk.heading.slice(0, 80),
            synopsis: sectionBody.slice(0, 2000),
            planning_layer: "notes",
            tab_title: tabTitle,
            pov_mode: povInfo.mode !== "unknown" ? povInfo.mode : undefined,
            pov_names: povInfo.povs.map((p) => p.replace(/\s+POV$/i, "")),
          },
          order++
        )
      );
      continue;
    }

    if (layer === "chapter_breakdown") {
      const table = extractChapterTableBeats(sectionBody, {
        tabTitle: chunk.heading,
        layer: "chapter_breakdown",
      });
      if (table.length >= 1) {
        beats.push(...table.map((b, i) => ({ ...b, order: order + i, tab_title: tabTitle })));
        order = beats.length;
        continue;
      }
      const ch = extractChapterBeats(sectionBody, { layer: "chapter_breakdown", tab: chunk.heading });
      if (ch.length >= 1) {
        beats.push(...ch.map((b, i) => ({ ...b, order: order + i, tab_title: tabTitle })));
        order = beats.length;
        continue;
      }
    }

    const macroLines = extractMacroOutlineBeats(sectionBody, { tab: chunk.heading });
    if (macroLines.length >= 2) {
      beats.push(...macroLines.map((b, i) => ({ ...b, order: order + i, tab_title: tabTitle })));
      order = beats.length;
    } else {
      beats.push(
        makeBeat(
          {
            title: chunk.heading.slice(0, 80),
            synopsis: sectionBody.slice(0, 2000),
            planning_layer: "macro_outline",
            tab_title: tabTitle,
          },
          order++
        )
      );
    }
  }

  return beats;
}

function extractFranchiseIdeaBeats(body: string, tabTitle: string): IngestPlotBeat[] {
  const text = body
    .replace(/^(?:chapter|ch\.?)\s+\d+[^\n]*\n+/i, "")
    .replace(/^spin off and sequel book ideas\s*\n+/i, "")
    .trim();
  if (text.length < 20) return [];

  const parts = text.split(/(?=(?:^|\n)\s*(?:Sequel|Spin off)\s*[-–—:])/gim);
  const beats: IngestPlotBeat[] = [];
  let order = 0;

  for (const part of parts) {
    const chunk = part.trim();
    if (chunk.length < 25) continue;
    const firstLine = chunk.split("\n")[0]?.trim() ?? "Idea";
    let title = firstLine.slice(0, 80);
    if (/^sequel\b/i.test(title)) {
      const rest = title.replace(/^sequel\s*[-–—:]\s*/i, "").trim();
      title = rest ? `Sequel — ${rest.slice(0, 55)}` : "Sequel idea";
    } else if (/^spin off\b/i.test(title)) {
      const rest = title.replace(/^spin\s*off\s*[-–—:]\s*/i, "").trim();
      title = rest ? `Spin-off — ${rest.slice(0, 55)}` : "Spin-off idea";
    }
    beats.push(
      makeBeat(
        {
          title,
          synopsis: chunk.slice(0, 2000),
          planning_layer: "notes",
          tab_title: tabTitle,
          chapter_number: null,
        },
        order++
      )
    );
  }

  if (beats.length === 0) {
    beats.push(
      makeBeat(
        {
          title: tabTitle.slice(0, 80) || "Sequel & spin-off ideas",
          synopsis: text.slice(0, 2000),
          planning_layer: "notes",
          tab_title: tabTitle,
          chapter_number: null,
        },
        0
      )
    );
  }

  return beats;
}

function extractBookSynopsisBeats(body: string, tabTitle: string): IngestPlotBeat[] {
  const embedded = extractEmbeddedSubsectionBeats(body, tabTitle).filter(
    (b) => b.planning_layer === "book_synopsis"
  );
  if (embedded.length) return embedded;

  const inline = body.match(/(?:^|\n)\s*Book Synopsis\s*\n+([\s\S]{30,}?)(?=\n\s*(?:Hints|Spin off|Chapter\s+\d+|End\b|$))/i);
  if (inline?.[1]) {
    return [
      makeBeat(
        {
          title: "Book Synopsis",
          synopsis: inline[1].trim().slice(0, 2000),
          planning_layer: "book_synopsis",
          tab_title: tabTitle,
        },
        0
      ),
    ];
  }

  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40 && !isOutlineSubheading(p));
  const synopsis = paras.join("\n\n").slice(0, 2000) || body.trim().slice(0, 2000);
  if (synopsis.length < 30) return [];

  return [
    makeBeat(
      {
        title: /synopsis/i.test(tabTitle) ? tabTitle.slice(0, 80) : "Book Synopsis",
        synopsis,
        planning_layer: "book_synopsis",
        tab_title: tabTitle,
      },
      0
    ),
  ];
}

function buildChapterTitle(
  chapterNum: number | null,
  povInfo: { mode: PovMode; povs: string[] },
  fallback: string
): string {
  if (chapterNum != null && povInfo.mode === "split" && povInfo.povs.length >= 2) {
    const names = povInfo.povs.map((p) => p.replace(/\s+POV$/i, "")).join(" & ");
    return `Chapter ${chapterNum} — Split POV (${names})`;
  }
  if (chapterNum != null && povInfo.povs.length >= 1) {
    if (povInfo.povs.length === 1) {
      return `Chapter ${chapterNum} — ${povInfo.povs[0]}`;
    }
    const names = povInfo.povs.map((p) => p.replace(/\s+POV$/i, "")).join(" & ");
    return `Chapter ${chapterNum} — ${names}`;
  }
  if (chapterNum != null) return `Chapter ${chapterNum}`;
  const fromTab = fallback.match(/^chapter\s+\d+[^\n]*/i)?.[0];
  if (fromTab) return fromTab.trim();
  return fallback.trim().slice(0, 80) || "Chapter";
}

function isDedicatedChapterTab(tabTitle: string): boolean {
  if (isFranchisePlanningTab(tabTitle)) return false;
  const t = tabTitle.trim();
  if (/^chapter\s*\d+\b/i.test(t)) return true;
  if (/^ch\.?\s*\d+\b/i.test(t)) return true;
  if (/^\d{1,3}$/.test(t)) return true;
  if (/^(?:chapter|ch\.?)\s*\d+[^\n]{0,48}$/i.test(t)) return true;
  return false;
}

function maxChapterNumberInText(text: string): number {
  let max = 0;
  for (const m of text.matchAll(/(?:^|\n)\s*(?:chapter|ch\.?)\s*(\d+)\b/gim)) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  for (const line of text.split("\n")) {
    const cells = splitTabularLine(line);
    if (!cells?.length) continue;
    const n = parseChapterNumber(cells[0] ?? "");
    if (n != null) max = Math.max(max, n);
  }
  return max;
}

function chapterNumbersInBeats(beats: IngestPlotBeat[]): Set<number> {
  const have = new Set<number>();
  for (const b of beats) {
    const n =
      b.chapter_number ??
      parseChapterNumber(b.title ?? "") ??
      parseChapterNumber(b.synopsis.slice(0, 200));
    if (n != null) have.add(n);
  }
  return have;
}

/** Chapters that only appear in master outline / ending tables, not per-chapter tabs. */
function fillMissingChapterBeats(
  beats: IngestPlotBeat[],
  sections: Array<{ title: string; body: string; path?: string; layer: PlanningLayer }>
): IngestPlotBeat[] {
  const have = chapterNumbersInBeats(beats);
  const fullText = sections.map((s) => s.body).join("\n");
  const maxCh = maxChapterNumberInText(fullText);
  if (maxCh === 0) return beats;

  const missing: number[] = [];
  for (let n = 1; n <= maxCh; n++) {
    if (!have.has(n)) missing.push(n);
  }
  if (missing.length === 0) return beats;

  const added = [...beats];
  for (const section of sections) {
    const label = section.path ?? section.title;
    const pool = [
      ...extractChapterTableBeats(section.body, {
        tabTitle: label,
        layer: "chapter_breakdown",
      }),
      ...extractChapterBeats(section.body, { layer: "chapter_breakdown", tab: label }),
    ];
    for (const b of pool) {
      const ch = b.chapter_number ?? parseChapterNumber(b.synopsis);
      if (ch == null || !missing.includes(ch) || have.has(ch)) continue;
      if (isFranchiseChapterContent(label, b.synopsis)) continue;
      added.push({ ...b, tab_title: b.tab_title ?? label });
      have.add(ch);
    }
  }

  return added;
}

function countChapterHeadings(text: string): number {
  return (text.match(/(?:^|\n)\s*(?:chapter|ch\.?)\s+\d+\b/gim) ?? []).length;
}

function stripLayerPrefix(synopsis: string): string {
  return synopsis.replace(/^\[[\w_]+\]\s*[^\n]+\n+/i, "").trim();
}

function beatContentKey(beat: IngestPlotBeat): string {
  const core = stripLayerPrefix(beat.synopsis).replace(/\s+/g, " ").trim().toLowerCase();
  const ch = beat.chapter_number ?? parseChapterNumber(beat.title ?? "") ?? parseChapterNumber(core);
  if (ch != null) return `ch:${ch}`;
  return core.slice(0, 160);
}

function scoreChapterBeat(b: IngestPlotBeat): number {
  let s = 0;
  if (b.title && /^chapter\s+\d+/i.test(b.title)) s += 50;
  if (b.tab_title && isDedicatedChapterTab(b.tab_title)) s += 45;
  if (b.tab_title && b.tab_title !== "Document") s += 15;
  const core = stripLayerPrefix(b.synopsis);
  const len = core.length;
  if (len > 60 && len < 1400) s += 20;
  if (len > 2200) s -= 35;
  if (countChapterHeadings(core) > 1) s -= 70;
  if (b.pov_mode === "single" || b.pov_mode === "split") s += 12;
  if (b.chapter_number != null) s += 10;
  return s;
}

function pickBestChapterBeat(group: IngestPlotBeat[]): IngestPlotBeat {
  return [...group].sort((a, b) => scoreChapterBeat(b) - scoreChapterBeat(a))[0]!;
}

function makeBeat(
  partial: Omit<IngestPlotBeat, "order"> & { order?: number },
  order: number
): IngestPlotBeat {
  return {
    order,
    plot_point_order: partial.chapter_number ?? partial.plot_point_order ?? null,
    ...partial,
    synopsis: partial.synopsis.trim(),
  };
}

/** One beat per table row (character sheets, scene grids, beat tables). */
export function extractBeatsFromTables(text: string, ctx?: { layer?: PlanningLayer; tab?: string }): IngestPlotBeat[] {
  const lines = text.split("\n");
  const beats: IngestPlotBeat[] = [];
  let header: string[] = [];
  let order = 0;
  const layer = ctx?.layer ?? "scene_grid";

  for (const line of lines) {
    const cells = splitTabularLine(line);
    if (!cells || cells.length < 2) {
      header = [];
      continue;
    }
    if (cells.every((c) => /^-+$/.test(c))) continue;

    if (header.length === 0) {
      header = cells;
      continue;
    }

    const pairs = cells.map((cell, i) => {
      const label = header[i] ?? `Col ${i + 1}`;
      return `${label}: ${cell}`;
    });
    const synopsis = pairs.join("\n").trim();
    if (synopsis.length < 8) continue;

    const sceneNum = synopsis.match(/\bscene\s*#?\s*(\d+)/i)?.[1];
    beats.push(
      makeBeat(
        {
          synopsis,
          plot_point_order: sceneNum ? Number(sceneNum) : order <= 9 ? order : null,
          planning_layer: layer,
          tab_title: ctx?.tab,
        },
        order++
      )
    );
  }

  return beats.slice(0, MAX_TABLE_BEATS);
}

/** Chapter planning tables: Chapter | What happens | POV | Where */
function extractChapterTableBeats(
  text: string,
  ctx: { tabTitle: string; layer: PlanningLayer }
): IngestPlotBeat[] {
  const lines = text.split("\n");
  let header: string[] = [];
  const beats: IngestPlotBeat[] = [];
  let order = 0;

  for (const line of lines) {
    const cells = splitTabularLine(line);
    if (!cells || cells.length < 2) {
      header = [];
      continue;
    }
    if (cells.every((c) => /^-+$/.test(c))) continue;

    if (header.length === 0) {
      const row = cells.map((h) => h.trim());
      const hasChapterCol = row.some((h) => /^chapter$/i.test(h) || /^ch\.?$/i.test(h));
      if (!hasChapterCol) continue;
      header = row;
      continue;
    }

    const chIdx = header.findIndex((h) => /^chapter$/i.test(h) || /^ch\.?$/i.test(h));
    const povIdx = header.findIndex((h) => /^pov$/i.test(h) || /^point of view$/i.test(h));
    const chapterCell = chIdx >= 0 ? cells[chIdx]?.trim() : cells[0]?.trim();
    const chapterNum = parseChapterNumber(chapterCell ?? "");
    if (chapterNum == null) continue;

    const detailCells = cells
      .map((cell, i) => {
        if (i === chIdx) return null;
        const label = header[i] ?? "";
        if (!cell.trim() || /^chapter$/i.test(label)) return null;
        return `${label}: ${cell}`.trim();
      })
      .filter(Boolean) as string[];

    const synopsis = detailCells.join("\n").trim() || cells.filter((_, i) => i !== chIdx).join("\n").trim();
    if (synopsis.length < 8) continue;

    const povCell = povIdx >= 0 ? cells[povIdx]?.trim() ?? "" : "";
    const tablePovs = povCell ? extractPovFromTableCell(povCell) : [];
    const povSource = [
      chapterCell ?? "",
      cells.join("\n"),
      synopsis,
      povCell,
      tablePovs.join("\n"),
    ].join("\n");
    beats.push(
      withChapterPov(
        {
          synopsis,
          chapter_number: chapterNum,
          planning_layer: ctx.layer,
          tab_title: ctx.tabTitle,
        },
        povSource,
        order++
      )
    );
  }

  return beats;
}

function extractSingleChapterTabBeat(
  body: string,
  ctx: { tabTitle: string; layer: PlanningLayer }
): IngestPlotBeat[] {
  const trimmed = body.trim();
  if (trimmed.length < 12) return [];

  if (isFranchiseChapterContent(ctx.tabTitle, trimmed)) {
    return extractFranchiseIdeaBeats(trimmed, ctx.tabTitle);
  }

  const chapterNum = parseChapterNumber(ctx.tabTitle) ?? parseChapterNumber(trimmed);
  const scopedBody = isolateChapterTabBody(trimmed, chapterNum);

  let synopsis = scopedBody;
  if (chapterNum != null) {
    synopsis = scopedBody.replace(/^(?:chapter|ch\.?)\s+\d+[^\n]*\n+/i, "").trim();
  }

  return [
    withChapterPov(
      {
        synopsis: synopsis.slice(0, 2000),
        chapter_number: chapterNum,
        planning_layer: ctx.layer,
        tab_title: ctx.tabTitle,
      },
      scopedBody,
      0
    ),
  ];
}

function extractSceneLineBeats(text: string, ctx?: { layer?: PlanningLayer; tab?: string }): IngestPlotBeat[] {
  const beats: IngestPlotBeat[] = [];
  const parts = text.split(SCENE_CARD_HEADER);
  if (parts.length > 2) {
    let order = 0;
    for (const block of parts) {
      const trimmed = block.trim();
      if (trimmed.length < 12) continue;
      const titleLine = trimmed.split(/\n/)[0]?.trim().slice(0, 200) ?? trimmed.slice(0, 200);
      beats.push(
        makeBeat(
          {
            title: titleLine,
            synopsis: `${titleLine}\n${trimmed.slice(0, 1800)}`.trim(),
            planning_layer: ctx?.layer ?? "scene_grid",
            tab_title: ctx?.tab,
          },
          order++
        )
      );
    }
    return beats;
  }

  const lines = text.split("\n");
  let order = 0;
  for (const line of lines) {
    if (!/^\s*scene\s*(?:#|card)?\s*\d+/i.test(line) && !/^\s*(?:int\.|ext\.)\s/i.test(line)) continue;
    if (line.trim().length < 12) continue;
    beats.push(
      makeBeat(
        {
          title: line.trim().slice(0, 80),
          synopsis: line.trim(),
          planning_layer: ctx?.layer ?? "scene_grid",
          tab_title: ctx?.tab,
        },
        order++
      )
    );
  }
  return beats;
}

function extractChapterBeats(text: string, ctx?: { layer?: PlanningLayer; tab?: string }): IngestPlotBeat[] {
  const blocks = text.split(/(?=(?:^|\n)(?:chapter|ch\.?)\s+\d+[^\n]*\n)/gim);
  if (blocks.length <= 1) return [];
  const beats: IngestPlotBeat[] = [];
  let order = 0;
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length < 20) continue;
    if (isFranchiseChapterContent("", trimmed)) continue;
    const chapterNum = parseChapterNumber(trimmed);
    let synopsis = trimmed;
    if (chapterNum != null) {
      synopsis = trimmed.replace(/^(?:chapter|ch\.?)\s+\d+[^\n]*\n+/i, "").trim();
    }
    beats.push(
      withChapterPov(
        {
          synopsis: synopsis.slice(0, 2000),
          chapter_number: chapterNum,
          planning_layer: ctx?.layer ?? "chapter_breakdown",
          tab_title: ctx?.tab,
        },
        trimmed,
        order++
      )
    );
  }
  return beats;
}

function extractMacroOutlineBeats(text: string, ctx?: { tab?: string }): IngestPlotBeat[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /^(\d+[\.\):]|[\*\-]\s)/.test(l) && l.length > 10);
  if (lines.length < 2) return [];
  return lines.slice(0, 40).map((line, order) => {
    const synopsis = line.replace(/^(\d+[\.\):]|[\*\-]\s+)/, "").trim().slice(0, 800);
    return makeBeat(
      {
        title: titleFromMacroLine(synopsis),
        synopsis,
        planning_layer: "macro_outline",
        tab_title: ctx?.tab,
      },
      order
    );
  });
}

function extractBeatsFromSection(
  body: string,
  ctx: { tabTitle: string; layer: PlanningLayer }
): IngestPlotBeat[] {
  const tab = ctx.tabTitle;

  if (ctx.layer === "front_matter") {
    const para = body.split(/\n{2,}/).map((p) => p.trim()).find((p) => p.length > 40);
    if (!para) return [];
    return [
      makeBeat(
        {
          title: tab,
          synopsis: para.slice(0, 1500),
          planning_layer: ctx.layer,
          tab_title: tab,
        },
        0
      ),
    ];
  }

  if (ctx.layer === "book_synopsis") {
    return extractBookSynopsisBeats(body, tab);
  }

  if (ctx.layer === "notes") {
    const ideas = extractFranchiseIdeaBeats(body, tab);
    if (ideas.length) return ideas;
    const para = body.split(/\n{2,}/).map((p) => p.trim()).find((p) => p.length > 30);
    if (!para) return [];
    return [
      makeBeat(
        {
          title: tab.slice(0, 80),
          synopsis: para.slice(0, 2000),
          planning_layer: "notes",
          tab_title: tab,
        },
        0
      ),
    ];
  }

  if (ctx.layer === "macro_outline") {
    const embedded = extractEmbeddedSubsectionBeats(body, tab);
    if (embedded.length >= 2) return embedded;
    const macro = extractMacroOutlineBeats(body, { tab });
    if (macro.length >= 2) return macro;
    const title = tab || "Story outline";
    return [
      makeBeat(
        {
          title,
          synopsis: body.trim().slice(0, 2000),
          planning_layer: "macro_outline",
          tab_title: tab,
        },
        0
      ),
    ];
  }

  if (isDedicatedChapterTab(tab)) {
    return extractSingleChapterTabBeat(body, ctx);
  }

  if (ctx.layer === "chapter_breakdown" || ctx.layer === "unknown") {
    const tableChapters = extractChapterTableBeats(body, {
      tabTitle: tab,
      layer: "chapter_breakdown",
    });
    if (tableChapters.length >= 2) return tableChapters;

    const chapters = extractChapterBeats(body, { layer: "chapter_breakdown", tab });
    if (chapters.length >= 2) return chapters;
  }

  if (ctx.layer === "scene_grid") {
    const scenes = extractSceneLineBeats(body, { layer: "scene_grid", tab });
    const tables = extractBeatsFromTables(body, { layer: "scene_grid", tab });
    if (scenes.length >= tables.length && scenes.length >= 1) return scenes;
    if (tables.length >= 2) return tables;
    if (scenes.length >= 1) return scenes;
  }

  const tables = extractBeatsFromTables(body, { layer: ctx.layer, tab });
  if (tables.length >= 2) return tables;

  const scenes = extractSceneLineBeats(body, { layer: ctx.layer, tab });
  if (scenes.length >= 1) return scenes;

  const chapters = extractChapterBeats(body, { layer: "chapter_breakdown", tab });
  if (chapters.length >= 1) return chapters;

  return extractMacroOutlineBeats(body, { tab });
}

function pruneAggregateDuplicateSections(
  sections: Array<{ title: string; layer: PlanningLayer; body: string; path?: string }>,
  beats: IngestPlotBeat[]
): IngestPlotBeat[] {
  const dedicatedChapterTabs = sections.filter((s) => isDedicatedChapterTab(s.title)).length;
  if (dedicatedChapterTabs < 6) return beats;

  const allowedTitles = new Set(
    sections
      .filter((s) => !isLikelyAggregateSection(s, dedicatedChapterTabs))
      .map((s) => s.path ?? s.title)
  );

  return beats.filter((b) => {
    const ch = b.chapter_number ?? parseChapterNumber(b.synopsis);
    if (ch != null && b.planning_layer === "chapter_breakdown") {
      return true;
    }

    const tab = b.tab_title ?? "";
    if (!tab || tab === "Document") {
      if (ch != null) return false;
    }
    if (tab && !allowedTitles.has(tab) && isDedicatedChapterTab(tab)) return true;
    if (tab && allowedTitles.has(tab)) return true;
    if (!tab) return true;
    if (tab === "Document" && (b.chapter_number != null || parseChapterNumber(b.synopsis) != null)) {
      return false;
    }
    return (
      allowedTitles.has(tab) ||
      b.planning_layer === "macro_outline" ||
      b.planning_layer === "book_synopsis" ||
      b.planning_layer === "notes" ||
      b.planning_layer === "front_matter"
    );
  });
}

function isLikelyAggregateSection(
  section: { title: string; body: string },
  dedicatedChapterTabCount: number
): boolean {
  if (dedicatedChapterTabCount < 6) return false;
  const headings = countChapterHeadings(section.body);
  if (headings < 6) return false;
  if (isDedicatedChapterTab(section.title)) return false;
  if (/^chapter\s+\d+/i.test(section.title)) return false;
  return (
    section.title === "Document" ||
    /\b(outline|overall|master|quantum heart)\b/i.test(section.title) ||
    headings >= dedicatedChapterTabCount - 2
  );
}

export function dedupeBeats(beats: IngestPlotBeat[]): IngestPlotBeat[] {
  const byChapter = new Map<number, IngestPlotBeat[]>();
  const other: IngestPlotBeat[] = [];
  const seenKeys = new Set<string>();

  for (const b of beats) {
    const ch =
      b.chapter_number ?? parseChapterNumber(b.title ?? "") ?? parseChapterNumber(stripLayerPrefix(b.synopsis));

    if (ch != null) {
      const group = byChapter.get(ch) ?? [];
      group.push({ ...b, chapter_number: ch });
      byChapter.set(ch, group);
      continue;
    }

    if (b.planning_layer === "book_synopsis" || b.planning_layer === "notes") {
      const metaKey = `meta:${(b.title ?? "").trim().toLowerCase().slice(0, 100)}`;
      if (metaKey.length > 8 && seenKeys.has(metaKey)) continue;
      seenKeys.add(metaKey);
      other.push(b);
      continue;
    }

    const key = beatContentKey(b);
    if (key.length < 10 || seenKeys.has(key)) continue;
    seenKeys.add(key);
    other.push(b);
  }

  const merged: IngestPlotBeat[] = [...other];
  for (const group of byChapter.values()) {
    merged.push(pickBestChapterBeat(group));
  }

  return merged
    .sort((a, b) => {
      const ac = a.chapter_number ?? 9999;
      const bc = b.chapter_number ?? 9999;
      if (ac !== bc) return ac - bc;
      return beatPriorityForLayer(b.planning_layer ?? "unknown") - beatPriorityForLayer(a.planning_layer ?? "unknown");
    })
    .map((b, order) => ({ ...b, order }));
}

function capBeats(beats: IngestPlotBeat[]): IngestPlotBeat[] {
  return beats
    .sort(
      (a, b) =>
        beatPriorityForLayer(b.planning_layer ?? "unknown") -
        beatPriorityForLayer(a.planning_layer ?? "unknown")
    )
    .slice(0, MAX_OUTLINE_BEATS)
    .map((b, i) => ({ ...b, order: i }));
}

export function heuristicWikiFromTables(
  text: string,
  slot: DocumentIngestSlot,
  manuscriptId: string
): ProposedWikiEntry[] {
  const tabSections = splitTabSections(text);
  const bodies = tabSections.length ? tabSections : [{ title: "Document", layer: "unknown" as PlanningLayer, body: text }];

  const entries: ProposedWikiEntry[] = [];
  for (const section of bodies) {
    const beats = extractBeatsFromSection(section.body, {
      tabTitle: section.path ?? section.title,
      layer: section.layer,
    });
    const kind = wikiKindForPlanningLayer(section.layer);
    for (const b of beats.slice(0, 24)) {
      const title =
        resolveWikiBeatTitle(b, section.path ?? section.title, entries.length) ||
        b.synopsis.match(/(?:^|\n)(?:name|character|title)\s*:\s*(.+)/i)?.[1]?.trim() ||
        `Plot beat ${entries.length + 1}`;
      entries.push({
        title: title.slice(0, 80),
        excerpt: b.synopsis.slice(0, 1200),
        chunk_type: kind === "character" ? "character" : kind === "environment" ? "location" : "event",
        tags: ["file_import", section.layer, b.planning_layer ?? section.layer].filter(Boolean),
        wiki_metadata: {
          ...wikiMetaForEntityKind(kind, manuscriptId, slot, {
            planning_layer: section.layer,
            tab_title: section.title,
          }),
        },
      });
    }
  }

  if (entries.length >= 2) return entries.slice(0, MAX_WIKI_PROPOSED);
  return [];
}

export function extractOutlineBeatsFromText(text: string): IngestPlotBeat[] {
  const tabSections = splitTabSections(text);

  if (tabSections.length >= 1) {
    const all: IngestPlotBeat[] = [];
    for (const section of tabSections) {
      const label = section.path ?? section.title;
      const layer =
        section.layer === "unknown" ? classifyPlanningLayer(section.title) : section.layer;
      const dedicatedCount = tabSections.filter((s) => isDedicatedChapterTab(s.title)).length;
      if (isLikelyAggregateSection(section, dedicatedCount)) {
        const embedded = extractEmbeddedSubsectionBeats(section.body, label);
        if (embedded.length) {
          all.push(...embedded);
        } else if (layer === "macro_outline") {
          all.push(
            ...extractBeatsFromSection(section.body, { tabTitle: label, layer: "macro_outline" })
          );
        }
        const have = chapterNumbersInBeats(all);
        const fromAggregate = [
          ...extractChapterTableBeats(section.body, {
            tabTitle: label,
            layer: "chapter_breakdown",
          }),
          ...extractChapterBeats(section.body, { layer: "chapter_breakdown", tab: label }),
        ];
        for (const b of fromAggregate) {
          const ch = b.chapter_number ?? parseChapterNumber(b.synopsis);
          if (ch == null || have.has(ch)) continue;
          if (isFranchiseChapterContent(label, b.synopsis)) continue;
          all.push(b);
          have.add(ch);
        }
        continue;
      }
      all.push(...extractBeatsFromSection(section.body, { tabTitle: label, layer }));
    }
    const filled = fillMissingChapterBeats(all, tabSections);
    const pruned = pruneAggregateDuplicateSections(tabSections, filled);
    if (pruned.length >= 1) return compileOutlineBeats(capBeats(dedupeBeats(pruned)));
  }

  const layer = classifyPlanningLayer(text.slice(0, 500));
  const merged = extractBeatsFromSection(text, { tabTitle: "Document", layer });
  if (merged.length >= 1) return compileOutlineBeats(capBeats(dedupeBeats(merged)));

  const sectionBlocks = text.split(/\n--- SECTION ---\n/g).map((b) => b.trim()).filter(Boolean);
  if (sectionBlocks.length >= 2) {
    const beats: IngestPlotBeat[] = [];
    let order = 0;
    for (const block of sectionBlocks) {
      const title = block.split(/\n/)[0]?.trim().slice(0, 120) ?? "Section";
      const sectionLayer = classifyPlanningLayer(title);
      beats.push(
        ...extractBeatsFromSection(block, { tabTitle: title, layer: sectionLayer }).map((b) => ({
          ...b,
          order: order++,
        }))
      );
    }
    if (beats.length >= 2) return compileOutlineBeats(capBeats(dedupeBeats(beats)));
  }

  return compileOutlineBeats(capBeats(dedupeBeats(merged)));
}

export function buildManuscriptOutlineFromBeats(beats: IngestPlotBeat[]): string {
  const sorted = [...beats].sort((a, b) => {
    const ac = a.chapter_number ?? a.order;
    const bc = b.chapter_number ?? b.order;
    return ac - bc;
  });
  return sorted
    .map((b, i) => {
      const head = b.title?.trim() || b.synopsis.split(/\n/)[0]?.trim() || b.synopsis;
      return `${i + 1}. ${head}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function plotBeatsToSceneWikiEntries(
  beats: IngestPlotBeat[],
  manuscriptId: string,
  slot: string
): ProposedWikiEntry[] {
  return beats.slice(0, MAX_SCENE_WIKI_FROM_BEATS).map((b, i) => {
    const layer = b.planning_layer ?? "scene_grid";
    const entityKind =
      layer === "notes"
        ? "note"
        : layer === "book_synopsis"
          ? "plot_point"
          : layer === "chapter_breakdown"
            ? "chapter"
            : "plot_point";
    const sceneTitle =
      resolveWikiBeatTitle(b, b.tab_title ?? "", i) ||
      b.synopsis.match(/scene\s*#?\s*(\d+)/i)?.[0] ||
      (b.chapter_number != null ? `Chapter ${b.chapter_number}` : null) ||
      b.tab_title ||
      `Scene ${i + 1}`;
    const block = WIKI_BUILDING_BLOCK_META[entityKind] ?? WIKI_BUILDING_BLOCK_META.plot_point;
    return {
      title: String(sceneTitle).slice(0, 80),
      excerpt: b.synopsis.slice(0, 1200),
      chunk_type: block.chunk_type,
      tags: [
        entityKind === "note" ? "sequel_spinoff" : "plot_point",
        "file_import",
        layer,
      ],
      wiki_metadata: {
        ...wikiMetaForEntityKind(entityKind, manuscriptId, slot, {
          planning_layer: b.planning_layer,
          tab_title: b.tab_title,
          scene_card: layer === "scene_grid" || layer === "chapter_breakdown",
          pov_mode: b.pov_mode,
          pov_names: b.pov_names,
          beat_title: b.title,
        }),
        plot_point_order: b.plot_point_order ?? b.chapter_number ?? i + 1,
      },
    };
  });
}

export function mergePlotBeats(
  fromLlm: IngestPlotBeat[] | undefined,
  fromText: IngestPlotBeat[]
): IngestPlotBeat[] {
  const combined = [...fromText, ...(fromLlm ?? [])];
  return capBeats(dedupeBeats(combined));
}
