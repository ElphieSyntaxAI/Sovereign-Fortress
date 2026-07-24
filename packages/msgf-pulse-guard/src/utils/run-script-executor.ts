import * as vscode from "vscode";

import { readMsgfSettings } from "../config";
import { postDevEventBuildFailed } from "../devEventClient";
import { setMsgfShadowStatus } from "../shadowStatusBridge";
import { postSkipAudit } from "../skipAuditClient";
import { postVerifyResult } from "../verifyResultClient";
import { redactTerminalSnippet } from "./shell-safe-path";
import { safeExecVerifyCommand } from "./safe-exec";
import { randomUUID } from "node:crypto";

const MAX_OUTPUT_CHARS = 4000;
const RUN_TIMEOUT_MS = 600_000;

export type RunScriptResult = {
  ok: boolean;
  command: string;
  output: string;
  exitCode: number;
};

export type RunScriptSyncContext = {
  tenantKey: string;
  entityId?: string;
  packId?: string;
  filePaths?: string[];
  fetchImpl?: typeof fetch;
};

function capOutput(text: string | undefined): string {
  const t = (text ?? "").trim();
  if (t.length <= MAX_OUTPUT_CHARS) return t;
  return t.slice(-MAX_OUTPUT_CHARS);
}

function shouldSkipMsgf(settings: ReturnType<typeof readMsgfSettings>): boolean {
  return settings.skipMsgf === true || process.env.MSGF_SKIP === "1";
}

/** Execute a single allowlisted verify command (no shell) and optionally sync to MSGF API. */
export async function executeRunScriptCommand(
  workspacePath: string,
  command: string,
  sync?: RunScriptSyncContext
): Promise<RunScriptResult> {
  const cmd = command.trim();
  if (!cmd) {
    return { ok: false, command: cmd, output: "Empty command.", exitCode: 1 };
  }

  try {
    const settings = readMsgfSettings();
    const fetchImpl = sync?.fetchImpl ?? fetch.bind(globalThis);

    if (sync && shouldSkipMsgf(settings)) {
      const audited = await postSkipAudit({
        settings,
        payload: {
          project_origin: sync.tenantKey,
          user: vscode.env.machineId || null,
          git_sha: process.env.GIT_SHA ?? process.env.GITHUB_SHA ?? null,
          reason: "msgf.skipMsgf or MSGF_SKIP=1 — Run Scripts bypass",
          ts: new Date().toISOString(),
        },
        fetchImpl,
      });
      if (!audited.ok) {
        return {
          ok: false,
          command: cmd,
          output: `MSGF skip blocked — ${audited.error ?? "skip-audit failed."}`,
          exitCode: 1,
        };
      }
      // Local command still runs; no verify-result / dev-event.
      const result = await safeExecVerifyCommand(workspacePath, cmd, RUN_TIMEOUT_MS);
      const output = capOutput(`${result.stdout}\n${result.stderr}`.trim());
      return {
        ok: result.ok,
        command: cmd,
        output: (output || (result.ok ? "OK (MSGF skipped — audited)." : "Failed.")) +
          "\n[MSGF sync skipped — skip-audit recorded]",
        exitCode: result.ok ? 0 : result.exitCode,
      };
    }

    const result = await safeExecVerifyCommand(workspacePath, cmd, RUN_TIMEOUT_MS);
    const output = capOutput(`${result.stdout}\n${result.stderr}`.trim());

    if (sync) {
      const asyncMode = settings.asyncPreflight !== false;
      const correlationId = randomUUID();

      const fire = async () => {
        if (asyncMode) {
          setMsgfShadowStatus("pending", correlationId);
        }
        if (result.ok) {
          const verify = await postVerifyResult({
            settings,
            tenantKey: sync.tenantKey,
            entityId: sync.entityId,
            body: {
              passed: true,
              command: cmd,
              exit_code: 0,
              stdout_snippet: redactTerminalSnippet(output),
              file_paths: sync.filePaths,
              pack_id: sync.packId,
              async: asyncMode || undefined,
              correlation_id: asyncMode ? correlationId : undefined,
            },
            fetchImpl,
          });
          setMsgfShadowStatus(
            verify.ok ? "green" : "red",
            verify.ok ? correlationId : verify.error
          );
        } else {
          void postDevEventBuildFailed({
            settings,
            tenantKey: sync.tenantKey,
            entityId: sync.entityId,
            body: {
              activeFile: sync.filePaths?.[0] ?? "verify",
              excerpt: redactTerminalSnippet(output || "Verify command failed."),
              exitCode: result.exitCode,
            },
            fetchImpl,
          });
          const verify = await postVerifyResult({
            settings,
            tenantKey: sync.tenantKey,
            entityId: sync.entityId,
            body: {
              passed: false,
              command: cmd,
              exit_code: result.exitCode,
              stderr_snippet: redactTerminalSnippet(output),
              file_paths: sync.filePaths,
              async: asyncMode || undefined,
              correlation_id: asyncMode ? correlationId : undefined,
            },
            fetchImpl,
          });
          setMsgfShadowStatus("red", verify.ok ? correlationId : verify.error);
        }
      };

      if (asyncMode) {
        void fire();
      } else {
        await fire();
      }
    }

    if (result.ok) {
      return {
        ok: true,
        command: cmd,
        output: output || "Command completed with no output.",
        exitCode: 0,
      };
    }

    return {
      ok: false,
      command: cmd,
      output: output || "Verify command failed.",
      exitCode: result.exitCode,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verify command rejected.";
    return { ok: false, command: cmd, output: message, exitCode: 1 };
  }
}

export async function showRunScriptResult(result: RunScriptResult): Promise<void> {
  const channel = vscode.window.createOutputChannel("MSGF Run Scripts");
  channel.clear();
  channel.appendLine(`$ ${result.command}`);
  channel.appendLine("");
  channel.appendLine(result.output);
  channel.show(true);

  if (result.ok) {
    void vscode.window.showInformationMessage(
      `✅ Verify passed: ${result.command.slice(0, 72)}`
    );
  } else {
    void vscode.window.showWarningMessage(
      `❌ Verify failed — see Output › MSGF Run Scripts`
    );
  }
}
