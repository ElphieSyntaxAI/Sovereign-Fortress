import { drive } from "@googleapis/drive";
import type { OAuth2Client } from "google-auth-library";

import { cleanGoogleDocExport, normalizeGoogleDocId } from "./fetchManuscript.js";
import { normalizeGoogleDocUrl } from "./googleDocUrl.js";

export type GoogleDocFileMeta = {
  id: string;
  name: string;
  modifiedTime: string | null;
  webViewLink: string | null;
};

export async function fetchGoogleDocPlainTextOAuth(
  auth: OAuth2Client,
  googleDocId: string
): Promise<string> {
  const id = normalizeGoogleDocId(googleDocId);
  const d = drive({ version: "v3", auth });
  const res = await d.files.export(
    { fileId: id, mimeType: "text/plain" },
    { responseType: "text" }
  );
  const raw = typeof res.data === "string" ? res.data : String(res.data ?? "");
  return cleanGoogleDocExport(raw);
}

export async function fetchGoogleDocMetaOAuth(
  auth: OAuth2Client,
  googleDocId: string
): Promise<GoogleDocFileMeta> {
  const id = normalizeGoogleDocId(googleDocId);
  const d = drive({ version: "v3", auth });
  const { data } = await d.files.get({
    fileId: id,
    fields: "id, name, modifiedTime, webViewLink",
    supportsAllDrives: true,
  });
  if (!data?.id) throw new Error("Google Doc not found");
  return {
    id: String(data.id),
    name: data.name ? String(data.name) : "Google Doc",
    modifiedTime: data.modifiedTime ? String(data.modifiedTime) : null,
    webViewLink: data.webViewLink ? String(data.webViewLink) : null,
  };
}

export async function listRecentGoogleDocsOAuth(
  auth: OAuth2Client,
  opts?: { query?: string; pageSize?: number }
): Promise<GoogleDocFileMeta[]> {
  const d = drive({ version: "v3", auth });
  let q = "mimeType='application/vnd.google-apps.document' and trashed=false";
  const search = opts?.query?.trim();
  if (search) {
    const escaped = search.replace(/'/g, "\\'");
    q += ` and name contains '${escaped}'`;
  }
  const { data } = await d.files.list({
    pageSize: Math.min(30, Math.max(1, opts?.pageSize ?? 20)),
    orderBy: "modifiedTime desc",
    q,
    fields: "files(id, name, modifiedTime, webViewLink)",
  });
  return (data.files ?? []).map((f) => ({
    id: String(f.id ?? ""),
    name: f.name ? String(f.name) : "Untitled",
    modifiedTime: f.modifiedTime ? String(f.modifiedTime) : null,
    webViewLink: f.webViewLink ? String(f.webViewLink) : null,
  }));
}

export function docUrlFromMeta(meta: GoogleDocFileMeta): string {
  if (meta.webViewLink) return normalizeGoogleDocUrl(meta.webViewLink);
  return normalizeGoogleDocUrl(`https://docs.google.com/document/d/${meta.id}/edit`);
}
