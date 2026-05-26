/**
 * Optional soft keyword hints for document ingest (MSGF CONVERGE).
 * Keywords never gate parsing — they only enrich the LLM context when matched in source text.
 */

export type DocumentIngestKeywordConfig = {
  /** Matched in source (case-insensitive) → included in CONVERGE prompt as soft hints. */
  hints: string[];
  /** Planning-layer vocabulary the model may use when evidence supports it. */
  planning_layers: string[];
};

const DEFAULT_HINTS = [
  "chapter",
  "scene",
  "synopsis",
  "outline",
  "beat sheet",
  "scene card",
  "character card",
  "world bible",
  "pov",
  "split pov",
  "prologue",
  "epigraph",
  "book synopsis",
  "logline",
  "macro outline",
  "chapter breakdown",
  "sequel",
  "spin-off",
  "franchise",
  "tab",
];

const DEFAULT_PLANNING_LAYERS = [
  "front_matter",
  "book_synopsis",
  "macro_outline",
  "chapter_breakdown",
  "scene_grid",
  "notes",
];

function parseJsonKeywords(raw: string): DocumentIngestKeywordConfig | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const hints = Array.isArray(j.hints) ? j.hints.map((h) => String(h).trim()).filter(Boolean) : [];
    const planning_layers = Array.isArray(j.planning_layers)
      ? j.planning_layers.map((p) => String(p).trim()).filter(Boolean)
      : [];
    if (!hints.length && !planning_layers.length) return null;
    return {
      hints: hints.length ? hints : DEFAULT_HINTS,
      planning_layers: planning_layers.length ? planning_layers : DEFAULT_PLANNING_LAYERS,
    };
  } catch {
    return null;
  }
}

/** Load optional keywords from `MSGF_DOCUMENT_INGEST_KEYWORDS` (JSON or comma-separated hints). */
export function loadDocumentIngestKeywords(): DocumentIngestKeywordConfig {
  const raw = process.env.MSGF_DOCUMENT_INGEST_KEYWORDS?.trim();
  if (!raw) {
    return { hints: DEFAULT_HINTS, planning_layers: DEFAULT_PLANNING_LAYERS };
  }
  if (raw.startsWith("{")) {
    const parsed = parseJsonKeywords(raw);
    if (parsed) return parsed;
  }
  const hints = raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (hints.length) {
    return { hints, planning_layers: DEFAULT_PLANNING_LAYERS };
  }
  return { hints: DEFAULT_HINTS, planning_layers: DEFAULT_PLANNING_LAYERS };
}

/** Hints that actually appear in the document (keeps prompt small and doc-specific). */
export function matchKeywordHintsInText(
  text: string,
  config: DocumentIngestKeywordConfig
): string[] {
  const lower = text.toLowerCase();
  return config.hints.filter((h) => {
    const needle = h.toLowerCase().trim();
    return needle.length >= 3 && lower.includes(needle);
  });
}

export function formatKeywordHintsForPrompt(
  matched: string[],
  config: DocumentIngestKeywordConfig
): string {
  const lines = [
    "Optional vocabulary (use only when the document supports it — not required):",
    `Planning layers: ${config.planning_layers.join(", ")}`,
  ];
  if (matched.length) {
    lines.push(`Matched in document: ${matched.join(", ")}`);
  } else {
    lines.push("No optional keyword hints matched; infer structure from content only.");
  }
  return lines.join("\n");
}
