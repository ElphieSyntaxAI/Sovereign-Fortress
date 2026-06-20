import type { IngestOutlineBeat, ProposedWikiEntry } from "./documentIngestGate.js";
import type {
  ClarifyingQuestion,
  ContentSignal,
  IngestConflict,
  StoryFingerprint,
} from "./documentIngestStructure.js";
import type { SemanticRegion } from "./narrative/semanticChunking.js";

export function parseJsonStripFences(text: string): unknown {
  let s = String(text || "").trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)```/im);
  if (m) s = m[1].trim();
  return JSON.parse(s) as unknown;
}

export function parseLlmConflicts(raw: unknown): IngestConflict[] {
  if (!Array.isArray(raw)) return [];
  const out: IngestConflict[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const c = row as Record<string, unknown>;
    const message = String(c.message ?? "").trim();
    if (!message) continue;
    const severity = String(c.severity ?? "warning") === "blocking" ? "blocking" : "warning";
    out.push({
      code: String(c.code ?? "llm_conflict").slice(0, 64),
      severity,
      message,
    });
  }
  return out;
}

export function parseLlmClarifying(raw: unknown): ClarifyingQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: ClarifyingQuestion[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const q = row as Record<string, unknown>;
    const question = String(q.question ?? "").trim();
    if (!question) continue;
    out.push({
      id: String(q.id ?? `cq${out.length + 1}`),
      code: String(q.code ?? "clarify"),
      question,
      hint: String(q.hint ?? "").trim() || undefined,
      required: q.required !== false,
      options: Array.isArray(q.options) ? q.options.map((o) => String(o)) : undefined,
    });
  }
  return out.slice(0, 6);
}

export function parseContentSignals(raw: unknown): ContentSignal[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set([
    "scene_cards",
    "chapter_breakdown",
    "character_cards",
    "world_lore",
    "notes_brainstorm",
    "full_draft",
    "outline_list",
    "mixed",
  ]);
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const row = r as Record<string, unknown>;
      const kind = String(row.kind ?? "mixed");
      return {
        kind: (allowed.has(kind) ? kind : "mixed") as ContentSignal["kind"],
        confidence:
          String(row.confidence ?? "medium") === "high"
            ? "high"
            : String(row.confidence) === "low"
              ? "low"
              : "medium",
        evidence: String(row.evidence ?? "").slice(0, 200),
      } as ContentSignal;
    })
    .slice(0, 8);
}

export function parseSemanticRegions(raw: unknown): SemanticRegion[] {
  if (!Array.isArray(raw)) return [];
  const out: SemanticRegion[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const domain = String(r.domain ?? "").trim();
    const anchor_excerpt = String(r.anchor_excerpt ?? "").trim();
    if (anchor_excerpt.length < 40) continue;
    out.push({
      domain: domain || "topic",
      anchor_excerpt,
      char_hint: r.char_hint != null ? Number(r.char_hint) : undefined,
    });
  }
  return out.slice(0, 24);
}

export function parseFingerprint(raw: unknown, fallback: StoryFingerprint): StoryFingerprint {
  if (!raw || typeof raw !== "object") return fallback;
  const f = raw as Record<string, unknown>;
  return {
    working_title:
      f.working_title != null ? String(f.working_title).slice(0, 120) : fallback.working_title,
    protagonist_names: Array.isArray(f.protagonist_names)
      ? f.protagonist_names.map((n) => String(n)).filter(Boolean).slice(0, 8)
      : fallback.protagonist_names,
    setting_anchors: Array.isArray(f.setting_anchors)
      ? f.setting_anchors.map((n) => String(n)).filter(Boolean).slice(0, 8)
      : fallback.setting_anchors,
    tone_or_genre:
      f.tone_or_genre != null ? String(f.tone_or_genre).slice(0, 80) : fallback.tone_or_genre,
  };
}

export function parseLlmWikiAndBeats(parsed: Record<string, unknown>): {
  proposed: ProposedWikiEntry[];
  outline_beats: IngestOutlineBeat[];
} {
  const proposed: ProposedWikiEntry[] = [];
  const wikiRaw = parsed.proposed_wiki;
  if (Array.isArray(wikiRaw)) {
    for (const row of wikiRaw) {
      if (!row || typeof row !== "object") continue;
      const w = row as Record<string, unknown>;
      const title = String(w.title ?? "").trim();
      const excerpt = String(w.excerpt ?? "").trim();
      if (title.length < 2 || excerpt.length < 40) continue;
      const kind = String(w.outline_entity_kind ?? "plot_point").trim();
      const planning_layer = w.planning_layer != null ? String(w.planning_layer) : undefined;
      const semantic_domain = w.semantic_domain != null ? String(w.semantic_domain).trim() : undefined;
      proposed.push({
        title,
        excerpt,
        chunk_type: String(w.chunk_type ?? "other"),
        tags: Array.isArray(w.tags) ? w.tags.map((t) => String(t)) : ["file_import"],
        wiki_metadata: {
          outline_entity_kind: kind,
          ...(planning_layer ? { planning_layer } : {}),
          ...(semantic_domain ? { semantic_domain } : {}),
        },
        plot_point_order: w.plot_point_order != null ? Number(w.plot_point_order) : undefined,
      });
    }
  }

  const outline_beats: IngestOutlineBeat[] = [];
  const beatsRaw = parsed.outline_beats;
  if (Array.isArray(beatsRaw)) {
    for (const row of beatsRaw) {
      if (!row || typeof row !== "object") continue;
      const b = row as Record<string, unknown>;
      const synopsis = String(b.synopsis ?? "").trim();
      if (!synopsis) continue;
      outline_beats.push({
        synopsis,
        order: Number(b.order ?? outline_beats.length),
        plot_point_order: b.plot_point_order != null ? Number(b.plot_point_order) : undefined,
        title: b.title != null ? String(b.title) : undefined,
        chapter_number: b.chapter_number != null ? Number(b.chapter_number) : undefined,
      });
    }
  }

  return { proposed, outline_beats };
}
