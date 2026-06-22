import type { DocumentIngestSlot, ProposedWikiEntry } from "./documentIngestGate.js";
import { slotDefaultMetadata } from "./documentIngestGate.js";
import { areNearDuplicateTexts } from "./documentIngestCompile.js";
import { MAX_GOOGLE_DOC_TABS, MAX_RAG_WIKI_EXCERPT } from "./documentIngestLimits.js";
import { detectHeuristicBoundaries } from "./narrative/semanticChunking.js";
import {
  splitTabSections,
  wikiKindForPlanningLayer,
  type PlanningLayer,
} from "./documentPlanningTaxonomy.js";

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
  /^(technology|government|politics|species|history|timeline|chronology|magic|religion|geography|economy|culture|military|biology|physics|propulsion|climate|language|fauna|flora|ecosystem|geology|prophecy|era|dynasty|ancestry|xenobiology)\b/i;

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
} {
  const h = heading.toLowerCase();
  if (/tech|propulsion|engineer|system law|hard magic|soft magic/.test(h)) {
    return { kind: "setting", domain: "technology", panel: "settings" };
  }
  if (
    /planet|orbit|atmosphere|biome|geo|solar|gravity|climate|environment|fauna|flora|species|biology|ecolog|terrestrial|spatial|xenobiology|alien|race|cryptid|genome|lineage|ancestry/.test(
      h
    )
  ) {
    return { kind: "environment", domain: "species", panel: "environmental" };
  }
  if (/history|timeline|prophecy|chronolog|era\b|ancient|dynasty|epoch|millennia|centur(y|ies)|collapse|prehistory/.test(h)) {
    return { kind: "environment", domain: "history", panel: "environmental" };
  }
  if (/timeline|chronology|sequence of events|dated events/.test(h)) {
    return { kind: "environment", domain: "history", panel: "environmental" };
  }
  if (/government|politic|law|treaty|faction|regime/.test(h)) {
    return { kind: "environment", domain: "government", panel: "environmental" };
  }
  if (/character|cast|dramatis|persona/.test(h)) {
    return { kind: "character", domain: "character", panel: "character" };
  }
  if (/setting|location|place|venue|scene now/.test(h)) {
    return { kind: "setting", domain: "setting", panel: "settings" };
  }
  if (/theme|motif|moral/.test(h)) {
    return { kind: "theme", domain: "theme", panel: "theme" };
  }
  if (/outline|chapter|scene|beat|act\b/.test(h)) {
    return { kind: "plot_point", domain: "outline", panel: "breadcrumbs" };
  }
  return { kind: "environment", domain: "other", panel: "environmental" };
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

      const title =
        sub.heading.trim().slice(0, 100) ||
        sub.text
          .split("\n")
          .find((l) => l.trim().length > 2)
          ?.trim()
          .slice(0, 100) ||
        "Section";

      const excerpt = sub.text.slice(0, MAX_RAG_WIKI_EXCERPT);

      proposedWiki.push({
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
          ...baseMeta,
          outline_entity_kind: kind,
          source_type,
          section_path: sub.path,
          rag_canon: true,
          ledger,
          semantic_domain: inferred.domain,
          plot_point: plotHints.plot_point,
          spoiler_level: plotHints.spoiler_level,
          plot_point_order: plotHints.plot_point_order,
          rag_tags: tags,
          wiki_author_entry: true,
          lore_extraction: true,
          planning_layer: tab.layer,
          tab_title: tab.title,
        },
      });

      diagnostics.push({
        section_path: sub.path,
        heading: sub.heading,
        outline_entity_kind: kind,
        source_type,
        plot_engine_panel: inferred.panel,
        ledger,
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

/** Merge RAG-template rows into an existing proposed list without duplicates. */
export function mergeRagProposedWiki(
  existing: ProposedWikiEntry[],
  text: string,
  slot: DocumentIngestSlot,
  manuscriptId: string
): { proposed: ProposedWikiEntry[]; diagnostics: IngestPairingDiagnostic[] } {
  const { proposedWiki, diagnostics } = parseDocumentToRagSections(text, slot, manuscriptId);
  const merged = [...existing];

  for (const row of proposedWiki) {
    const dup = merged.find(
      (e) =>
        areNearDuplicateTexts(e.excerpt, row.excerpt) ||
        (e.title.toLowerCase() === row.title.toLowerCase() &&
          String(e.wiki_metadata?.section_path ?? "") ===
            String(row.wiki_metadata?.section_path ?? ""))
    );
    if (dup) {
      if (row.excerpt.length > dup.excerpt.length) {
        const idx = merged.indexOf(dup);
        merged[idx] = row;
      }
      continue;
    }
    merged.push(row);
  }

  return { proposed: merged, diagnostics };
}
