import { extractGoogleDocId, normalizeGoogleDocUrl } from "./googleDocUrl.js";

export type ReportedGoogleDoc = {
  google_doc_id: string;
  google_doc_url: string;
  google_doc_title: string;
};

export function parseGoogleDocRefs(input: {
  google_doc_url?: string;
  google_doc_id?: string;
  google_doc_title?: string;
}): ReportedGoogleDoc | null {
  const url = String(input.google_doc_url ?? "").trim();
  const docId =
    String(input.google_doc_id ?? "").trim() || (url ? extractGoogleDocId(url) : "");
  if (!docId) return null;
  return {
    google_doc_id: docId,
    google_doc_url: url ? normalizeGoogleDocUrl(url) : normalizeGoogleDocUrl(`https://docs.google.com/document/d/${docId}/edit`),
    google_doc_title: String(input.google_doc_title ?? "").trim() || "Google Doc",
  };
}

export function mergeReportedDocs(
  existing: unknown,
  incoming: ReportedGoogleDoc[],
  primaryDocId?: string
): { docs: ReportedGoogleDoc[]; primary: ReportedGoogleDoc } {
  const byId = new Map<string, ReportedGoogleDoc>();
  for (const row of Array.isArray(existing) ? existing : []) {
    const parsed = parseGoogleDocRefs(row as ReportedGoogleDoc);
    if (parsed) byId.set(parsed.google_doc_id, parsed);
  }
  for (const doc of incoming) {
    byId.set(doc.google_doc_id, doc);
  }
  const docs = [...byId.values()];
  if (docs.length === 0) {
    throw new Error("At least one Google Doc is required");
  }
  const primary =
    (primaryDocId && byId.get(primaryDocId)) ||
    docs[docs.length - 1]!;
  return { docs, primary };
}

export function parseDocsFromBody(body: Record<string, unknown>): ReportedGoogleDoc[] {
  const raw = body.docs;
  if (Array.isArray(raw) && raw.length > 0) {
    const out: ReportedGoogleDoc[] = [];
    for (const item of raw) {
      const parsed = parseGoogleDocRefs((item ?? {}) as Record<string, string>);
      if (parsed) out.push(parsed);
    }
    return out;
  }
  const single = parseGoogleDocRefs(body as Record<string, string>);
  return single ? [single] : [];
}
