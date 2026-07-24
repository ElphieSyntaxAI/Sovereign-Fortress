/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Run a bounded local build/test command; sync pass → verify-result, fail → dev-event.
 * A5: asyncPreflight (default) returns after local exit; skipMsgf requires skip-audit.
 */
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import * as vscode from "vscode";

import { readMsgfSettings } from "../config";
import { postDevEventBuildFailed } from "../devEventClient";
import { setMsgfShadowStatus } from "../shadowStatusBridge";
import { postSkipAudit } from "../skipAuditClient";
import { postVerifyResult } from "../verifyResultClient";
import { assertAllowedVerifyCommand, redactTerminalSnippet } from "./shell-safe-path";
import { safeExecVerifyCommand } from "./safe-exec";

const MAX_STDERR_CHARS = 2000;
const MAX_STREAM_CHARS = 8192;
const BUILD_TIMEOUT_MS = 600_000;

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

function tailSlice(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(-maxChars);
}

function capStream(text: string | undefined): string {
  return (text ?? "").slice(0, MAX_STREAM_CHARS);
}

function shouldSkipMsgf(settings: ReturnType<typeof readMsgfSettings>): boolean {
  return settings.skipMsgf === true || process.env.MSGF_SKIP === "1";
}

async function maybeRecordSkipAudit(
  settings: ReturnType<typeof readMsgfSettings>,
  tenantKey: string,
  fetchImpl: typeof fetch
): Promise<{ ok: boolean; error?: string }> {
  const skip = await postSkipAudit({
    settings,
    payload: {
      project_origin: tenantKey,
      user: vscode.env.machineId || null,
      git_sha: process.env.GIT_SHA ?? process.env.GITHUB_SHA ?? null,
      reason: "msgf.skipMsgf or MSGF_SKIP=1 — Safe Build bypass",
      ts: new Date().toISOString(),
    },
    fetchImpl,
  });
  return skip;
}

/**
 * Run local Safe Build; with asyncPreflight (default) network sync is fire-and-forget.
 */
export async function executeSafeDiagnostic(
  workspacePath: string,
  tenantKey: string,
  entityId?: string,
  fetchImpl: typeof fetch = fetch.bind(globalThis)
): Promise<void> {
  const settings = readMsgfSettings();
  if (!settings.authToken.trim() && !shouldSkipMsgf(settings)) {
    void vscode.window.showWarningMessage(
      "[MSGF Guard] msgf.authToken required before running Safe Build diagnostic."
    );
    return;
  }

  if (shouldSkipMsgf(settings)) {
    const audited = await maybeRecordSkipAudit(settings, tenantKey, fetchImpl);
    if (!audited.ok) {
      void vscode.window.showErrorMessage(
        `[MSGF Guard] Skip blocked — ${audited.error ?? "skip-audit failed."}`
      );
      return;
    }
    void vscode.window.showWarningMessage(
      "[MSGF Guard] MSGF sync skipped (audited). Running local Safe Build only."
    );
  }

  const command = assertAllowedVerifyCommand(await resolveBuildCommand(workspacePath));
  const result = await safeExecVerifyCommand(workspacePath, command, BUILD_TIMEOUT_MS);
  const output = capStream(`${result.stderr}\n${result.stdout}`.trim());
  const correlationId = randomUUID();
  const asyncMode = settings.asyncPreflight !== false;

  if (shouldSkipMsgf(settings)) {
    if (result.ok) {
      void vscode.window.showInformationMessage(
        "✅ Local Safe Build Passed (MSGF sync skipped — audited)."
      );
    } else {
      void vscode.window.showWarningMessage(
        "❌ Local Safe Build Failed (MSGF sync skipped — audited)."
      );
    }
    return;
  }

  if (result.ok) {
    void vscode.window.showInformationMessage(
      asyncMode
        ? "✅ MSGF Safe Build Passed (local). Syncing verify-result…"
        : "✅ MSGF Safe Build Passed. Verify result synced to State Ledger."
    );

    const sync = async () => {
      if (asyncMode) {
        setMsgfShadowStatus("pending", correlationId);
      }
      const verify = await postVerifyResult({
        settings,
        tenantKey,
        entityId,
        body: {
          passed: true,
          command,
          exit_code: 0,
          stdout_snippet: redactTerminalSnippet(output),
          async: asyncMode || undefined,
          correlation_id: asyncMode ? correlationId : undefined,
        },
        fetchImpl,
      });
      if (!verify.ok) {
        console.warn("[MSGF terminal-interceptor] verify-result failed:", verify.error);
        setMsgfShadowStatus("red", verify.error);
        return;
      }
      if (asyncMode) {
        setMsgfShadowStatus("green", correlationId);
      }
    };

    if (asyncMode) {
      void sync();
    } else {
      await sync();
    }
    return;
  }

  const stderrTail = tailSlice(
    redactTerminalSnippet(output || "Build failed with no output."),
    MAX_STDERR_CHARS
  );

  void vscode.window.showWarningMessage(
    asyncMode
      ? "❌ Build Failed! Heal Cheap triggered (async sync)…"
      : "❌ Build Failed! Heal Cheap triggered via dev-event. Check your MSGF dashboard for the self-heal pack."
  );

  const syncFail = async () => {
    if (asyncMode) {
      setMsgfShadowStatus("pending", correlationId);
    }
    const [devEvent, verify] = await Promise.all([
      postDevEventBuildFailed({
        settings,
        tenantKey,
        entityId,
        body: {
          activeFile: path.basename(workspacePath),
          excerpt: stderrTail,
          exitCode: result.exitCode,
        },
        fetchImpl,
      }),
      postVerifyResult({
        settings,
        tenantKey,
        entityId,
        body: {
          passed: false,
          command,
          exit_code: result.exitCode,
          stderr_snippet: redactTerminalSnippet(output),
          async: asyncMode || undefined,
          correlation_id: asyncMode ? correlationId : undefined,
        },
        fetchImpl,
      }),
    ]);

    if (!devEvent.ok) {
      console.warn("[MSGF terminal-interceptor] dev-event failed:", devEvent.error);
    }
    if (!verify.ok) {
      console.warn("[MSGF terminal-interceptor] verify-result failed:", verify.error);
    }
    setMsgfShadowStatus(
      "red",
      !devEvent.ok || !verify.ok
        ? `${devEvent.error ?? ""} ${verify.error ?? ""}`.trim()
        : correlationId
    );
  };

  if (asyncMode) {
    void syncFail();
  } else {
    await syncFail();
  }
}
