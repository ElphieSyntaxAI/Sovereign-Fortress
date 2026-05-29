import { exec } from "node:child_process";
import { promisify } from "node:util";

import * as vscode from "vscode";

const execAsync = promisify(exec);

const MAX_OUTPUT_CHARS = 4000;
const EXEC_MAX_BUFFER = 256 * 1024;
const RUN_TIMEOUT_MS = 600_000;

export type RunScriptResult = {
  ok: boolean;
  command: string;
  output: string;
};

function capOutput(text: string | undefined): string {
  const t = (text ?? "").trim();
  if (t.length <= MAX_OUTPUT_CHARS) return t;
  return t.slice(-MAX_OUTPUT_CHARS);
}

/** Execute a single verify command in the workspace root (no shell hooks). */
export async function executeRunScriptCommand(
  workspacePath: string,
  command: string
): Promise<RunScriptResult> {
  const cmd = command.trim();
  if (!cmd) {
    return { ok: false, command: cmd, output: "Empty command." };
  }

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: workspacePath,
      maxBuffer: EXEC_MAX_BUFFER,
      timeout: RUN_TIMEOUT_MS,
      windowsHide: true,
    });
    const output = capOutput(`${stdout ?? ""}\n${stderr ?? ""}`.trim());
    return { ok: true, command: cmd, output: output || "Command completed with no output." };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = capOutput(
      `${err.stderr ?? ""}\n${err.stdout ?? ""}\n${err.message ?? ""}`.trim()
    );
    return { ok: false, command: cmd, output: output || "Verify command failed." };
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
