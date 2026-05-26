import { createHash } from "node:crypto";

import type { ProposedWikiEntry } from "./documentIngestGate.js";
import {
  dedupeBeats,
  type IngestPlotBeat,
} from "./documentIngestOutline.js";
import {
  formatTabSectionHeader,
  splitTabSections,
  type PlanningLayer,
} from "./documentPlanningTaxonomy.js";

export type CompileIngestStats = {
  outline_beats_before: number;
  outline_beats_after: number;
  wiki_entries_before: number;
  wiki_entries_after: number;
  source_chars_before?: number;
  source_chars_after?: number;
};

export type CompiledDocumentIngest = {
  outline_beats: IngestPlotBeat[];
  proposed_wiki: ProposedWikiEntry[];
  source_text?: string;
  stats: CompileIngestStats;
};

/** Normalize text for near-duplicate comparison across tabs. */
export function synopsisFingerprint(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .slice(0, 500);
}

export function areNearDuplicateTexts(a: string, b: string): boolean {
  const fa = synopsisFingerprint(a);
  const fb = synopsisFingerprint(b);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  if (fa.length >= 30 && fb.length >= 30 && (fa.includes(fb) || fb.includes(fa))) return true;

  const ta = new Set(fa.split(" ").filter((w) => w.length > 3));
  const tb = new Set(fb.split(" ").filter((w) => w.length > 3));
  if (ta.size < 4 || tb.size < 4) return false;
  let inter = 0;
  for (const w of ta) {
    if (tb.has(w)) inter++;
  }
  const union = ta.size + tb.size - inter;
  return union > 0 && inter / union >= 0.82;
}

function macroSectionBucket(title: string, layer?: PlanningLayer): string {
  const t = title.toLowerCase();
  if (/^beginning/.test(t) || t === "beginning") return "macro:beginning";
  if (/^middle/.test(t)) return "macro:middle";
  if (/^end\b/.test(t)) return "macro:end";
  if (/synopsis/.test(t) || layer === "book_synopsis") return "meta:synopsis";
  if (/spin.?off|sequel/.test(t) || layer === "notes") return "meta:franchise";
  return `section:${synopsisFingerprint(title).slice(0, 40)}`;
}

/**
 * Collapse duplicate outline beats (same chapter, or same macro blurb on multiple tabs).
 */
export function compileOutlineBeats(beats: IngestPlotBeat[]): IngestPlotBeat[] {
  const chapterDeduped = dedupeBeats(beats);
  const kept: IngestPlotBeat[] = [];
  const macroSeen = new Map<string, IngestPlotBeat>();

  for (const beat of chapterDeduped) {
    const layer = beat.planning_layer ?? "unknown";

    if (beat.chapter_number != null) {
      kept.push(beat);
      continue;
    }

    if (layer === "book_synopsis" || layer === "notes" || layer === "front_matter") {
      const metaKey = `meta:${synopsisFingerprint(beat.title ?? "")}:${synopsisFingerprint(beat.synopsis).slice(0, 80)}`;
      const prior = [...macroSeen.values()].find((p) => areNearDuplicateTexts(p.synopsis, beat.synopsis));
      if (prior) continue;
      macroSeen.set(metaKey, beat);
      kept.push(beat);
      continue;
    }

    if (layer === "macro_outline") {
      const bucket = macroSectionBucket(beat.title ?? beat.tab_title ?? "", layer);
      const prior = macroSeen.get(bucket);
      if (prior && areNearDuplicateTexts(prior.synopsis, beat.synopsis)) {
        if (beat.synopsis.length > prior.synopsis.length) {
          macroSeen.set(bucket, beat);
          const idx = kept.indexOf(prior);
          if (idx >= 0) kept[idx] = beat;
        }
        continue;
      }
      const crossDup = [...macroSeen.values()].find((p) => areNearDuplicateTexts(p.synopsis, beat.synopsis));
      if (crossDup) continue;
      macroSeen.set(bucket, beat);
      kept.push(beat);
      continue;
    }

    const fp = synopsisFingerprint(beat.synopsis);
    const dup = kept.find((k) => areNearDuplicateTexts(k.synopsis, beat.synopsis));
    if (dup) continue;
    kept.push(beat);
  }

  return kept
    .sort((a, b) => {
      const ac = a.chapter_number ?? 9999;
      const bc = b.chapter_number ?? 9999;
      if (ac !== bc) return ac - bc;
      return a.order - b.order;
    })
    .map((b, order) => ({ ...b, order }));
}

export function compileProposedWiki(entries: ProposedWikiEntry[]): ProposedWikiEntry[] {
  const kept: ProposedWikiEntry[] = [];

  for (const entry of entries) {
    const titleKey = synopsisFingerprint(entry.title);
    const dup = kept.find(
      (k) =>
        (titleKey.length > 2 && synopsisFingerprint(k.title) === titleKey && areNearDuplicateTexts(k.excerpt, entry.excerpt)) ||
        areNearDuplicateTexts(k.excerpt, entry.excerpt)
    );
    if (dup) {
      if (entry.excerpt.length > dup.excerpt.length) {
        const idx = kept.indexOf(dup);
        kept[idx] = entry;
      }
      continue;
    }
    kept.push(entry);
  }

  return kept;
}

/** Drop tab bodies that repeat the same planning content (e.g. Beginning on 3 tabs). */
export function compileSourceText(text: string): string {
  const sections = splitTabSections(text);
  if (sections.length < 2) return text;

  const kept: typeof sections = [];

  for (const section of sections) {
    const body = section.body.trim();
    if (body.length < 8) continue;

    const dup = kept.find(
      (k) =>
        k.layer === section.layer &&
        (areNearDuplicateTexts(k.body, body) ||
          (section.layer === "macro_outline" &&
            macroSectionBucket(k.title, k.layer) === macroSectionBucket(section.title, section.layer) &&
            areNearDuplicateTexts(k.body, body)))
    );
    if (dup) continue;
    kept.push(section);
  }

  if (kept.length === 0) return text;

  return kept
    .map((s) => formatTabSectionHeader(s.title, s.path) + s.body)
    .join("\n")
    .trim();
}

export function compileDocumentIngest(params: {
  outlineBeats: IngestPlotBeat[];
  proposedWiki: ProposedWikiEntry[];
  sourceText?: string;
}): CompiledDocumentIngest {
  const beatsBefore = params.outlineBeats.length;
  const wikiBefore = params.proposedWiki.length;
  const sourceBefore = params.sourceText?.length ?? 0;

  const outline_beats = compileOutlineBeats(params.outlineBeats);
  const proposed_wiki = compileProposedWiki(params.proposedWiki);
  const source_text = params.sourceText ? compileSourceText(params.sourceText) : undefined;

  return {
    outline_beats,
    proposed_wiki,
    source_text,
    stats: {
      outline_beats_before: beatsBefore,
      outline_beats_after: outline_beats.length,
      wiki_entries_before: wikiBefore,
      wiki_entries_after: proposed_wiki.length,
      source_chars_before: sourceBefore || undefined,
      source_chars_after: source_text?.length,
    },
  };
}

/** Stable id for redis/cache keys — same manuscript + compiled payload → same digest. */
export function ingestPayloadDigest(parts: {
  manuscriptId: string;
  slot: string;
  outlineBeats: IngestPlotBeat[];
  proposedWiki: ProposedWikiEntry[];
}): string {
  const payload = JSON.stringify({
    m: parts.manuscriptId,
    s: parts.slot,
    b: parts.outlineBeats.map((b) => ({
      t: b.title,
      c: b.chapter_number,
      p: b.pov_mode,
      f: synopsisFingerprint(b.synopsis).slice(0, 120),
    })),
    w: parts.proposedWiki.map((w) => ({
      t: w.title,
      f: synopsisFingerprint(w.excerpt).slice(0, 120),
    })),
  });
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 24);
}
