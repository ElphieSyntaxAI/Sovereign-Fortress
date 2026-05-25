import type { ProposedWikiEntry } from "./documentIngestGate.js";

export type IngestPlotBeat = {
  synopsis: string;
  order: number;
  plot_point_order?: number | null;
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
      plot_point: "not_applicable",
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
  slot: string
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

export function extractOutlineBeatsFromText(text: string): IngestPlotBeat[] {
  const beats: IngestPlotBeat[] = [];

  const sceneBlocks = text.split(SCENE_CARD_HEADER);
  if (sceneBlocks.length > 2) {
    let order = 0;
    for (const block of sceneBlocks) {
      const trimmed = block.trim();
      if (trimmed.length < 15) continue;
      const titleLine = trimmed.split(/\n/)[0]?.trim().slice(0, 200) ?? trimmed.slice(0, 200);
      beats.push({
        synopsis: `${titleLine}\n${trimmed.slice(0, 1800)}`.trim(),
        order: order++,
        plot_point_order: Math.min(9, order),
      });
    }
    if (beats.length >= 2) return beats.slice(0, 32);
  }

  const chapterBlocks = text.split(
    /(?=(?:^|\n)(?:chapter|scene|part)\s+\d+[^\n]*\n)/gim
  );
  if (chapterBlocks.length > 1) {
    let order = 0;
    for (const block of chapterBlocks) {
      const trimmed = block.trim();
      if (trimmed.length < 20) continue;
      const firstLine = trimmed.split(/\n/)[0]?.trim() ?? trimmed.slice(0, 120);
      beats.push({
        synopsis: trimmed.slice(0, 2000),
        order: order++,
        plot_point_order: Math.min(9, order),
      });
    }
    if (beats.length) return beats.slice(0, 32);
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 30);
  if (paragraphs.length >= 2) {
    return paragraphs.slice(0, 24).map((synopsis, order) => ({
      synopsis: synopsis.slice(0, 1500),
      order,
      plot_point_order: order < 9 ? order + 1 : null,
    }));
  }

  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /^(\d+[\.\):]|[\*\-]\s)/.test(l) && l.length > 10);
  return lines.slice(0, 24).map((line, order) => ({
    synopsis: line.replace(/^(\d+[\.\):]|[\*\-]\s+)/, "").trim().slice(0, 800),
    order,
    plot_point_order: order < 9 ? order + 1 : null,
  }));
}

export function buildManuscriptOutlineFromBeats(beats: IngestPlotBeat[]): string {
  const sorted = [...beats].sort((a, b) => a.order - b.order);
  return sorted
    .map((b, i) => {
      const head = b.synopsis.split(/\n/)[0]?.trim() ?? b.synopsis;
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
  return beats.slice(0, 16).map((b, i) => ({
    title: `Scene ${i + 1}`,
    excerpt: b.synopsis.slice(0, 1200),
    chunk_type: "event",
    tags: ["plot_point", "scene_card", "file_import"],
    wiki_metadata: {
      ...wikiMetaForEntityKind("plot_point", manuscriptId, slot),
      plot_point_order: b.plot_point_order ?? i + 1,
      scene_card: true,
    },
  }));
}

export function mergePlotBeats(
  fromLlm: IngestPlotBeat[] | undefined,
  fromText: IngestPlotBeat[]
): IngestPlotBeat[] {
  const llm = fromLlm ?? [];
  if (llm.length >= 2) return llm;
  return fromText;
}
