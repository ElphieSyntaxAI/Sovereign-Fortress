/**
 * Preserve tables, tabs, and section breaks from Google Docs / uploads before ingest LLM.
 * Plain `normalizeWhitespace` collapses `\t` and ruins columnar layouts.
 */

function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtmlTags(fragment: string): string {
  return decodeBasicHtmlEntities(fragment.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function formatMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const colCount = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => {
    const copy = [...r];
    while (copy.length < colCount) copy.push("");
    return copy;
  };
  const escapeCell = (c: string) => c.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
  const lines = rows.map((r) => `| ${pad(r).map(escapeCell).join(" | ")} |`);
  if (rows.length >= 1) {
    lines.splice(1, 0, `| ${pad(rows[0]).map(() => "---").join(" | ")} |`);
  }
  return lines.join("\n");
}

function tableHtmlToMarkdown(tableHtml: string): string {
  const rows: string[][] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(tableHtml)) !== null) {
    const cells: string[] = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cell: RegExpExecArray | null;
    while ((cell = cellRe.exec(tr[1])) !== null) {
      const t = stripHtmlTags(cell[1]);
      if (t) cells.push(t);
    }
    if (cells.length) rows.push(cells);
  }
  return rows.length ? `\n${formatMarkdownTable(rows)}\n` : "";
}

/** Convert Google Docs HTML export into structured plain text with markdown tables. */
export function htmlGoogleDocToStructuredText(html: string): string {
  let s = String(html ?? "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<table[\s\S]*?<\/table>/gi, (block) => tableHtmlToMarkdown(block));
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/h[1-6]>/gi, "\n\n");
  s = s.replace(/<\/p>/gi, "\n\n");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<\/li>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  return structureDocumentText(decodeBasicHtmlEntities(s));
}

/** Split a line into tabular cells (tabs or 2+ aligned space columns). */
export function splitTabularLine(line: string): string[] | null {
  const trimmed = line.trimEnd();
  if (!trimmed) return null;

  if (trimmed.includes("\t")) {
    const parts = trimmed.split("\t").map((p) => p.trim());
    if (parts.filter(Boolean).length >= 2) return parts;
  }

  const pipeCells = trimmed.match(/^\|(.+)\|$/);
  if (pipeCells) {
    const cells = pipeCells[1]
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length >= 2) return cells;
  }

  const spaced = trimmed.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
  if (spaced.length >= 3 && spaced.every((p) => p.length < 80)) return spaced;

  return null;
}

/**
 * Normalize document text while keeping tables and section breaks intact.
 */
export function structureDocumentText(raw: string): string {
  let text = String(raw ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  text = text.replace(/\f/g, "\n\n--- SECTION ---\n\n");

  const lines = text.split("\n");
  const out: string[] = [];
  let tableRun: string[][] = [];

  const flushTable = () => {
    if (tableRun.length === 0) return;
    out.push(formatMarkdownTable(tableRun));
    tableRun = [];
  };

  for (const line of lines) {
    const cells = splitTabularLine(line);
    if (cells && cells.length >= 2) {
      if (cells.every((c) => /^-+$/.test(c))) continue;
      tableRun.push(cells);
      continue;
    }

    flushTable();
    const normalized = line.replace(/[^\S\n\t]{2,}/g, " ").trimEnd();
    if (normalized.trim()) out.push(normalized.trimEnd());
    else if (out.length && out[out.length - 1] !== "") out.push("");
  }
  flushTable();

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
