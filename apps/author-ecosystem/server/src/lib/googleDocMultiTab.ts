import { docs } from "@googleapis/docs";
import { drive } from "@googleapis/drive";
import type { OAuth2Client } from "google-auth-library";

import { MAX_GOOGLE_DOC_TABS } from "./documentIngestLimits.js";
import { formatTabSectionHeader } from "./documentPlanningTaxonomy.js";
import { htmlGoogleDocToStructuredText, structureDocumentText } from "./documentTextStructure.js";
import { normalizeGoogleDocId } from "./fetchManuscript.js";

export type GoogleDocTabRef = {
  tabId: string;
  title: string;
  /** Breadcrumb for nested tabs, e.g. "Part I › Chapter breakdown" */
  path: string;
  depth: number;
};

type DocsStructuralElement = {
  paragraph?: {
    elements?: Array<{ textRun?: { content?: string | null } | null } | null>;
  };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{ content?: DocsStructuralElement[] | null } | null>;
    } | null>;
  };
};

function isChapterTabTitle(title: string): boolean {
  return /^chapter\s*\d+\b/i.test(title.trim()) && !/\b(spin[- ]?off|sequel|book ideas)\b/i.test(title);
}

function collectTabRefsInto(
  tabs: Array<{
    tabProperties?: { tabId?: string | null; title?: string | null } | null;
    childTabs?: unknown[] | null;
  }> | null | undefined,
  parentPath: string,
  depth: number,
  out: GoogleDocTabRef[],
  seen: Set<string>,
  chapterOnly: boolean
): void {
  if (!tabs?.length || out.length >= MAX_GOOGLE_DOC_TABS) return;
  for (const tab of tabs) {
    if (out.length >= MAX_GOOGLE_DOC_TABS) break;
    const tabId = tab.tabProperties?.tabId;
    const title = String(tab.tabProperties?.title ?? "Untitled").trim() || "Untitled";
    if (!tabId) continue;
    const id = String(tabId);
    const path = parentPath ? `${parentPath} › ${title}` : title;
    const isChapter = isChapterTabTitle(title);
    if ((!chapterOnly || isChapter) && !seen.has(id)) {
      seen.add(id);
      out.push({ tabId: id, title, path, depth });
    }
    collectTabRefsInto(tab.childTabs as typeof tabs, path, depth + 1, out, seen, chapterOnly);
  }
}

function collectTabRefs(
  tabs: Array<{
    tabProperties?: { tabId?: string | null; title?: string | null } | null;
    childTabs?: unknown[] | null;
  }> | null | undefined,
  parentPath: string,
  depth: number,
  out: GoogleDocTabRef[]
): void {
  const seen = new Set<string>();
  collectTabRefsInto(tabs, parentPath, depth, out, seen, true);
  if (out.length < MAX_GOOGLE_DOC_TABS) {
    collectTabRefsInto(tabs, parentPath, depth, out, seen, false);
  }
}

export async function listGoogleDocTabs(
  auth: OAuth2Client,
  googleDocId: string
): Promise<GoogleDocTabRef[]> {
  const id = normalizeGoogleDocId(googleDocId);
  const api = docs({ version: "v1", auth });
  const { data } = await api.documents.get({
    documentId: id,
    includeTabsContent: true,
  });
  const refs: GoogleDocTabRef[] = [];
  collectTabRefs(data.tabs as Parameters<typeof collectTabRefs>[0], "", 0, refs);
  return refs;
}

function readStructuralElements(elements: DocsStructuralElement[] | null | undefined): string {
  if (!elements?.length) return "";
  let text = "";
  for (const element of elements) {
    if (element.paragraph?.elements) {
      for (const pe of element.paragraph.elements) {
        const c = pe?.textRun?.content;
        if (c) text += c;
      }
    } else if (element.table?.tableRows) {
      for (const row of element.table.tableRows) {
        const cells: string[] = [];
        for (const cell of row.tableCells ?? []) {
          cells.push(readStructuralElements(cell.content ?? []).replace(/\n+/g, " ").trim());
        }
        if (cells.some(Boolean)) text += `${cells.join("\t")}\n`;
      }
    }
  }
  return text;
}

function extractTextFromTabDocument(tab: {
  documentTab?: { body?: { content?: DocsStructuralElement[] | null } | null } | null;
}): string {
  return readStructuralElements(tab.documentTab?.body?.content ?? []);
}

/** Single API call: all tab bodies via Docs API (when includeTabsContent works). */
export async function fetchGoogleDocAllTabsViaDocsApi(
  auth: OAuth2Client,
  googleDocId: string
): Promise<{ text: string; tabCount: number } | null> {
  const id = normalizeGoogleDocId(googleDocId);
  const api = docs({ version: "v1", auth });
  const { data } = await api.documents.get({
    documentId: id,
    includeTabsContent: true,
  });

  const tabs = data.tabs as Array<{
    tabProperties?: { tabId?: string | null; title?: string | null } | null;
    documentTab?: { body?: { content?: DocsStructuralElement[] | null } | null } | null;
    childTabs?: unknown[] | null;
  }> | null | undefined;

  if (!tabs?.length) return null;

  const parts: string[] = [];

  function walk(
    tabList: typeof tabs,
    parentPath: string
  ): void {
    if (!tabList) return;
    for (const tab of tabList) {
      const title = String(tab.tabProperties?.title ?? "Untitled").trim() || "Untitled";
      const path = parentPath ? `${parentPath} › ${title}` : title;
      const body = extractTextFromTabDocument(tab).trim();
      if (body.length > 0) {
        parts.push(formatTabSectionHeader(title, parentPath || undefined) + structureDocumentText(body));
      }
      walk(tab.childTabs as typeof tabs, path);
    }
  }

  walk(tabs, "");

  if (parts.length === 0) return null;
  return { text: parts.join("\n").trim(), tabCount: parts.length };
}

async function exportTabHtml(
  auth: OAuth2Client,
  docId: string,
  tabId: string
): Promise<string> {
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("Google OAuth token missing");
  const url =
    `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export` +
    `?format=html&tab=${encodeURIComponent(tabId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Tab HTML export failed (${res.status})`);
  }
  return res.text();
}

/** Per-tab HTML export when Docs API tab tree is available but bulk content is not. */
export async function fetchGoogleDocAllTabsViaHtmlExport(
  auth: OAuth2Client,
  googleDocId: string,
  tabRefs: GoogleDocTabRef[]
): Promise<string> {
  const id = normalizeGoogleDocId(googleDocId);
  const parts: string[] = [];

  for (const ref of tabRefs.slice(0, MAX_GOOGLE_DOC_TABS)) {
    try {
      const html = await exportTabHtml(auth, id, ref.tabId);
      const structured = htmlGoogleDocToStructuredText(html);
      if (structured.trim().length < 4) continue;
      parts.push(formatTabSectionHeader(ref.path) + structured);
    } catch (e) {
      console.warn(`[googleDocMultiTab] tab "${ref.path}" export skipped:`, e);
    }
  }

  return parts.join("\n").trim();
}

/** Drive export fallback (first tab only). */
export async function fetchGoogleDocSingleExport(
  auth: OAuth2Client,
  googleDocId: string
): Promise<string> {
  const id = normalizeGoogleDocId(googleDocId);
  const d = drive({ version: "v3", auth });
  try {
    const htmlRes = await d.files.export(
      { fileId: id, mimeType: "text/html" },
      { responseType: "text" }
    );
    const html = typeof htmlRes.data === "string" ? htmlRes.data : String(htmlRes.data ?? "");
    if (html.trim()) return htmlGoogleDocToStructuredText(html);
  } catch {
    /* plain */
  }
  const res = await d.files.export(
    { fileId: id, mimeType: "text/plain" },
    { responseType: "text" }
  );
  const raw = typeof res.data === "string" ? res.data : String(res.data ?? "");
  return structureDocumentText(raw);
}

/**
 * Fetch **all** Google Doc tabs (not just the first). Without this, Drive export misses most scenes.
 */
export async function fetchGoogleDocFullDocumentOAuth(
  auth: OAuth2Client,
  googleDocId: string
): Promise<{ text: string; tabCount: number; method: string }> {
  try {
    const viaDocs = await fetchGoogleDocAllTabsViaDocsApi(auth, googleDocId);
    if (viaDocs && viaDocs.text.length > 0) {
      return { text: viaDocs.text, tabCount: viaDocs.tabCount, method: "docs_api_tabs" };
    }
  } catch (e) {
    console.warn("[googleDocMultiTab] docs_api_tabs failed, trying HTML per-tab", e);
  }

  try {
    const refs = await listGoogleDocTabs(auth, googleDocId);
    if (refs.length > 1) {
      const merged = await fetchGoogleDocAllTabsViaHtmlExport(auth, googleDocId, refs);
      if (merged.length > 0) {
        return { text: merged, tabCount: refs.length, method: "html_per_tab" };
      }
    }
    if (refs.length === 1) {
      const merged = await fetchGoogleDocAllTabsViaHtmlExport(auth, googleDocId, refs);
      if (merged.length > 0) {
        return { text: merged, tabCount: 1, method: "html_single_tab" };
      }
    }
  } catch (e) {
    console.warn("[googleDocMultiTab] html per-tab failed", e);
  }

  const single = await fetchGoogleDocSingleExport(auth, googleDocId);
  return { text: single, tabCount: 1, method: "drive_export_first_tab_only" };
}
