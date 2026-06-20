export const WIKI_EXCERPT_MIME = "application/x-elphie-wiki-excerpt";

export function normalizeWikiExcerpt(text: string, max = 1200): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

export function guessTitleFromExcerpt(excerpt: string): string {
  const t = normalizeWikiExcerpt(excerpt, 400);
  const name = t.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?\b/);
  if (name?.[0]) return name[0].slice(0, 80);
  const words = t.split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
  return words.slice(0, 80) || "New lore";
}

export function readExcerptFromDataTransfer(dt: DataTransfer | null): string {
  if (!dt) return "";
  const custom = dt.getData(WIKI_EXCERPT_MIME);
  if (custom.trim()) return normalizeWikiExcerpt(custom);
  const plain = dt.getData("text/plain");
  return normalizeWikiExcerpt(plain);
}

export function formAnswersForAssignKind(
  kind: "character" | "setting" | "environment",
  excerpt: string
): Record<string, string> {
  const text = normalizeWikiExcerpt(excerpt);
  if (kind === "character") {
    return { who: text, freeform: text };
  }
  if (kind === "setting") {
    return { scene_now: text, freeform: text };
  }
  return { exterior_force: text, climate: text, freeform: text };
}
