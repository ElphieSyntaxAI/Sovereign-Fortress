import * as vscode from "vscode";

import { readMsgfSettings, resolveTenantId } from "./config";
import { buildApiAuthHeaders } from "./pulseAuth";

const MAX_FILES = 12;
const MAX_BYTES_PER_FILE = 48_000;

export type ShadowScanResult =
  | { ok: true; message: string; detail?: Record<string, unknown> }
  | { ok: false; message: string; ruleErrors: string[] };

type IngestFile = { path: string; content: string };

async function collectWorkspaceScanFiles(): Promise<IngestFile[]> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return [];

  const exclude = "{**/node_modules/**,**/.git/**,**/out/**,**/dist/**}";
  const uris = await vscode.workspace.findFiles(
    new vscode.RelativePattern(folder, "**/*.{ts,tsx,js,jsx,md,json}"),
    exclude,
    MAX_FILES
  );

  const files: IngestFile[] = [];
  for (const uri of uris) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const content = doc.getText().slice(0, MAX_BYTES_PER_FILE);
      const path = vscode.workspace.asRelativePath(uri, false);
      files.push({ path, content });
    } catch {
      /* skip unreadable */
    }
  }

  const active = vscode.window.activeTextEditor?.document;
  if (active && !active.isUntitled) {
    const path = vscode.workspace.asRelativePath(active.uri, false);
    if (!files.some((f) => f.path === path)) {
      files.unshift({
        path,
        content: active.getText().slice(0, MAX_BYTES_PER_FILE),
      });
    }
  }

  return files.slice(0, MAX_FILES);
}

function parseRuleAlignment(raw: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (typeof raw.error === "string" && raw.error.trim()) {
    errors.push(raw.error.trim());
  }

  const violations = raw.violations;
  if (Array.isArray(violations)) {
    for (const v of violations) {
      if (typeof v === "string") errors.push(v);
    }
  }

  const missing = raw.missing_pillars;
  if (Array.isArray(missing) && missing.length > 0) {
    errors.push(`Missing governance pillars: ${missing.map(String).join(", ")}`);
  }

  if (raw.baseline_training_required === true) {
    errors.push("Baseline training required before shadow policy alignment.");
  }

  if (raw.brain_fully_initialized === false) {
    errors.push("Tenant brain is not fully initialized.");
  }

  return errors;
}

/**
 * Live shadow policy validation via Cloud Run ingest (pillar bootstrap + workspace sweep).
 */
export async function runShadowPolicyScan(
  fetchImpl: typeof fetch = fetch.bind(globalThis)
): Promise<ShadowScanResult> {
  const settings = readMsgfSettings();
  const tenantId = resolveTenantId(settings);
  const baseUrl = settings.apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/msgf/ingest`;

  const headers = buildApiAuthHeaders({ settings, tenantId });
  if (!headers.Authorization) {
    return {
      ok: false,
      message: "Configure msgf.authToken before running a shadow scan.",
      ruleErrors: ["Missing Authorization bearer token."],
    };
  }

  const folder = vscode.workspace.workspaceFolders?.[0];
  const projectOrigin = folder?.name ?? tenantId;
  const files = await collectWorkspaceScanFiles();

  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        project_origin: projectOrigin,
        files,
      }),
    });

    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const ruleErrors = parseRuleAlignment(raw);

    if (!res.ok) {
      return {
        ok: false,
        message:
          typeof raw.error === "string"
            ? raw.error
            : `Shadow scan failed (HTTP ${res.status}).`,
        ruleErrors: ruleErrors.length ? ruleErrors : [`HTTP ${res.status}`],
      };
    }

    if (ruleErrors.length > 0) {
      return {
        ok: false,
        message: "Shadow policy scan completed with rule alignment issues.",
        ruleErrors,
      };
    }

    const msg =
      typeof raw.message === "string"
        ? raw.message
        : "Shadow policy scan completed — all pillars aligned.";

    return {
      ok: true,
      message: msg,
      detail: {
        ingested_count: raw.ingested_count,
        readiness_score: raw.readiness_score,
        brain_fully_initialized: raw.brain_fully_initialized,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Shadow scan network error";
    return {
      ok: false,
      message,
      ruleErrors: [message],
    };
  }
}
