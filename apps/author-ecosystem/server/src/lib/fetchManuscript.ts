/**
 * Pull a Google Doc (native) as plain text using the **same service-account file** as Vertex
 * (`GOOGLE_APPLICATION_CREDENTIALS`), push a snapshot into the MSGF `/api/msgf/ingest` pipeline,
 * and update `p4_manuscripts.body_text` so BFF routes (editor POEE anchors, manuscript reads) align
 * with Drive. HAL **struggle-map** still depends on `p4_hal_ledger` rows whose `raw_sample` references
 * this manuscript id; this utility does not synthesize HAL telemetry.
 *
 * **Access:** Share the Doc with the service account’s `client_email` (Viewer is enough for export).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { drive } from "@googleapis/drive";
import { GoogleAuth } from "google-auth-library";

import { loadMonorepoRootEnv } from "./database/loadRootEnv.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { structureDocumentText } from "./documentTextStructure.js";
import { IngestionService, parseManuscriptToText } from "./narrative/IngestionService.js";

const DRIVE_READONLY = "https://www.googleapis.com/auth/drive.readonly";

export type MsgfIngestFile = { path: string; content: string };

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

/** Accept raw id or full `https://docs.google.com/document/d/<id>/edit` URL. */
export function normalizeGoogleDocId(raw: string): string {
  const s = raw.trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m?.[1]) return m[1];
  return s;
}

/** Reuse Vertex ADC: JSON key path used by `@google-cloud/*` and Drive. */
export function getVertexAlignedGoogleAuth(): GoogleAuth {
  const keyFile = requireEnv("GOOGLE_APPLICATION_CREDENTIALS");
  return new GoogleAuth({
    keyFile,
    scopes: [DRIVE_READONLY],
  });
}

/** Normalize Drive export — preserve tables/tabs (do not collapse via plain-text whitespace pass). */
export async function cleanGoogleDocExport(raw: string): Promise<string> {
  return structureDocumentText(raw);
}

/**
 * Export a native Google Doc to UTF-8 plain text via Drive `files.export`.
 * @param googleDocId Drive file id (from `MY_BOOK_ID` or URL `.../d/<id>/edit`)
 */
export async function fetchGoogleDocPlainText(googleDocId: string): Promise<string> {
  const id = normalizeGoogleDocId(googleDocId);
  const auth = getVertexAlignedGoogleAuth();
  const d = drive({ version: "v3", auth });
  const res = await d.files.export(
    { fileId: id, mimeType: "text/plain" },
    { responseType: "text" }
  );
  const raw = typeof res.data === "string" ? res.data : String(res.data ?? "");
  return cleanGoogleDocExport(raw);
}

/** Optional Drive metadata (title) for `p4_manuscripts.title`. */
export async function fetchGoogleDocTitle(googleDocId: string): Promise<string | null> {
  const id = normalizeGoogleDocId(googleDocId);
  const auth = getVertexAlignedGoogleAuth();
  const d = drive({ version: "v3", auth });
  const { data } = await d.files.get({
    fileId: id,
    fields: "name,mimeType",
    supportsAllDrives: true,
  });
  if (!data?.name) return null;
  return String(data.name);
}

/**
 * POST `files[]` to the MSGF Next ingest route (`sweepAndIngest` + audit).
 * @see `packages/msgf/app/api/msgf/ingest/route.ts`
 */
export async function pipeToMsgfIngestService(files: MsgfIngestFile[], tenantId?: string): Promise<unknown> {
  const base = (process.env.MSGF_APP_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
  const url = `${base}/api/msgf/ingest`;
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const apiKey = process.env.MSGF_INGEST_API_KEY?.trim();
  if (apiKey) headers["x-msgf-api-key"] = apiKey;
  const body: Record<string, unknown> = { files };
  const tid = tenantId?.trim() || process.env.MSGF_INGEST_TENANT_ID?.trim();
  if (tid) body.tenant_id = tid;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof json === "object" && json && "error" in json ? JSON.stringify((json as { error: unknown }).error) : JSON.stringify(json);
    throw new Error(`MSGF ingest failed (${res.status}) ${url}: ${detail}`);
  }
  return json;
}

export type SyncGoogleManuscriptResult = {
  google_doc_id: string;
  manuscript_id: string;
  characters: number;
  msgf_ingest: unknown;
  p4_manuscripts: { id: string };
  plot_reindex?: { chunksTotal: number; chunksInserted: number };
};

/**
 * End-to-end: Drive export → MSGF ingest → `p4_manuscripts.body_text` (+ optional title + plot vectors).
 *
 * **Env**
 * - `GOOGLE_APPLICATION_CREDENTIALS` — service account JSON (Vertex / GCP)
 * - `MY_BOOK_ID` — Google Doc file id
 * - `P4_MANUSCRIPT_ID` — existing `p4_manuscripts.id` to update
 * - `MSGF_APP_URL` — MSGF Next origin (default `http://127.0.0.1:3001`)
 * - `MSGF_INGEST_API_KEY` / `MSGF_INGEST_TENANT_ID` — when MSGF tenant API keys are enabled
 * - `SYNC_P4_PLOT_VECTORS=true` — also run {@link IngestionService.ingestManuscript} (`plot` lane) for RAG; needs embeddings env
 */
export async function fetchManuscriptSyncFromEnv(): Promise<SyncGoogleManuscriptResult> {
  loadMonorepoRootEnv();
  const googleDocId = normalizeGoogleDocId(requireEnv("MY_BOOK_ID"));
  const manuscriptId = requireEnv("P4_MANUSCRIPT_ID");

  const plain = await fetchGoogleDocPlainText(googleDocId);
  const supabase = getSupabaseAdmin();

  const { data: ms, error: msErr } = await supabase
    .from("p4_manuscripts")
    .select("id, tenant_id, title")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (msErr) throw new Error(`p4_manuscripts read: ${msErr.message}`);
  if (!ms) throw new Error(`p4_manuscripts: no row for id ${manuscriptId}`);
  const tenantId = String((ms as { tenant_id: string }).tenant_id);

  const relPath = `manuscripts/gdoc-${googleDocId}.txt`;
  const msgf_ingest = await pipeToMsgfIngestService([{ path: relPath, content: plain }], tenantId);

  const titleFromDrive =
    process.env.MY_BOOK_TITLE?.trim() ||
    (process.env.SYNC_TITLE_FROM_DRIVE === "true" ? (await fetchGoogleDocTitle(googleDocId)) : null);

  const patch: Record<string, unknown> = {
    body_text: plain,
    updated_at: new Date().toISOString(),
  };
  if (titleFromDrive) patch.title = titleFromDrive;

  const { data: updated, error: upErr } = await supabase
    .from("p4_manuscripts")
    .update(patch)
    .eq("id", manuscriptId)
    .select("id")
    .maybeSingle();

  if (upErr) throw new Error(`p4_manuscripts update: ${upErr.message}`);
  if (!updated) throw new Error(`p4_manuscripts: update affected no rows for id ${manuscriptId}`);

  let plot_reindex: SyncGoogleManuscriptResult["plot_reindex"];
  if (process.env.SYNC_P4_PLOT_VECTORS === "true") {
    const ingestion = new IngestionService(supabase);
    plot_reindex = await ingestion.ingestManuscript({
      tenantId,
      sourceDocument: `google_drive/${manuscriptId}`,
      chunkType: "plot",
      buffer: Buffer.from(plain, "utf8"),
      filename: "google-doc.txt",
      metadata: {
        manuscript_id: manuscriptId,
        google_doc_id: googleDocId,
        source: "fetchManuscript.ts",
      },
    });
  }

  return {
    google_doc_id: googleDocId,
    manuscript_id: manuscriptId,
    characters: plain.length,
    msgf_ingest,
    p4_manuscripts: { id: String((updated as { id: string }).id) },
    plot_reindex,
  };
}

async function runCli(): Promise<void> {
  try {
    const out = await fetchManuscriptSyncFromEnv();
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

const isMain =
  typeof process.argv[1] === "string" &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMain) {
  void runCli();
}
