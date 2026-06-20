import type { OutlineLoreKind } from "./outlineLoreKinds";
import { OUTLINE_LORE_KINDS, getOutlineLoreKindConfig } from "./outlineLoreKinds";

export type WikiArticleSection = {
  id: string;
  title: string;
  body: string;
};

export type WikiChunkLike = {
  id: string;
  chunk_type: string;
  content: string;
  metadata: Record<string, unknown>;
  source_document?: string;
};

export function wikiChunkTitle(c: WikiChunkLike): string {
  const meta = c.metadata;
  const t = meta.proposed_chunk_title;
  if (typeof t === "string" && t.trim()) return t.trim();
  const m = c.content.match(/^##\s+(.+)$/m) || c.content.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim() || c.source_document || "Untitled";
}

export function wikiChunkKind(c: WikiChunkLike): OutlineLoreKind | "other" {
  const raw = String(c.metadata.outline_entity_kind ?? c.metadata.lore_extraction_chunk_type ?? "");
  if (!raw) return "other";
  try {
    getOutlineLoreKindConfig(raw as OutlineLoreKind);
    return raw as OutlineLoreKind;
  } catch {
    return "other";
  }
}

export function wikiChunkKindLabel(kind: OutlineLoreKind | "other"): string {
  if (kind === "other") return "Other lore";
  return getOutlineLoreKindConfig(kind).label;
}

/** Strip RAG header lines; return reader-facing markdown body. */
export function wikiDisplayBody(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let pastHeader = false;

  for (const line of lines) {
    const t = line.trim();
    if (!pastHeader) {
      if (t.startsWith("# ") || t.startsWith("## ")) {
        pastHeader = true;
        continue;
      }
      if (
        t.startsWith("**chunk_type:") ||
        t.startsWith("**tags:") ||
        t.startsWith("**RAG template:") ||
        t.startsWith("**Form tier:") ||
        t.startsWith("**Source type:") ||
        t.startsWith("**Plot point:") ||
        t.startsWith("**Spoiler level:") ||
        t.startsWith("**Genres:**")
      ) {
        continue;
      }
      if (t === "" && !pastHeader) continue;
    }
    if (t.startsWith("*[Field:") && t.endsWith("]*")) continue;
    out.push(line);
  }

  return out.join("\n").trim();
}

export function parseWikiArticleSections(content: string): WikiArticleSection[] {
  const body = wikiDisplayBody(content);
  if (!body) return [];

  const lines = body.split("\n");
  const sections: WikiArticleSection[] = [];
  let current: WikiArticleSection | null = null;
  let intro: string[] = [];

  const pushCurrent = () => {
    if (!current) return;
    current.body = current.body.trim();
    if (current.title || current.body) sections.push(current);
    current = null;
  };

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("### ")) {
      pushCurrent();
      const title = t.slice(4).trim();
      current = {
        id: slugify(title),
        title,
        body: "",
      };
      continue;
    }
    if (t.startsWith("## ")) {
      pushCurrent();
      const title = t.slice(3).trim();
      current = {
        id: slugify(title),
        title,
        body: "",
      };
      continue;
    }

    if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else {
      intro.push(line);
    }
  }
  pushCurrent();

  const introText = intro.join("\n").trim();
  if (introText) {
    sections.unshift({
      id: "overview",
      title: "Overview",
      body: introText,
    });
  }

  if (sections.length === 0 && body) {
    return [{ id: "overview", title: "Overview", body }];
  }

  return sections;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "section";
}

export type WikiNavSection = {
  kind: OutlineLoreKind | "other";
  label: string;
  articles: { id: string; title: string; chunk: WikiChunkLike }[];
};

export function groupWikiChunksBySection(chunks: WikiChunkLike[]): WikiNavSection[] {
  const byKind = new Map<OutlineLoreKind | "other", WikiChunkLike[]>();

  for (const c of chunks) {
    const kind = wikiChunkKind(c);
    const list = byKind.get(kind) ?? [];
    list.push(c);
    byKind.set(kind, list);
  }

  const sections: WikiNavSection[] = [];

  for (const cfg of OUTLINE_LORE_KINDS) {
    const list = byKind.get(cfg.kind);
    if (!list?.length) continue;
    sections.push({
      kind: cfg.kind,
      label: cfg.label,
      articles: list
        .map((chunk) => ({
          id: chunk.id,
          title: wikiChunkTitle(chunk),
          chunk,
        }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    });
    byKind.delete(cfg.kind);
  }

  const other = byKind.get("other");
  if (other?.length) {
    sections.push({
      kind: "other",
      label: "Other lore",
      articles: other
        .map((chunk) => ({
          id: chunk.id,
          title: wikiChunkTitle(chunk),
          chunk,
        }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    });
  }

  return sections;
}
