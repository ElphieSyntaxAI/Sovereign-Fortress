import * as vscode from "vscode";

import { readMsgfSettings, resolveTenantId } from "./config";
import { buildApiAuthHeaders } from "./pulseAuth";
import { resolveMappedProjectOrigin } from "./projectOrigin";

const MAX_FILES = 12;
const MAX_BYTES_PER_FILE = 48_000;

export type ShadowScanResult =
  | { ok: true; message: string; detail?: Record<string, unknown> }
  | { ok: false; message: string; ruleErrors: string[] };

type IngestFile = { path: string; content: string };

function normalizeScanPath(p: string): string {
  return p.replace(/\\/g, "/");
}

function scopePathsToProduct(files: IngestFile[], productPath: string): IngestFile[] {
  const prefix = normalizeScanPath(productPath).replace(/\/$/, "") + "/";
  const scoped = files.filter((f) => {
    const rel = normalizeScanPath(f.path);
    return rel.startsWith(prefix) || rel === prefix.slice(0, -1);
  });
  return scoped.length > 0 ? scoped : files;
}

async function collectWorkspaceScanFiles(productPath: string): Promise<IngestFile[]> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return [];

  const exclude = "{**/node_modules/**,**/.git/**,**/out/**,**/dist/**,**/vendor/**,**/tmp/**,**/coverage/**}";
  const patterns = [
    "**/*.{ts,tsx,js,jsx,md,json}",
    "**/*.{rb,erb,rake}",
    "**/{Gemfile,Rakefile,config.ru}",
  ];

  const uriSet = new Map<string, vscode.Uri>();
  for (const glob of patterns) {
    const uris = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, glob),
      exclude,
      MAX_FILES
    );
    for (const uri of uris) {
      const rel = vscode.workspace.asRelativePath(uri, false);
      if (!uriSet.has(rel)) uriSet.set(rel, uri);
      if (uriSet.size >= MAX_FILES) break;
    }
    if (uriSet.size >= MAX_FILES) break;
  }

  const files: IngestFile[] = [];
  for (const [path, uri] of uriSet) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const content = doc.getText().slice(0, MAX_BYTES_PER_FILE);
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

  const capped = files.slice(0, MAX_FILES);
  const scoped = productPath.trim() ? scopePathsToProduct(capped, productPath) : capped;
  return scoped.slice(0, MAX_FILES);
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
    const hint = settings.productPath.trim()
      ? `Add msgf.authToken to ${settings.productPath}/.vscode/settings.json or the repo root .vscode/settings.json, then reload the window.`
      : "Add msgf.authToken to .vscode/settings.json (mint at Workspace → IDE setup), then reload the window.";
    return {
      ok: false,
      message: "Configure msgf.authToken before running a shadow scan.",
      ruleErrors: ["Missing Authorization bearer token.", hint],
    };
  }

  const projectOrigin = resolveMappedProjectOrigin(settings.tenantKey);
  if (!projectOrigin) {
    return {
      ok: false,
      message:
        "Set msgf.tenantKey to your mapped project_origin (e.g. org/repo) before running a shadow scan.",
      ruleErrors: ["project_origin required for scoped ingest."],
    };
  }
  const files = await collectWorkspaceScanFiles(settings.productPath);
  if (settings.productPath.trim() && files.length === 0) {
    return {
      ok: false,
      message: `No scannable files under msgf.productPath (${settings.productPath}).`,
      ruleErrors: [
        "Open the monorepo root and set msgf.productPath, or run MSGF: Configure monorepo product.",
      ],
    };
  }

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
      const errCode = typeof raw.error === "string" ? raw.error : "";
      const insufficient = res.status === 402 || errCode === "INSUFFICIENT_FUNDS";
      return {
        ok: false,
        message: insufficient
          ? "Insufficient MSGF token wallet balance for this tenant."
          : typeof raw.error === "string"
            ? raw.error
            : `Shadow scan failed (HTTP ${res.status}).`,
        ruleErrors: insufficient
          ? [
              "INSUFFICIENT_FUNDS",
              `Tenant wallet "${tenantId}" needs tokens (shadow scan reserves ~1000 per run).`,
              "Mint a new IDE token at Workspace → IDE setup (auto-tops up wallet after deploy), or ask an admin to run: npm run grant:wallet -w msgf -- --tenant=elphiesyntax/author-ecosystem",
            ]
          : ruleErrors.length
            ? ruleErrors
            : [`HTTP ${res.status}${errCode ? ` · ${errCode}` : ""}`],
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
