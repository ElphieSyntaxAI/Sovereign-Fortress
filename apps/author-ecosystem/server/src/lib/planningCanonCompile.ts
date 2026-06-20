import type { ProposedWikiEntry } from "./documentIngestGate.js";
import {
  compileOutlineBeats,
  compileProposedWiki,
  type CompileIngestStats,
} from "./documentIngestCompile.js";
import type { IngestPlotBeat } from "./documentIngestOutline.js";

type PlotEngineToken = {
  id: string;
  label: string;
  source?: string;
  outlineEntityKind?: string;
};

export type PlotEngineSyncPayload = {
  templateId: string;
  plotPoints: Array<{
    id: string;
    title: string;
    order: number;
    scenes: Array<{ id: string; title: string; order: number }>;
  }>;
  globalRepos: Record<string, PlotEngineToken[]>;
};

type PlotBeatIn = { synopsis?: string; order?: number; title?: string };

const PANEL_TO_KIND: Record<string, string> = {
  character: "character",
  settings: "setting",
  environmental: "environment",
  senses: "note",
  theme: "theme",
  mood: "theme",
  spoilerLevel: "spoiler",
  breadcrumbs: "note",
};

const PANEL_TAGS: Record<string, string[]> = {
  senses: ["senses"],
  mood: ["mood", "tone"],
  settings: ["setting"],
  breadcrumbs: ["breadcrumb"],
};

function tokenExcerpt(label: string, panel: string, kind: string): string {
  const tagLine = PANEL_TAGS[panel]?.length ? ` Tags: ${PANEL_TAGS[panel]!.join(", ")}.` : "";
  return `${label} — ${kind} token from author plot engine (${panel} panel).${tagLine}`.slice(0, 600);
}

/** Map plot engine globalRepos into wiki-shaped entries for RAG convergence. */
export function compilePlotEngineToWikiEntries(plotEngine: PlotEngineSyncPayload): ProposedWikiEntry[] {
  const entries: ProposedWikiEntry[] = [];
  const repos = plotEngine.globalRepos ?? {};

  for (const [panel, tokens] of Object.entries(repos)) {
    if (!Array.isArray(tokens)) continue;
    for (const token of tokens) {
      const label = String(token.label ?? "").trim();
      if (!label) continue;
      const kind = String(token.outlineEntityKind ?? PANEL_TO_KIND[panel] ?? "note").trim();
      entries.push({
        title: label,
        excerpt: tokenExcerpt(label, panel, kind),
        chunk_type: kind === "character" ? "character" : kind === "plot_point" ? "plot" : "other",
        tags: PANEL_TAGS[panel] ?? [kind],
        wiki_metadata: {
          outline_entity_kind: kind,
          plot_engine_panel: panel,
          plot_engine_token_id: token.id,
          planning_session_sync: true,
        },
      });
    }
  }

  return entries;
}

export function compilePlanningCanon(params: {
  plotEngine?: PlotEngineSyncPayload | null;
  plotBeats?: PlotBeatIn[];
}): {
  wikiEntries: ProposedWikiEntry[];
  outlineBeats: IngestPlotBeat[];
  stats: CompileIngestStats;
} {
  const rawWiki: ProposedWikiEntry[] = [];
  if (params.plotEngine) {
    rawWiki.push(...compilePlotEngineToWikiEntries(params.plotEngine));
  }

  const wikiBefore = rawWiki.length;
  const wikiEntries = compileProposedWiki(rawWiki);

  const rawBeats: IngestPlotBeat[] = (params.plotBeats ?? [])
    .map((b, i) => ({
      synopsis: String(b.synopsis ?? b.title ?? "").trim(),
      order: typeof b.order === "number" ? b.order : i,
      title: b.title?.trim(),
    }))
    .filter((b) => b.synopsis.length > 0);

  const beatsBefore = rawBeats.length;
  const outlineBeats = compileOutlineBeats(rawBeats);

  return {
    wikiEntries,
    outlineBeats,
    stats: {
      outline_beats_before: beatsBefore,
      outline_beats_after: outlineBeats.length,
      wiki_entries_before: wikiBefore,
      wiki_entries_after: wikiEntries.length,
    },
  };
}
