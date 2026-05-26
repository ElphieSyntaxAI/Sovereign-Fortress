/**
 * Author-specific planning layouts: tab titles and headings map to semantic layers.
 */

export type PlanningLayer =
  | "front_matter"
  | "book_synopsis"
  | "macro_outline"
  | "chapter_breakdown"
  | "scene_grid"
  | "character_bible"
  | "world_bible"
  | "notes"
  | "unknown";

export type PlanningSection = {
  title: string;
  layer: PlanningLayer;
  body: string;
  path?: string;
};

export function formatTabSectionHeader(title: string, path?: string): string {
  const label = path?.trim() ? `${path.trim()} › ${title.trim()}` : title.trim();
  return `\n\n--- TAB: ${label} ---\n\n`;
}

export function splitTabSections(text: string): PlanningSection[] {
  const normalized = text.replace(/^\s*---\s*TAB:\s*/i, "\n--- TAB: ");
  const parts = normalized.split(/\n---\s*TAB:\s*/i);
  if (parts.length <= 1 && !/---\s*TAB:/i.test(normalized)) return [];

  const sections: PlanningSection[] = [];
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i]!;
    const nl = chunk.indexOf("\n");
    const titleLine = (nl >= 0 ? chunk.slice(0, nl) : chunk).replace(/---\s*$/i, "").trim();
    const body = (nl >= 0 ? chunk.slice(nl + 1) : "").trim();
    if (!titleLine || body.length < 4) continue;
    const pathParts = titleLine.split("›").map((s) => s.trim());
    const title = pathParts[pathParts.length - 1] ?? titleLine;
    const path = pathParts.length > 1 ? pathParts.slice(0, -1).join(" › ") : undefined;
    sections.push({
      title,
      path,
      layer: classifyPlanningLayer(titleLine),
      body,
    });
  }
  return sections;
}

export function classifyPlanningLayer(titleOrHeading: string): PlanningLayer {
  const t = titleOrHeading.toLowerCase().replace(/\s+/g, " ");

  if (/\b(prologue|epigraph|preface|foreword|dedication|acknowledgments?)\b/.test(t)) {
    return "front_matter";
  }
  if (/\b(book synopsis|back cover blurb)\b/.test(t)) {
    return "book_synopsis";
  }
  if (
    /\b(spin[- ]?off|sequel book ideas|sequel ideas|gods games|franchise ideas|future books)\b/.test(t)
  ) {
    return "notes";
  }
  if (/\b(hints at sequal|hints at sequel|cliffhanger|epilogue hook)\b/.test(t)) {
    return "notes";
  }
  if (
    /\b(beginning outline|general outline|master outline|story outline|act structure|three act|beat sheet|plot overview)\b/.test(
      t
    ) ||
    (/\boutline\b/.test(t) && !/\bchapter\b/.test(t) && !/\bscene\b/.test(t))
  ) {
    return "macro_outline";
  }
  if (/^chapter\s*\d+\b/.test(t)) {
    if (/\b(spin[- ]?off|sequel|book ideas)\b/.test(t)) return "notes";
    return "chapter_breakdown";
  }
  if (
    /\b(chapter breakdown|chapter outline|chapter by chapter|per chapter|chapters?\s*\d|chapter list)\b/.test(
      t
    ) ||
    (/\bchapter\b/.test(t) && /\b(breakdown|outline|beat)\b/.test(t))
  ) {
    return "chapter_breakdown";
  }
  if (
    /\b(scene|scenes|scene card|scene list|scene grid|beat grid|sequence)\b/.test(t) ||
    /\bint\.|ext\./.test(t)
  ) {
    return "scene_grid";
  }
  if (/\b(character|cast|character sheet|profiles?|dramatis)\b/.test(t)) {
    return "character_bible";
  }
  if (/\b(world bible|worldbuilding|lore|setting bible|magic system|rules)\b/.test(t)) {
    return "world_bible";
  }
  if (/\b(notes|brainstorm|scratch|ideas|research)\b/.test(t)) {
    return "notes";
  }
  return "unknown";
}

export function wikiKindForPlanningLayer(layer: PlanningLayer): string {
  switch (layer) {
    case "front_matter":
      return "note";
    case "book_synopsis":
      return "plot_point";
    case "macro_outline":
      return "plot_point";
    case "chapter_breakdown":
      return "chapter";
    case "scene_grid":
      return "plot_point";
    case "character_bible":
      return "character";
    case "world_bible":
      return "environment";
    case "notes":
      return "note";
    default:
      return "plot_point";
  }
}

export function beatPriorityForLayer(layer: PlanningLayer): number {
  switch (layer) {
    case "scene_grid":
      return 100;
    case "chapter_breakdown":
      return 90;
    case "macro_outline":
      return 70;
    case "book_synopsis":
      return 60;
    case "front_matter":
      return 50;
    case "character_bible":
      return 40;
    case "world_bible":
      return 40;
    case "notes":
      return 20;
    default:
      return 30;
  }
}
