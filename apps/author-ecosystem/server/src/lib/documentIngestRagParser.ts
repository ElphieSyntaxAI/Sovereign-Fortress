import type { DocumentIngestSlot, ProposedWikiEntry } from "./documentIngestGate.js";
import { slotDefaultMetadata } from "./documentIngestGate.js";
import { areNearDuplicateTexts } from "./documentIngestCompile.js";
import {
  distillDomainSectionToFactCards,
  isLoreDomainSectionHeading,
} from "./documentIngestFactCards.js";
import { MAX_GOOGLE_DOC_TABS, MAX_RAG_WIKI_EXCERPT } from "./documentIngestLimits.js";
import { detectHeuristicBoundaries } from "./narrative/semanticChunking.js";
import {
  splitTabSections,
  wikiKindForPlanningLayer,
  type PlanningLayer,
} from "./documentPlanningTaxonomy.js";
import {
  inferFoundationFromHeading,
  inferFoundationFromRagTagName,
  isFoundationDomainHeading,
  type FoundationInference,
} from "./storyFoundationTaxonomy.js";

export type RagTag = { name: string; value: string };

export type IngestPairingDiagnostic = {
  section_path: string;
  heading: string;
  outline_entity_kind: string;
  source_type: string;
  plot_engine_panel: string;
  ledger: "static" | "state" | "instruction";
};

const RAG_TAG_BRACKET_RE = /\[RAG\s+TAG:\s*([^\]]+)\]/gi;
const RAG_TAG_INLINE_RE = /RAG\s+TAG:\s*\[([^\]]+)\]/gi;

const CAPS_HEADER_RE = /^[A-Z][A-Z0-9\s/&\-—–.:]{3,}$/;
const SECTION_BREAK_RE = /^---+\s*(?:SECTION|TAB)?\s*---+\s*$/i;
const DOMAIN_LINE_RE =
  /^(technology|government|politics|species|history|timeline|chronology|magic|religion|geography|economy|culture|military|biology|physics|propulsion|climate|language|fauna|flora|ecosystem|geology|prophecy|era|dynasty|ancestry|xenobiology|law|food|theme|genre|trope|spoiler|character|planet|solar.?system|spatial|senses|parallel.?arc|sensitivity)\b/i;

export function parseRagTagsFromText(text: string): RagTag[] {
  const tags: RagTag[] = [];
  const pushTag = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const pipe = trimmed.indexOf("|");
    if (pipe >= 0) {
      tags.push({
        name: trimmed.slice(0, pipe).trim(),
        value: trimmed.slice(pipe + 1).trim(),
      });
    } else {
      tags.push({ name: trimmed, value: "" });
    }
  };
  for (const m of text.matchAll(RAG_TAG_BRACKET_RE)) {
    pushTag(String(m[1] ?? ""));
  }
  for (const m of text.matchAll(RAG_TAG_INLINE_RE)) {
    pushTag(String(m[1] ?? ""));
  }
  return tags;
}

export function inferDomainFromHeading(heading: string): {
  kind: string;
  domain: string;
  panel: string;
  location_kind?: string;
  stack_layer?: string;
  source_type?: string;
  distill?: boolean;
} {
  const inf = inferFoundationFromHeading(heading);
  return {
    kind: inf.kind,
    domain: inf.domain,
    panel: inf.panel,
    location_kind: inf.location_kind,
    stack_layer: inf.stack_layer,
    source_type: inf.source_type,
    distill: inf.distill,
  };
}

function foundationToInferred(inf: FoundationInference) {
  return {
    kind: inf.kind,
    domain: inf.domain,
    panel: inf.panel,
    location_kind: inf.location_kind,
    stack_layer: inf.stack_layer,
    source_type: inf.source_type,
    distill: inf.distill,
  };
}

/** Emit one fact card per RAG TAG — these are the World Bible / Outline foundation atoms. */
export function factCardsFromRagTags(
  tags: RagTag[],
  sectionPath: string,
  baseMeta: Record<string, unknown>
): ProposedWikiEntry[] {
  const out: ProposedWikiEntry[] = [];
  for (const tag of tags) {
    const label = tag.value ? `${tag.name}: ${tag.value}` : tag.name;
    const title = (tag.value || tag.name).replace(/\s+/g, " ").trim().slice(0, 100);
    if (title.length < 2) continue;
    const inferred = foundationToInferred(inferFoundationFromRagTagName(tag.name));
    const excerpt = `${label}.`.slice(0, MAX_RAG_WIKI_EXCERPT);
    if (excerpt.length < 24) continue;
    out.push({
      title,
      excerpt,
      chunk_type:
        inferred.kind === "character"
          ? "character"
          : inferred.kind === "plot_point" || inferred.kind === "chapter"
            ? "event"
            : inferred.kind === "theme" || inferred.kind === "genre"
              ? "theme"
              : "location",
      tags: ["file_import", "rag_tag", "fact_card", inferred.domain],
      wiki_metadata: {
        ...baseMeta,
        outline_entity_kind: inferred.kind,
        semantic_domain: inferred.domain,
        stack_layer: inferred.stack_layer,
        location_kind: inferred.location_kind,
        source_type: inferred.source_type ?? baseMeta.source_type ?? "world_bible",
        section_path: `${sectionPath} › RAG:${title}`,
        rag_canon: false,
        fact_card: true,
        lore_fact_distill: true,
        foundation: true,
        rag_tag: tag,
        wiki_author_entry: true,
        lore_extraction: true,
      },
    });
  }
  return out;
}

/**
 * Markdown planet / entity tables from RAG READY WORLD BIBLE §1.2.2 → one card per data row.
 */
export function factCardsFromMarkdownTables(
  body: string,
  sectionPath: string,
  inferred: ReturnType<typeof inferDomainFromHeading>,
  baseMeta: Record<string, unknown>
): ProposedWikiEntry[] {
  const lines = body.split(/\n/);
  const out: ProposedWikiEntry[] = [];
  let headers: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!/^\|.+\|$/.test(line)) {
      headers = null;
      continue;
    }
    if (/^\|\s*-+/.test(line)) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length < 2) continue;
    if (!headers) {
      headers = cells;
      continue;
    }
    const name = cells[0]?.replace(/^\[|\]$/g, "").trim();
    if (!name || /^name$/i.test(name) || name.length < 2) continue;
    const facts = headers
      .slice(1)
      .map((h, idx) => {
        const v = (cells[idx + 1] ?? "").replace(/^\[|\]$/g, "").trim();
        if (!v || /^\[?name\]?$/i.test(v)) return null;
        return `${h}: ${v}`;
      })
      .filter(Boolean);
    if (facts.length === 0) continue;
    const excerpt = `${name}: ${facts.join(". ")}.`.slice(0, MAX_RAG_WIKI_EXCERPT);
    out.push({
      title: name.slice(0, 100),
      excerpt,
      chunk_type: "location",
      tags: ["file_import", "table_row", "fact_card", inferred.domain],
      wiki_metadata: {
        ...baseMeta,
        outline_entity_kind: inferred.kind,
        semantic_domain: inferred.domain === "other" ? "planet" : inferred.domain,
        stack_layer: inferred.stack_layer ?? "environment",
        location_kind: inferred.location_kind ?? "planet",
        source_type: inferred.source_type ?? "world_bible",
        section_path: `${sectionPath} › ${name}`,
        rag_canon: false,
        fact_card: true,
        lore_fact_distill: true,
        foundation: true,
        table_row: true,
        wiki_author_entry: true,
        lore_extraction: true,
      },
    });
  }
  return out;
}

function slotToSourceType(slot: DocumentIngestSlot): string {
  if (slot === "character_sheet") return "character_sheet";
  if (slot === "current_draft") return "story_outline";
  return "world_bible";
}

function detectLedger(text: string): "static" | "state" | "instruction" {
  if (/state ledger|live thematic|current state|what happens now/i.test(text)) return "state";
  if (/ai instruction|read-only|do not suggest/i.test(text)) return "instruction";
  return "static";
}

function extractPlotHints(tags: RagTag[]): {
  plot_point: string;
  spoiler_level: string;
  plot_point_order?: number;
} {
  let plot_point = "not_applicable";
  let spoiler_level = "none";
  let plot_point_order: number | undefined;

  for (const tag of tags) {
    const blob = `${tag.name} ${tag.value}`.toLowerCase();
    if (/spoiler level:\s*high/.test(blob)) spoiler_level = "high";
    else if (/spoiler level:\s*medium/.test(blob)) spoiler_level = "medium";
    else if (/spoiler level:\s*low/.test(blob)) spoiler_level = "low";
    if (/plot weight:\s*heavy/.test(blob)) plot_point_order = 7;
    if (tag.name.toLowerCase().includes("history")) spoiler_level = spoiler_level === "none" ? "medium" : spoiler_level;
    if (/hook|inciting|midpoint|climax|resolution/.test(blob)) plot_point = tag.name.split(":")[0]?.trim() || plot_point;
  }

  return { plot_point, spoiler_level, plot_point_order };
}

function isTitleCaseHeading(t: string): boolean {
  if (t.length < 6 || t.length > 80) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 8) return false;
  return words.every((w) => /^[A-Z][a-zA-Z'/-]*$/.test(w));
}

function isSectionHeadingLine(t: string): boolean {
  if (t.length < 4 || t.length > 120) return false;
  if (t.startsWith("[RAG")) return false;
  if (SECTION_BREAK_RE.test(t)) return true;
  if (CAPS_HEADER_RE.test(t)) return true;
  if (isTitleCaseHeading(t)) return true;
  if (/^#{1,4}\s+/.test(t)) return true;
  if (/^\d+(?:\.\d+)*\s*[.)-]?\s+\S/.test(t)) return true;
  if (DOMAIN_LINE_RE.test(t) && t.length < 64) return true;
  if (/^[A-Z][a-zA-Z\s/&\-—–.:]{2,40}:$/.test(t)) return true;
  return false;
}

function headingFromLine(t: string): string {
  const md = /^(#{1,4})\s+(.+)/.exec(t);
  if (md?.[2]) return md[2].trim();
  const numbered = /^(\d+(?:\.\d+)*)\s*[.)-]?\s*(.+)/.exec(t);
  if (numbered?.[2]) return numbered[2].trim();
  return t.replace(/:$/, "").trim();
}

function splitAtHeuristicBoundaries(
  body: string,
  parentPath: string
): Array<{ heading: string; path: string; text: string }> {
  const bounds = detectHeuristicBoundaries(body);
  if (bounds.length < 2) return [];

  const out: Array<{ heading: string; path: string; text: string }> = [];
  for (let i = 0; i < bounds.length; i++) {
    const start = bounds[i]!.charOffset;
    const end = i + 1 < bounds.length ? bounds[i + 1]!.charOffset : body.length;
    const slice = body.slice(start, end).trim();
    if (slice.length < 20) continue;
    const label = bounds[i]!.label?.trim() || `Section ${i + 1}`;
    out.push({
      heading: label.slice(0, 100),
      path: `${parentPath}.${i + 1}`,
      text: slice,
    });
  }
  return out;
}

export function splitBodyIntoRagSections(
  body: string,
  parentPath: string
): Array<{ heading: string; path: string; text: string }> {
  const lines = body.split("\n");
  type Acc = { heading: string; path: string; buf: string[] };
  const out: Array<{ heading: string; path: string; text: string }> = [];
  let current: Acc | null = null;
  let autoIdx = 0;

  const flush = () => {
    if (!current) return;
    const text = current.buf.join("\n").trim();
    if (text.length >= 20) {
      out.push({ heading: current.heading, path: current.path, text });
    }
    current = null;
  };

  for (const line of lines) {
    const t = line.trim();
    const isHeading = isSectionHeadingLine(t);

    if (isHeading) {
      flush();
      autoIdx += 1;
      const heading = headingFromLine(t);
      const numbered = /^(\d+(?:\.\d+)*)\s*[.)-]?\s*/.exec(t);
      const path = numbered?.[1] ?? `${parentPath}.${autoIdx}`;
      current = { heading, path, buf: [] };
      continue;
    }

    if (!current) {
      autoIdx += 1;
      current = {
        heading: parentPath || "Section",
        path: parentPath || "1",
        buf: [],
      };
    }
    current.buf.push(line);
  }
  flush();

  flush();

  if (out.length <= 1 && body.trim().length > 600) {
    const heuristic = splitAtHeuristicBoundaries(body, parentPath);
    if (heuristic.length >= 2) return heuristic;
  }

  if (out.length === 0 && body.trim().length >= 20) {
    return [{ heading: parentPath || "Section", path: parentPath || "1", text: body.trim() }];
  }
  return out;
}

function kindForTabLayer(layer: PlanningLayer, heading: string, fallback: string): string {
  if (layer === "character_bible") return "character";
  if (layer === "world_bible") return inferDomainFromHeading(heading).kind;
  if (layer === "chapter_breakdown") return "chapter";
  if (layer === "macro_outline" || layer === "scene_grid" || layer === "book_synopsis") {
    return "plot_point";
  }
  return fallback;
}

/**
 * Parse RAG-ready documents into structured wiki rows aligned with docs/rag templates.
 */
export function parseDocumentToRagSections(
  text: string,
  slot: DocumentIngestSlot,
  manuscriptId: string
): { proposedWiki: ProposedWikiEntry[]; diagnostics: IngestPairingDiagnostic[] } {
  const source_type = slotToSourceType(slot);
  const baseMeta = slotDefaultMetadata(slot, manuscriptId);
  const proposedWiki: ProposedWikiEntry[] = [];
  const diagnostics: IngestPairingDiagnostic[] = [];

  const tabs = splitTabSections(text);
  const units =
    tabs.length > 0
      ? tabs
      : [
          {
            title: "Document",
            body: text,
            layer: "unknown" as PlanningLayer,
            path: undefined,
          },
        ];

  for (const tab of units.slice(0, MAX_GOOGLE_DOC_TABS)) {
    const layerKind = wikiKindForPlanningLayer(tab.layer);
    const parentPath = tab.path ? `${tab.path} › ${tab.title}` : tab.title;
    const subsections = splitBodyIntoRagSections(tab.body, parentPath);

    for (const sub of subsections) {
      if (sub.text.length < 20) continue;

      const tags = parseRagTagsFromText(sub.text);
      const inferred = inferDomainFromHeading(sub.heading);
      const kind = kindForTabLayer(tab.layer, sub.heading, layerKind);
      const ledger = detectLedger(sub.text);
      const plotHints = extractPlotHints(tags);

      const pushWikiRow = (row: ProposedWikiEntry) => {
        proposedWiki.push(row);
        diagnostics.push({
          section_path: String(row.wiki_metadata?.section_path ?? sub.path),
          heading: row.title,
          outline_entity_kind: String(row.wiki_metadata?.outline_entity_kind ?? kind),
          source_type: String(row.wiki_metadata?.source_type ?? source_type),
          plot_engine_panel: inferred.panel,
          ledger,
        });
      };

      const sectionBase = {
        ...baseMeta,
        ledger,
        plot_point: plotHints.plot_point,
        spoiler_level: plotHints.spoiler_level,
        plot_point_order: plotHints.plot_point_order,
        rag_tags: tags,
        wiki_author_entry: true,
        lore_extraction: true,
        planning_layer: tab.layer,
        tab_title: tab.title,
        foundation: true,
      };

      // RAG TAG atoms from World Bible / Outline templates — always foundation cards.
      for (const tagCard of factCardsFromRagTags(tags, sub.path, sectionBase)) {
        pushWikiRow(tagCard);
      }

      // Markdown tables (e.g. Interplanetary Data planet list) → one card per row.
      for (const tableCard of factCardsFromMarkdownTables(sub.text, sub.path, inferred, sectionBase)) {
        pushWikiRow(tableCard);
      }

      const shouldDistill =
        isFoundationDomainHeading(sub.heading) ||
        isFoundationDomainHeading(inferred.domain) ||
        isLoreDomainSectionHeading(sub.heading) ||
        inferred.distill === true ||
        tab.layer === "world_bible" ||
        tab.layer === "character_bible";

      // Story foundations: one fact card per entity — never the whole section dump.
      if (shouldDistill) {
        const cards = distillDomainSectionToFactCards({
          sectionHeading: sub.heading,
          sectionPath: sub.path,
          body: sub.text,
          inferred: {
            kind: kind === "character" || kind === "plot_point" || kind === "theme" || kind === "genre"
              ? kind
              : inferred.kind,
            domain: inferred.domain,
            panel: inferred.panel,
            location_kind: inferred.location_kind,
            stack_layer: inferred.stack_layer,
          },
        });
        for (const card of cards) {
          // Skip if we already emitted the same title from a table/RAG tag.
          const titleKey = card.title.toLowerCase();
          if (
            proposedWiki.some(
              (r) =>
                r.title.toLowerCase() === titleKey &&
                String(r.wiki_metadata?.semantic_domain ?? "") === String(card.metadata.semantic_domain ?? "")
            )
          ) {
            continue;
          }
          pushWikiRow({
            title: card.title,
            excerpt: card.excerpt.slice(0, MAX_RAG_WIKI_EXCERPT),
            chunk_type:
              inferred.kind === "character"
                ? "character"
                : inferred.kind === "plot_point" || inferred.kind === "chapter"
                  ? "event"
                  : inferred.kind === "theme" || inferred.kind === "genre"
                    ? "theme"
                    : "location",
            tags: ["file_import", "fact_card", "foundation", source_type, inferred.domain].filter(
              Boolean
            ),
            wiki_metadata: {
              ...sectionBase,
              ...card.metadata,
              source_type: inferred.source_type ?? source_type,
            },
          });
        }
        continue;
      }

      const title =
        sub.heading.trim().slice(0, 100) ||
        sub.text
          .split("\n")
          .find((l) => l.trim().length > 2)
          ?.trim()
          .slice(0, 100) ||
        "Section";

      const excerpt = sub.text.slice(0, MAX_RAG_WIKI_EXCERPT);

      pushWikiRow({
        title,
        excerpt,
        chunk_type:
          kind === "character"
            ? "character"
            : kind === "plot_point" || kind === "chapter"
              ? "event"
              : "location",
        tags: ["file_import", source_type, inferred.domain].filter(Boolean),
        wiki_metadata: {
          ...sectionBase,
          outline_entity_kind: kind,
          source_type,
          section_path: sub.path,
          rag_canon: true,
          semantic_domain: inferred.domain,
          location_kind: inferred.location_kind,
          stack_layer: inferred.stack_layer,
          foundation: false,
        },
      });
    }
  }

  return { proposedWiki, diagnostics };
}

/** Tab markers / Google Doc export sections for scan diagnostics. */
export function buildIngestTabDiagnostics(text: string): {
  count: number;
  method: string;
  sections: Array<{ title: string; path?: string; layer: string }>;
} | null {
  const tabs = splitTabSections(text);
  if (tabs.length === 0) return null;
  return {
    count: tabs.length,
    method: "tab_markers",
    sections: tabs.map((s) => ({
      title: s.title,
      path: s.path,
      layer: s.layer,
    })),
  };
}

/** Merge RAG-template rows into an existing proposed list without duplicates.
 * Prefer multi-pass / fact-card (short entity facts) over long section dumps.
 */
export function mergeRagProposedWiki(
  existing: ProposedWikiEntry[],
  text: string,
  slot: DocumentIngestSlot,
  manuscriptId: string
): { proposed: ProposedWikiEntry[]; diagnostics: IngestPairingDiagnostic[] } {
  const { proposedWiki, diagnostics } = parseDocumentToRagSections(text, slot, manuscriptId);
  const merged = [...existing];

  const quality = (row: ProposedWikiEntry): number => {
    let score = 0;
    if (row.wiki_metadata?.multi_pass === true) score += 40;
    if (row.wiki_metadata?.fact_card === true || row.wiki_metadata?.lore_fact_distill === true) score += 35;
    if (row.wiki_metadata?.rag_canon === true) score += 5;
    // Prefer concise fact excerpts over chapter blobs.
    const len = row.excerpt.length;
    if (len > 0 && len <= 520) score += 20;
    if (len > 1200) score -= 30;
    return score;
  };

  for (const row of proposedWiki) {
    const dup = merged.find(
      (e) =>
        areNearDuplicateTexts(e.excerpt, row.excerpt) ||
        (e.title.toLowerCase() === row.title.toLowerCase() &&
          String(e.wiki_metadata?.section_path ?? "") ===
            String(row.wiki_metadata?.section_path ?? "")) ||
        (e.title.toLowerCase() === row.title.toLowerCase() &&
          String(e.wiki_metadata?.semantic_domain ?? "") ===
            String(row.wiki_metadata?.semantic_domain ?? "") &&
          String(e.wiki_metadata?.semantic_domain ?? "").length > 0)
    );
    if (dup) {
      if (quality(row) > quality(dup)) {
        const idx = merged.indexOf(dup);
        merged[idx] = row;
      }
      continue;
    }
    merged.push(row);
  }

  return { proposed: merged, diagnostics };
}
