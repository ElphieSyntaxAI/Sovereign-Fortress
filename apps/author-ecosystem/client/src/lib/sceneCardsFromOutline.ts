export type SceneCardModel = { id: string; label: string; beatText: string };

const MAX_CARDS = 24;

function firstLineLabel(text: string): string {
  const line = text.split(/\n/)[0]?.trim() ?? text;
  return line.length > 100 ? `${line.slice(0, 97)}…` : line;
}

/**
 * Derive scene cards primarily from `p4_manuscripts.outline` (paragraphs or lines).
 * Falls back to planning `outline` chunk excerpts when manuscript outline is empty.
 */
export function sceneCardsFromManuscriptOutline(
  manuscriptOutline: string | null | undefined,
  plotOutlineFallback: { excerpt: string }[]
): SceneCardModel[] {
  const o = manuscriptOutline?.trim();
  if (o) {
    const paragraphs = o
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length > 0) {
      return paragraphs.slice(0, MAX_CARDS).map((text, i) => ({
        id: `outline-${i}`,
        label: firstLineLabel(text),
        beatText: text,
      }));
    }
    const lines = o
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      return lines.slice(0, MAX_CARDS).map((text, i) => ({
        id: `outline-line-${i}`,
        label: text.length > 96 ? `${text.slice(0, 93)}…` : text,
        beatText: text,
      }));
    }
  }
  if (plotOutlineFallback.length > 0) {
    return plotOutlineFallback.slice(0, MAX_CARDS).map((r, i) => ({
      id: `plot-chunk-${i}`,
      label: `Outline beat ${i + 1}`,
      beatText: r.excerpt || "",
    }));
  }
  return [
    {
      id: "outline-0",
      label: "Scene 1",
      beatText:
        "No `p4_manuscripts.outline` text yet — add an outline on the manuscript, or ingest plot chunks into the narrative library.",
    },
  ];
}

export function buildWikiStateText(
  bible: Array<{ excerpt?: string; source_document?: string }>,
  wikiNotes: string,
  maxChars = 12_000
): string {
  const parts: string[] = [];
  for (const b of bible.slice(0, 48)) {
    const doc = String(b.source_document ?? "lore");
    const ex = String(b.excerpt ?? "").trim();
    if (ex) parts.push(`[${doc}] ${ex}`);
  }
  const wn = wikiNotes.trim();
  if (wn) parts.push(`[Author planning notes]\n${wn}`);
  return parts.join("\n\n").slice(0, maxChars);
}
