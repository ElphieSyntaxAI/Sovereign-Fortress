/**
 * Distill a lore-domain section (PLANETS / RELIGION / TECHNOLOGY / …) into
 * entity-scoped fact cards instead of one blob of chapter text.
 */

import { MAX_FACT_CARD_EXCERPT } from "./documentIngestLimits.js";

export type LoreDomainInference = {
  kind: string;
  domain: string;
  panel: string;
  location_kind?: string;
  stack_layer?: string;
};

const ENTITY_LEAD_RE =
  /^(?:[-*•]\s*)?(?:\*\*)?([A-Z][A-Za-z0-9'’\- ]{1,64})(?:\*\*)?\s*(?:[:—–\-]|is\b|are\b|was\b|were\b)/;

const FLUFF_LINE_RE =
  /^(?:in this chapter|as we (?:see|learn)|the reader|importantly|interestingly|meanwhile|suddenly)\b/i;

function trimFactExcerpt(raw: string, max = MAX_FACT_CARD_EXCERPT): string {
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";
  // Drop narrative fluff openers inside the card.
  const sentences = s.split(/(?<=[.!?])\s+/).filter((x) => {
    const t = x.trim();
    if (t.length < 12) return false;
    if (FLUFF_LINE_RE.test(t)) return false;
    return true;
  });
  s = (sentences.length > 0 ? sentences : [s]).join(" ").trim();
  if (s.length <= max) return s;
  // Prefer sentence boundary when truncating.
  const cut = s.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastStop >= Math.floor(max * 0.45)) return cut.slice(0, lastStop + 1).trim();
  return `${cut.trim()}…`;
}

function titleFromBlock(block: string, fallback: string): string {
  const first = block.split(/\n/).map((l) => l.trim()).find((l) => l.length > 1) ?? "";
  const lead = ENTITY_LEAD_RE.exec(first);
  if (lead?.[1]) return lead[1].trim().slice(0, 80);
  // "Name — fact" / "Name: fact"
  const dash = /^([A-Z][A-Za-z0-9'’\- ]{1,64})\s*[:—–\-]/.exec(first);
  if (dash?.[1]) return dash[1].trim().slice(0, 80);
  // Bold markdown title
  const bold = /^\*\*([^*]{1,64})\*\*/.exec(first);
  if (bold?.[1]) return bold[1].trim().slice(0, 80);
  const words = first.replace(/^[-*•]\s+/, "").split(/\s+/).slice(0, 6).join(" ");
  if (words.length >= 2) return words.slice(0, 80);
  return fallback.slice(0, 80);
}

function bodyWithoutTitleLine(block: string, title: string): string {
  const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  const first = lines[0] ?? "";
  if (
    first.toLowerCase().startsWith(title.toLowerCase()) ||
    new RegExp(`^[-*•]?\\s*\\*?\\*?${escapeReg(title)}`, "i").test(first)
  ) {
    const rest = first.replace(new RegExp(`^[-*•]?\\s*\\*?\\*?${escapeReg(title)}\\*?\\*?\\s*[:—–\\-]?\\s*`, "i"), "");
    return [rest, ...lines.slice(1)].filter(Boolean).join(" ").trim();
  }
  return lines.join(" ").trim();
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split a section body into candidate entity blocks (paragraph / bullet / named lead). */
export function splitLoreBodyIntoEntityBlocks(body: string): string[] {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Prefer blank-line paragraphs; fall back to bullet lines.
  let parts = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 20);

  if (parts.length <= 1) {
    const bulletish = normalized
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => /^[-*•]/.test(l) || ENTITY_LEAD_RE.test(l));
    if (bulletish.length >= 2) {
      parts = bulletish;
    }
  }

  // Named-lead lines inside a long paragraph blob: re-split.
  if (parts.length === 1 && parts[0]!.length > 700) {
    const lines = parts[0]!.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const regrouped: string[] = [];
    let buf: string[] = [];
    for (const line of lines) {
      if (ENTITY_LEAD_RE.test(line) && buf.length > 0) {
        regrouped.push(buf.join("\n"));
        buf = [line];
      } else {
        buf.push(line);
      }
    }
    if (buf.length) regrouped.push(buf.join("\n"));
    if (regrouped.length >= 2) parts = regrouped;
  }

  return parts;
}

/**
 * Turn a domain section into one fact card per named entity / bullet.
 * Never returns the entire section body as a single excerpt when it can split.
 */
export function distillDomainSectionToFactCards(params: {
  sectionHeading: string;
  sectionPath: string;
  body: string;
  inferred: LoreDomainInference;
}): Array<{ title: string; excerpt: string; metadata: Record<string, unknown> }> {
  const blocks = splitLoreBodyIntoEntityBlocks(params.body);
  const cards: Array<{ title: string; excerpt: string; metadata: Record<string, unknown> }> = [];
  const domainLabel = params.sectionHeading.trim() || params.inferred.domain;

  const pushCard = (title: string, excerptRaw: string, blockIndex: number) => {
    const excerpt = trimFactExcerpt(excerptRaw);
    if (excerpt.length < 24) return;
    cards.push({
      title: title.slice(0, 100),
      excerpt,
      metadata: {
        semantic_domain: params.inferred.domain,
        outline_entity_kind: params.inferred.kind,
        location_kind: params.inferred.location_kind,
        stack_layer: params.inferred.stack_layer,
        section_path: `${params.sectionPath} › ${title}`,
        parent_section: domainLabel,
        fact_card: true,
        rag_canon: false,
        multi_pass: false,
        lore_fact_distill: true,
        block_index: blockIndex,
      },
    });
  };

  if (blocks.length === 0) {
    pushCard(domainLabel, params.body, 0);
    return cards;
  }

  // Single oversized blob with no clear entity leads → keep as one capped fact summary, not 6k dump.
  if (blocks.length === 1 && blocks[0]!.length > 600 && !ENTITY_LEAD_RE.test(blocks[0]!)) {
    pushCard(domainLabel, blocks[0]!, 0);
    return cards;
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const title = titleFromBlock(block, `${domainLabel} ${i + 1}`);
    const body = bodyWithoutTitleLine(block, title) || block;
    // Prefer "Name: facts" shape for embedding.
    const excerpt =
      body.toLowerCase().startsWith(title.toLowerCase())
        ? body
        : `${title}: ${body}`;
    pushCard(title, excerpt, i);
  }

  return cards;
}

import { isFoundationDomainHeading } from "./storyFoundationTaxonomy.js";

/** Headings that should never become one giant wiki row (full planner/RAG foundation set). */
export function isLoreDomainSectionHeading(heading: string): boolean {
  return isFoundationDomainHeading(heading);
}
