import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import * as vscode from "vscode";

import { readMsgfSettings } from "../config";
import { postDevEventBuildFailed } from "../devEventClient";
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

/**
 * Run a bounded local build/test command; sync pass → verify-result, fail → dev-event.
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

  const command = assertAllowedVerifyCommand(await resolveBuildCommand(workspacePath));
  const result = await safeExecVerifyCommand(workspacePath, command, BUILD_TIMEOUT_MS);
  const output = capStream(`${result.stderr}\n${result.stdout}`.trim());

  if (result.ok) {
    const verify = await postVerifyResult({
      settings,
      tenantKey,
      entityId,
      body: {
        passed: true,
        command,
        exit_code: 0,
        stdout_snippet: redactTerminalSnippet(output),
      },
      fetchImpl,
    });

    if (!verify.ok) {
      console.warn("[MSGF terminal-interceptor] verify-result failed:", verify.error);
    }

    void vscode.window.showInformationMessage(
      "✅ MSGF Safe Build Passed. Verify result synced to State Ledger."
    );
    return;
  }

  const stderrTail = tailSlice(redactTerminalSnippet(output || "Build failed with no output."), MAX_STDERR_CHARS);
  const devEvent = await postDevEventBuildFailed({
    settings,
    tenantKey,
    entityId,
    body: {
      activeFile: path.basename(workspacePath),
      excerpt: stderrTail,
      exitCode: result.exitCode,
    },
    fetchImpl,
  });

  if (!devEvent.ok) {
    console.warn("[MSGF terminal-interceptor] dev-event failed:", devEvent.error);
  }

  void vscode.window.showWarningMessage(
    "❌ Build Failed! Heal Cheap triggered via dev-event. Check your MSGF dashboard for the self-heal pack."
  );
}
