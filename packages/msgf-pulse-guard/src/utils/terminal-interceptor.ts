import { exec } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import * as vscode from "vscode";

import { readMsgfSettings } from "../config";
import { buildIdeApiAuthHeaders } from "../pulseAuth";

const execAsync = promisify(exec);

const MAX_STDERR_CHARS = 2000;
const MAX_STREAM_CHARS = 8192;
const EXEC_MAX_BUFFER = 256 * 1024;
const BUILD_TIMEOUT_MS = 600_000;

type IssueCategory = "P1_LOG_AUDIT" | "P2_BUILD_CRASH";

export type ReportIssuePayload = {
  tenantKey: string;
  issueCategory: IssueCategory;
  driftScore: number;
  description: string;
};

function tailSlice(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(-maxChars);
}

function capStream(text: string | undefined): string {
  return (text ?? "").slice(0, MAX_STREAM_CHARS);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a single safe build/test command from workspace markers (no shell hooks). */
export async function resolveBuildCommand(workspacePath: string): Promise<string> {
  const pkgPath = path.join(workspacePath, "package.json");
  if (await fileExists(pkgPath)) {
    try {
      const raw = await readFile(pkgPath, "utf8");
      const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
      if (typeof pkg.scripts?.build === "string" && pkg.scripts.build.trim()) {
        return "npm run build";
      }
    } catch {
      /* fall through */
    }
  }

  if (await fileExists(path.join(workspacePath, "Gemfile"))) {
    return "bundle exec rails test";
  }

  return "npm run build";
}

function toApiReportBody(
  payload: ReportIssuePayload,
  workspacePath: string,
  entityId?: string
): Record<string, unknown> {
  const description = payload.description.slice(0, 8000);
  const body: Record<string, unknown> = {
    message: description,
    tenant_id: payload.tenantKey,
    source: "extension",
    location: workspacePath.slice(0, 4000),
    operator_note: `${payload.issueCategory} driftScore=${payload.driftScore}`,
  };

  if (entityId?.trim()) {
    body.entity_id = entityId.trim();
  }

  if (payload.issueCategory === "P2_BUILD_CRASH" && entityId?.trim()) {
    body.diagnostic_snapshot = {
      captured_at: new Date().toISOString(),
      source: "msgf_terminal_interceptor",
      entity_id: entityId.trim(),
      operator_note: description,
      editor: { location_href: workspacePath.slice(0, 4000) },
      keystrokes_last_10: [],
      pillar_health: {
        issueCategory: payload.issueCategory,
        driftScore: payload.driftScore,
        channel: "terminal_interceptor",
      },
    };
  }

  return body;
}

async function postReportIssue(
  payload: ReportIssuePayload,
  workspacePath: string,
  entityId: string | undefined,
  fetchImpl: typeof fetch
): Promise<void> {
  const settings = readMsgfSettings();
  const apiUrl = settings.apiUrl.replace(/\/$/, "");
  const url = `${apiUrl}/api/msgf/report-issue`;

  const headers = {
    "Content-Type": "application/json",
    ...buildIdeApiAuthHeaders({
      settings,
      tenantId: payload.tenantKey,
      entityId,
    }),
  };

  const res = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(toApiReportBody(payload, workspacePath, entityId)),
  });

  if (!res.ok) {
    const raw = (await res.json().catch(() => ({}))) as { error?: unknown };
    const detail =
      typeof raw.error === "string"
        ? raw.error
        : JSON.stringify(raw.error ?? res.statusText);
    console.warn("[MSGF terminal-interceptor] report-issue failed:", detail);
  }
}

/**
 * Run a bounded local build/test command and sync pass/fail metrics to report-issue.
 */
export async function executeSafeDiagnostic(
  workspacePath: string,
  tenantKey: string,
  entityId?: string,
  fetchImpl: typeof fetch = fetch.bind(globalThis)
): Promise<void> {
  const settings = readMsgfSettings();
  if (!settings.authToken.trim()) {
    void vscode.window.showWarningMessage(
      "[MSGF Guard] msgf.authToken required before running Safe Build diagnostic."
    );
    return;
  }

  const command = await resolveBuildCommand(workspacePath);

  try {
    await execAsync(command, {
      cwd: workspacePath,
      maxBuffer: EXEC_MAX_BUFFER,
      timeout: BUILD_TIMEOUT_MS,
      windowsHide: true,
    });

    await postReportIssue(
      {
        tenantKey,
        issueCategory: "P1_LOG_AUDIT",
        driftScore: 0.0,
        description: "Build Passed: Log Audit Sync",
      },
      workspacePath,
      entityId,
      fetchImpl
    );

    void vscode.window.showInformationMessage(
      "✅ MSGF Safe Build Passed. Log metrics synced to State Ledger."
    );
  } catch (e) {
    const err = e as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    const stderrTail = tailSlice(
      capStream(err.stderr) || capStream(err.stdout) || String(err.message ?? "Build failed"),
      MAX_STDERR_CHARS
    );

    await postReportIssue(
      {
        tenantKey,
        issueCategory: "P2_BUILD_CRASH",
        driftScore: 0.85,
        description: stderrTail || "Build failed with no stderr output.",
      },
      workspacePath,
      entityId,
      fetchImpl
    );

    void vscode.window.showWarningMessage(
      "❌ Build Failed! Dual-Model CONVERGE triggered. Fetching 0-Token Self-Heal Pack on your Web Dashboard."
    );
  }
}
