import { formatTabSectionHeader, splitTabSections } from "./documentPlanningTaxonomy.js";
import { MAX_LLM_DOCUMENT_CHARS } from "./documentIngestLimits.js";

export type ConvergeTextChunk = {
  index: number;
  total: number;
  text: string;
};

/** Split long manuscripts into CONVERGE-sized windows (prefer tab boundaries). */
export function splitDocumentForConverge(text: string): ConvergeTextChunk[] {
  if (text.length <= MAX_LLM_DOCUMENT_CHARS) {
    return [{ index: 0, total: 1, text }];
  }

  const tabs = splitTabSections(text);
  if (tabs.length > 1) {
    const chunks: string[] = [];
    let buf = "";

    const flush = () => {
      const trimmed = buf.trim();
      if (trimmed.length > 0) chunks.push(trimmed);
      buf = "";
    };

    for (const tab of tabs) {
      const block = formatTabSectionHeader(tab.title, tab.path) + tab.body.trim();
      if (block.length > MAX_LLM_DOCUMENT_CHARS) {
        flush();
        for (const part of splitByParagraphLimit(block, MAX_LLM_DOCUMENT_CHARS)) {
          chunks.push(part);
        }
        continue;
      }
      if (buf.length + block.length > MAX_LLM_DOCUMENT_CHARS && buf.length > 0) {
        flush();
        buf = block;
      } else {
        buf = buf ? `${buf}\n\n${block}` : block;
      }
    }
    flush();

    if (chunks.length > 0) {
      return chunks.map((t, index) => ({ index, total: chunks.length, text: t }));
    }
  }

  const parts = splitByParagraphLimit(text, MAX_LLM_DOCUMENT_CHARS);
  return parts.map((t, index) => ({ index, total: parts.length, text: t }));
}

function splitByParagraphLimit(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];

  const paras = text.split(/\n\s*\n+/);
  const out: string[] = [];
  let buf = "";

  const flush = () => {
    const trimmed = buf.trim();
    if (trimmed.length > 0) out.push(trimmed);
    buf = "";
  };

  for (const para of paras) {
    const block = para.trim();
    if (!block) continue;
    if (block.length > limit) {
      flush();
      for (let i = 0; i < block.length; i += limit) {
        out.push(block.slice(i, i + limit));
      }
      continue;
    }
    if (buf.length + block.length + 2 > limit && buf.length > 0) {
      flush();
      buf = block;
    } else {
      buf = buf ? `${buf}\n\n${block}` : block;
    }
  }
  flush();

  return out.length > 0 ? out : [text.slice(0, limit)];
}
