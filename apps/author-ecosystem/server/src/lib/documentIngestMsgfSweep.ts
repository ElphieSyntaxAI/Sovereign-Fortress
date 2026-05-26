import type { GenealogicalBugIndex } from "msgf/lib/schemas/vault-hall-metadata";

import type { DocumentIngestSlot, IngestOutlineBeat, ProposedWikiEntry } from "./documentIngestGate.js";
import { buildManuscriptOutlineFromBeats } from "./documentIngestOutline.js";
import type { MsgfIngestFile } from "./fetchManuscript.js";

const MAX_WIKI_SHARDS = 48;

/** Mirrors `PULSE_BUG_INDEX` author ingest entries — avoid static import of vault-hall-metadata in BFF tests. */
const AUTHOR_INGEST_BUG: Record<string, GenealogicalBugIndex> = {
  source: {
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_WIKI_SOURCE",
  },
  character: {
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_WIKI_CHARACTER",
  },
  setting: {
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_WIKI_SETTING",
  },
  plot: {
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_WIKI_PLOT_BEAT",
  },
  outline: {
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_WIKI_OUTLINE",
  },
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "entry";
}

function wikiBugIndex(entry: ProposedWikiEntry): GenealogicalBugIndex {
  const kind = String(entry.wiki_metadata?.outline_entity_kind ?? entry.chunk_type ?? "");
  if (kind === "character" || entry.chunk_type === "character") {
    return AUTHOR_INGEST_BUG.character;
  }
  if (kind === "setting" || kind === "environment" || entry.chunk_type === "location") {
    return AUTHOR_INGEST_BUG.setting;
  }
  return AUTHOR_INGEST_BUG.plot;
}

/**
 * SWEEP shards for MSGF `/api/msgf/ingest` — structured wiki + outline with 1.1.1 lineage per entity type.
 */
export function buildAuthorDocumentSweepFiles(params: {
  manuscriptId: string;
  slot: DocumentIngestSlot;
  sourceText: string;
  proposed: ProposedWikiEntry[];
  outlineBeats: IngestOutlineBeat[];
}): MsgfIngestFile[] {
  const base = `author-ingest/${params.manuscriptId}/${params.slot}`;
  const files: MsgfIngestFile[] = [];

  const sourceSlice = params.sourceText.slice(0, 100_000);
  if (sourceSlice.length >= 200) {
    files.push({
      path: `${base}/source.txt`,
      content: sourceSlice,
      bug_index: AUTHOR_INGEST_BUG.source,
    });
  }

  for (const entry of params.proposed.slice(0, MAX_WIKI_SHARDS)) {
    const title = entry.title.trim() || "wiki-entry";
    files.push({
      path: `${base}/wiki/${slugify(title)}.json`,
      content: JSON.stringify(
        {
          title: entry.title,
          excerpt: entry.excerpt,
          chunk_type: entry.chunk_type,
          tags: entry.tags,
          wiki_metadata: entry.wiki_metadata,
          plot_point_order: entry.plot_point_order,
        },
        null,
        0
      ),
      bug_index: wikiBugIndex(entry),
    });
  }

  const outlineText = buildManuscriptOutlineFromBeats(params.outlineBeats);
  if (outlineText.length >= 20) {
    files.push({
      path: `${base}/outline/beats.json`,
      content: JSON.stringify(
        {
          manuscript_id: params.manuscriptId,
          slot: params.slot,
          beat_count: params.outlineBeats.length,
          beats: params.outlineBeats,
          outline_text: outlineText,
        },
        null,
        0
      ),
      bug_index: AUTHOR_INGEST_BUG.outline,
    });
  }

  return files;
}
