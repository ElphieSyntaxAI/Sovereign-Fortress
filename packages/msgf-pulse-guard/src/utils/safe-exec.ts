import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { assertAllowedVerifyCommand } from "./shell-safe-path";

const execFileAsync = promisify(execFile);

const EXEC_MAX_BUFFER = 256 * 1024;

export type ParsedVerifyCommand = {
  bin: string;
  args: string[];
  display: string;
};

/** Parse allowlisted verify command into execFile argv (no shell). */
export function parseAllowedVerifyCommand(command: string): ParsedVerifyCommand {
  const trimmed = assertAllowedVerifyCommand(command);

  if (trimmed === "npm run build") {
    return { bin: "npm", args: ["run", "build"], display: trimmed };
  }
  if (trimmed === "npm test") {
    return { bin: "npm", args: ["test"], display: trimmed };
  }
  const npmFile = /^npm test -- ([\w./@\-]+)$/.exec(trimmed);
  if (npmFile?.[1]) {
    return { bin: "npm", args: ["test", "--", npmFile[1]], display: trimmed };
  }
  if (trimmed === "bundle exec rails test") {
    return { bin: "bundle", args: ["exec", "rails", "test"], display: trimmed };
  }
  const railsFile = /^bundle exec rails test ([\w./@\-]+)$/.exec(trimmed);
  if (railsFile?.[1]) {
    return { bin: "bundle", args: ["exec", "rails", "test", railsFile[1]], display: trimmed };
  }

  throw new Error(`Unhandled allowlisted command: ${trimmed}`);
}

export type SafeExecResult = {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
};

/** Run allowlisted verify command without invoking a shell. */
export async function safeExecVerifyCommand(
  workspacePath: string,
  command: string,
  timeoutMs: number
): Promise<SafeExecResult> {
  const parsed = parseAllowedVerifyCommand(command);

  try {
    const { stdout, stderr } = await execFileAsync(parsed.bin, parsed.args, {
      cwd: workspacePath,
      maxBuffer: EXEC_MAX_BUFFER,
      timeout: timeoutMs,
      windowsHide: true,
      shell: false,
    });
    return {
      ok: true,
      exitCode: 0,
      stdout: stdout ?? "",
      stderr: stderr ?? "",
    };
  } catch (e) {
    const err = e as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    const exitCode =
      typeof err.code === "number" ? err.code : typeof err.code === "string" ? 1 : 1;
    return {
      ok: false,
      exitCode,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message ?? "",
    };
  }
}
